import { db } from './db.js'
import { quotaRedis } from './redis.js'
import { userPlans, plans, storageAddons } from '../database/schema.js'
import { and, eq, gt } from 'drizzle-orm'

export const quotaUtils = {
  async getTotalQuota(userId: string): Promise<bigint> {
    const [activePlan] = await db
      .select({ quotaBytes: plans.quotaBytes })
      .from(userPlans)
      .innerJoin(plans, eq(userPlans.planId, plans.id))
      .where(and(eq(userPlans.userId, userId), eq(userPlans.isActive, true)))
      .limit(1)

    const addons = await db.select({ bytes: storageAddons.bytes }).from(storageAddons)
      .where(and(eq(storageAddons.userId, userId), gt(storageAddons.expiresAt, new Date())))

    return (activePlan?.quotaBytes ?? BigInt(5 * 1024 ** 3))
      + addons.reduce((s, a) => s + a.bytes, BigInt(0))
  },

  async canUpload(userId: string, fileBytes: bigint): Promise<{ ok: boolean; reason?: string }> {
    const [used, total] = await Promise.all([
      quotaRedis.getUsed(userId),
      this.getTotalQuota(userId),
    ])
    return used + fileBytes > total
      ? { ok: false, reason: 'Không đủ dung lượng. Vui lòng nâng cấp gói.' }
      : { ok: true }
  },

  async addUsed(userId: string, bytes: bigint) {
    await quotaRedis.addUsed(userId, bytes)
  },

  async subtractUsed(userId: string, bytes: bigint) {
    await quotaRedis.decrUsed(userId, bytes)
  },
}
