import { Router } from 'express'
import { ulid } from 'ulid'
import { hash, compare } from 'bcryptjs'
import { db } from '../../utils/db.js'
import { users, userPlans, plans, refreshTokens } from '../../database/schema.js'
import { eq, and, gt } from 'drizzle-orm'
import { jwtUtils } from '../../utils/jwt.js'
import { accessTokenCookie, refreshTokenCookie } from '../../utils/cookie.js'

const router = Router()

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token
  if (!token) {
    return res.status(401).json({ message: 'Không có refresh token' })
  }

  // Find valid refresh tokens (not expired)
  const validTokens = await db.select().from(refreshTokens)
    .where(gt(refreshTokens.expiresAt, new Date()))

  // Check if any token matches
  let matchedToken: typeof validTokens[0] | null = null
  for (const rt of validTokens) {
    const isMatch = await compare(token, rt.tokenHash)
    if (isMatch) {
      matchedToken = rt
      break
    }
  }

  if (!matchedToken) {
    return res.status(401).json({ message: 'Refresh token không hợp lệ' })
  }

  // Get user
  const [user] = await db.select().from(users)
    .where(eq(users.id, matchedToken.userId)).limit(1)

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Tài khoản không hợp lệ' })
  }

  // Get active plan
  const [activePlan] = await db
    .select({ code: plans.code })
    .from(userPlans)
    .innerJoin(plans, eq(userPlans.planId, plans.id))
    .where(and(eq(userPlans.userId, user.id), eq(userPlans.isActive, true)))
    .limit(1)

  const planCode = activePlan?.code ?? 'free'

  // Rotate refresh token
  await db.delete(refreshTokens).where(eq(refreshTokens.id, matchedToken.id))

  const newRefreshToken = ulid()
  const tokenHash = await hash(newRefreshToken, 6)
  await db.insert(refreshTokens).values({
    id: ulid(), userId: user.id, tokenHash,
    expiresAt: new Date(Date.now() + 7 * 86400_000),
  })

  const accessToken = await jwtUtils.sign({
    sub: user.id, email: user.email, role: user.role, planCode,
  })

  res.cookie('access_token', accessToken, accessTokenCookie(req))
  res.cookie('refresh_token', newRefreshToken, refreshTokenCookie(req))

  res.json({
    user: {
      id: user.id, email: user.email, displayName: user.displayName,
      role: user.role, avatarKey: user.avatarKey, planCode,
    },
    accessToken,
  })
})

export default router
