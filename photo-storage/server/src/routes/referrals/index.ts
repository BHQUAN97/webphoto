import { Router } from 'express'
import { db } from '../../utils/db.js'
import { users, referrals } from '../../database/schema.js'
import { eq, sql } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'

const router = Router()

// GET /me — get user's referral code + stats
router.get('/me', async (req, res) => {
  const user = requireAuth(req)

  const [me] = await db.select({
    referralCode: users.referralCode,
  }).from(users).where(eq(users.id, user.sub)).limit(1)

  if (!me) return res.status(404).json({ message: 'User not found' })

  // Count referrals
  const [stats] = await db.select({
    totalReferred: sql<number>`COUNT(*)`,
    totalRewarded: sql<number>`SUM(CASE WHEN ${referrals.rewarded} = true THEN 1 ELSE 0 END)`,
    totalDaysEarned: sql<number>`SUM(CASE WHEN ${referrals.rewarded} = true THEN ${referrals.rewardDays} ELSE 0 END)`,
  }).from(referrals).where(eq(referrals.referrerId, user.sub))

  // Recent referrals
  const recentReferrals = await db.select({
    id: referrals.id,
    refereeDisplayName: users.displayName,
    rewardDays: referrals.rewardDays,
    rewarded: referrals.rewarded,
    createdAt: referrals.createdAt,
  })
  .from(referrals)
  .leftJoin(users, eq(referrals.refereeId, users.id))
  .where(eq(referrals.referrerId, user.sub))
  .orderBy(sql`${referrals.createdAt} DESC`)
  .limit(20)

  res.json({
    referralCode: me.referralCode,
    stats: {
      totalReferred: stats?.totalReferred ?? 0,
      totalRewarded: stats?.totalRewarded ?? 0,
      totalDaysEarned: stats?.totalDaysEarned ?? 0,
    },
    referrals: recentReferrals,
  })
})

export default router
