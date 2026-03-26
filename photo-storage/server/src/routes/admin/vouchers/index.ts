import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../../utils/db.js'
import { vouchers, voucherUsages, users } from '../../../database/schema.js'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { adminStats } from '../../../utils/admin-stats.js'

const router = Router()

// GET / — list all vouchers
router.get('/', async (req, res) => {
  requireAdmin(req)

  const allVouchers = await db.select().from(vouchers).orderBy(desc(vouchers.createdAt))
  res.json({ vouchers: allVouchers.map(v => ({ ...v, addonBytes: v.addonBytes?.toString() ?? null })) })
})

// POST / — create voucher
router.post('/', async (req, res) => {
  const admin = requireAdmin(req)
  const { code, type, planId, durationDays, addonBytes, maxUses, validFrom, validUntil } = req.body

  if (!code?.trim()) return res.status(400).json({ message: 'Mã voucher không được để trống' })

  const normalizedCode = code.trim().toUpperCase()

  // Check duplicate
  const [existing] = await db.select({ id: vouchers.id }).from(vouchers)
    .where(eq(vouchers.code, normalizedCode)).limit(1)
  if (existing) return res.status(409).json({ message: 'Mã voucher đã tồn tại' })

  const voucherId = ulid()
  await db.insert(vouchers).values({
    id: voucherId,
    code: normalizedCode,
    type: type ?? 'plan_activation',
    planId: planId ?? null,
    durationDays: durationDays ?? 30,
    addonBytes: addonBytes ? BigInt(addonBytes) : null,
    maxUses: maxUses ?? null,
    validFrom: validFrom ? new Date(validFrom) : new Date(),
    validUntil: validUntil ? new Date(validUntil) : null,
    isActive: true,
    createdBy: admin.sub,
  })

  await adminStats.log(admin.sub, 'voucher.create', 'voucher', voucherId, { code: normalizedCode })
  res.json({ id: voucherId, code: normalizedCode })
})

// PATCH /:id — update voucher
router.patch('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { code, type, planId, durationDays, addonBytes, maxUses, validFrom, validUntil, isActive } = req.body

  const updates: Record<string, unknown> = {}
  if (code !== undefined) updates.code = code.trim().toUpperCase()
  if (type !== undefined) updates.type = type
  if (planId !== undefined) updates.planId = planId
  if (durationDays !== undefined) updates.durationDays = durationDays
  if (addonBytes !== undefined) updates.addonBytes = addonBytes ? BigInt(addonBytes) : null
  if (maxUses !== undefined) updates.maxUses = maxUses
  if (validFrom !== undefined) updates.validFrom = new Date(validFrom)
  if (validUntil !== undefined) updates.validUntil = validUntil ? new Date(validUntil) : null
  if (isActive !== undefined) updates.isActive = isActive

  await db.update(vouchers).set(updates).where(eq(vouchers.id, id))

  await adminStats.log(admin.sub, 'voucher.update', 'voucher', id, { updates: req.body })
  res.json({ ok: true })
})

// DELETE /:id — soft delete (set isActive=false)
router.delete('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params

  await db.update(vouchers).set({ isActive: false }).where(eq(vouchers.id, id))

  await adminStats.log(admin.sub, 'voucher.delete', 'voucher', id)
  res.json({ ok: true })
})

// GET /:id/usage — usage history for a voucher
router.get('/:id/usage', async (req, res) => {
  requireAdmin(req)
  const { id } = req.params

  const usages = await db.select({
    id: voucherUsages.id,
    userId: voucherUsages.userId,
    usedAt: voucherUsages.usedAt,
    displayName: users.displayName,
    email: users.email,
  })
  .from(voucherUsages)
  .leftJoin(users, eq(voucherUsages.userId, users.id))
  .where(eq(voucherUsages.voucherId, id))
  .orderBy(desc(voucherUsages.usedAt))

  res.json({ usages })
})

export default router
