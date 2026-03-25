import { Router } from 'express'
import { ulid } from 'ulid'
import { hash } from 'bcryptjs'
import { db } from '../../utils/db.js'
import { users, userPlans, plans, refreshTokens } from '../../database/schema.js'
import { eq, and } from 'drizzle-orm'
import { verifyPassword } from '../../utils/hash.js'
import { jwtUtils } from '../../utils/jwt.js'
import { accessTokenCookie, refreshTokenCookie } from '../../utils/cookie.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' })
  }

  const [user] = await db.select().from(users)
    .where(eq(users.email, email)).limit(1)

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' })
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Tài khoản đã bị khóa' })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' })
  }

  // Get active plan
  const [activePlan] = await db
    .select({ code: plans.code })
    .from(userPlans)
    .innerJoin(plans, eq(userPlans.planId, plans.id))
    .where(and(eq(userPlans.userId, user.id), eq(userPlans.isActive, true)))
    .limit(1)

  const planCode = activePlan?.code ?? 'free'

  const accessToken = await jwtUtils.sign({
    sub: user.id, email: user.email, role: user.role, planCode,
  })

  const refreshTokenValue = ulid()
  const tokenHash = await hash(refreshTokenValue, 6)
  await db.insert(refreshTokens).values({
    id: ulid(), userId: user.id, tokenHash,
    expiresAt: new Date(Date.now() + 7 * 86400_000),
  })

  res.cookie('access_token', accessToken, accessTokenCookie(req))
  res.cookie('refresh_token', refreshTokenValue, refreshTokenCookie(req))

  res.json({
    user: {
      id: user.id, email: user.email, displayName: user.displayName,
      role: user.role, avatarKey: user.avatarKey, planCode,
    },
    accessToken,
  })
})

export default router
