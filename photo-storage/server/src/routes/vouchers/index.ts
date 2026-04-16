import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../utils/db.js'
import { vouchers, voucherUsages, plans, userPlans, storageAddons } from '../../database/schema.js'
import { eq, and, sql, lte, or, isNull } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'
import { ipRateLimit } from '../../middleware/ipRateLimit.js'
import { quotaUtils } from '../../utils/quota.js'
import { quotaRedis } from '../../utils/redis.js'
import { asyncHandler, ok, fail } from '../../utils/asyncHandler.js'

const router = Router()

// POST /activate — user activates a voucher code (rate-limit chong brute-force voucher codes)
router.post('/activate', ipRateLimit('voucher:activate', 20, 60), asyncHandler(async (req, res) => {
  const user = requireAuth(req)
  const { code } = req.body

  if (!code?.trim()) {
    return fail(res, 'Vui lòng nhập mã voucher')
  }

  const normalizedCode = code.trim().toUpperCase()

  // Find valid voucher
  const now = new Date()
  const [voucher] = await db.select().from(vouchers)
    .where(and(
      eq(vouchers.code, normalizedCode),
      eq(vouchers.isActive, true),
      lte(vouchers.validFrom, now),
      or(isNull(vouchers.validUntil), sql`${vouchers.validUntil} >= ${now}`),
    ))
    .limit(1)

  if (!voucher) {
    return fail(res, 'Mã voucher không hợp lệ hoặc đã hết hạn')
  }

  // Check max uses
  if (voucher.maxUses && voucher.usedCount >= voucher.maxUses) {
    return fail(res, 'Mã voucher đã hết lượt sử dụng')
  }

  // Check if user already used this voucher
  const [alreadyUsed] = await db.select().from(voucherUsages)
    .where(and(eq(voucherUsages.voucherId, voucher.id), eq(voucherUsages.userId, user.sub)))
    .limit(1)

  if (alreadyUsed) {
    return fail(res, 'Bạn đã sử dụng mã voucher này rồi')
  }

  // Apply voucher based on type
  if (voucher.type === 'plan_activation' && voucher.planId) {
    // Activate plan for user
    const [plan] = await db.select().from(plans).where(eq(plans.id, voucher.planId)).limit(1)
    if (!plan) return fail(res, 'Gói dịch vụ không tồn tại')

    const expiresAt = new Date(now.getTime() + voucher.durationDays * 86400_000)

    // Deactivate current plans
    await db.update(userPlans).set({ isActive: false })
      .where(and(eq(userPlans.userId, user.sub), eq(userPlans.isActive, true)))

    // Insert new plan
    await db.insert(userPlans).values({
      id: ulid(), userId: user.sub, planId: plan.id,
      grantedBy: voucher.createdBy, startedAt: now, expiresAt, isActive: true,
    })

    // Update quota cache
    const total = await quotaUtils.getTotalQuota(user.sub)
    await quotaRedis.setLimit(user.sub, total)

  } else if (voucher.type === 'addon_storage' && voucher.addonBytes) {
    // Add storage bonus
    const expiresAt = new Date(now.getTime() + voucher.durationDays * 86400_000)
    await db.insert(storageAddons).values({
      id: ulid(), userId: user.sub, bytes: voucher.addonBytes, expiresAt,
    })

    const total = await quotaUtils.getTotalQuota(user.sub)
    await quotaRedis.setLimit(user.sub, total)

  } else if (voucher.type === 'addon_days') {
    // Extend current plan by durationDays
    const [currentPlan] = await db.select().from(userPlans)
      .where(and(eq(userPlans.userId, user.sub), eq(userPlans.isActive, true)))
      .limit(1)

    if (currentPlan) {
      const newExpiry = new Date(currentPlan.expiresAt.getTime() + voucher.durationDays * 86400_000)
      await db.update(userPlans).set({ expiresAt: newExpiry }).where(eq(userPlans.id, currentPlan.id))
    } else {
      return fail(res, 'Bạn chưa có gói dịch vụ nào để gia hạn')
    }
  }

  // Record usage + increment counter
  await db.insert(voucherUsages).values({
    id: ulid(), voucherId: voucher.id, userId: user.sub,
  })
  await db.update(vouchers).set({ usedCount: sql`used_count + 1` }).where(eq(vouchers.id, voucher.id))

  return ok(res, { type: voucher.type })
}))

export default router
