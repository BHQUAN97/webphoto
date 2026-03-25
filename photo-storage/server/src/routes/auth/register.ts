import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../utils/db.js'
import { users, plans, userPlans, systemSettings } from '../../database/schema.js'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../../utils/hash.js'
import { jwtUtils } from '../../utils/jwt.js'
import { quotaRedis } from '../../utils/redis.js'
import { mailService } from '../../utils/mailService.js'
import { emitToAdmin } from '../../utils/socket-emit.js'
import { isValidEmail, isValidPassword, isValidDisplayName, sanitizeText } from '../../utils/validate.js'
import { accessTokenCookie, refreshTokenCookie } from '../../utils/cookie.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body

  if (!email || !password || !displayName) {
    return res.status(400).json({ message: 'Thiếu thông tin đăng ký' })
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Email không hợp lệ' })
  }

  // Validate password strength
  const pwCheck = isValidPassword(password)
  if (!pwCheck.ok) {
    return res.status(400).json({ message: pwCheck.reason })
  }

  // Validate display name
  if (!isValidDisplayName(displayName)) {
    return res.status(400).json({ message: 'Tên hiển thị không hợp lệ (1-100 ký tự)' })
  }

  const safeDisplayName = sanitizeText(displayName, 100)

  // Check registration open
  const regSetting = await db.select().from(systemSettings)
    .where(eq(systemSettings.key, 'registration_open')).limit(1)
  if (regSetting[0]?.value === 'false') {
    return res.status(403).json({ message: 'Hệ thống tạm ngừng đăng ký' })
  }

  // Check duplicate email
  const existing = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    return res.status(409).json({ message: 'Email đã được sử dụng' })
  }

  const userId = ulid()
  const passwordHash = await hashPassword(password)

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash,
    displayName: safeDisplayName,
    role: 'user',
    isActive: true,
    emailVerified: false,
  })

  // Assign free plan
  const [freePlan] = await db.select().from(plans)
    .where(eq(plans.code, 'free')).limit(1)

  if (freePlan) {
    await db.insert(userPlans).values({
      id: ulid(),
      userId,
      planId: freePlan.id,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + freePlan.durationDays * 86400_000),
      isActive: true,
    })
    await quotaRedis.setLimit(userId, freePlan.quotaBytes)
  }

  // Generate tokens
  const accessToken = await jwtUtils.sign({
    sub: userId, email, role: 'user', planCode: 'free',
  })

  const refreshToken = ulid()
  const { hash } = await import('bcryptjs')
  const tokenHash = await hash(refreshToken, 6)
  await db.insert((await import('../../database/schema.js')).refreshTokens).values({
    id: ulid(), userId, tokenHash,
    expiresAt: new Date(Date.now() + 7 * 86400_000),
  })

  res.cookie('access_token', accessToken, accessTokenCookie(req))
  res.cookie('refresh_token', refreshToken, refreshTokenCookie(req))

  // Send welcome email (fire and forget)
  mailService.send({
    to: email, template: 'register_welcome', data: { displayName },
  }).catch(() => {})

  // Notify admin
  emitToAdmin({ type: 'admin:user:registered', userId, email }).catch(() => {})

  res.json({
    user: { id: userId, email, displayName, role: 'user', planCode: 'free' },
    accessToken,
  })
})

export default router
