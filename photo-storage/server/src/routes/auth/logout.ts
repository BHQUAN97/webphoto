import { Router } from 'express'
import { db } from '../../utils/db.js'
import { refreshTokens } from '../../database/schema.js'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'

const router = Router()

router.post('/logout', async (req, res) => {
  const user = requireAuth(req)

  // Delete all refresh tokens for this user
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.sub))

  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/' })
  res.json({ ok: true })
})

export default router
