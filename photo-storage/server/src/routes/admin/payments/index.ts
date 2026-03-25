import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../../utils/db.js'
import { payments, plans, users, userPlans } from '../../../database/schema.js'
import { eq, and, desc, gte, lte, sql, lt, like as sqlLike } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { quotaUtils } from '../../../utils/quota.js'
import { quotaRedis } from '../../../utils/redis.js'
import { mailService } from '../../../utils/mailService.js'
import { emitToUser } from '../../../utils/socket-emit.js'
import { adminStats } from '../../../utils/admin-stats.js'

const router = Router()

// GET / — list payments
router.get('/', async (req, res) => {
  requireAdmin(req)
  const { status, dateFrom, dateTo, search, cursor } = req.query
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

  const conditions: unknown[] = []
  if (status && status !== 'all') {
    conditions.push(eq(payments.status, status as 'pending' | 'awaiting_confirm' | 'paid' | 'failed'))
  }
  if (dateFrom) conditions.push(gte(payments.createdAt, new Date(dateFrom as string)))
  if (dateTo) conditions.push(lte(payments.createdAt, new Date(dateTo as string)))
  if (search) {
    conditions.push(sqlLike(payments.referenceCode, `%${search}%`))
  }
  if (cursor) conditions.push(lt(payments.id, cursor as string))

  const where = conditions.length > 0 ? and(...conditions as any) : undefined

  const rows = await db.select({
    id: payments.id, referenceCode: payments.referenceCode,
    amountVnd: payments.amountVnd, status: payments.status,
    customerNote: payments.customerNote, adminNote: payments.adminNote,
    createdAt: payments.createdAt, paidAt: payments.paidAt,
    confirmedAt: payments.confirmedAt,
    userId: payments.userId,
    planName: plans.name,
    userName: users.displayName, userEmail: users.email,
  })
  .from(payments)
  .leftJoin(plans, eq(payments.planId, plans.id))
  .innerJoin(users, eq(payments.userId, users.id))
  .where(where)
  .orderBy(desc(payments.createdAt))
  .limit(limit + 1)

  // Total revenue in current filter
  const [{ total }] = await db.select({
    total: sql<number>`COALESCE(SUM(amount_vnd), 0)`,
  }).from(payments)
    .where(and(eq(payments.status, 'paid'), ...(dateFrom ? [gte(payments.paidAt!, new Date(dateFrom as string))] : []),
      ...(dateTo ? [lte(payments.paidAt!, new Date(dateTo as string))] : [])))

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : undefined

  res.json({ items, nextCursor, totalRevenue: total })
})

// GET /export — CSV export
router.get('/export', async (req, res) => {
  requireAdmin(req)
  const { dateFrom, dateTo } = req.query

  const conditions: unknown[] = [eq(payments.status, 'paid')]
  if (dateFrom) conditions.push(gte(payments.paidAt!, new Date(dateFrom as string)))
  if (dateTo) conditions.push(lte(payments.paidAt!, new Date(dateTo as string)))

  const rows = await db.select({
    referenceCode: payments.referenceCode,
    amountVnd: payments.amountVnd,
    status: payments.status,
    paidAt: payments.paidAt,
    userName: users.displayName,
    userEmail: users.email,
    planName: plans.name,
  })
  .from(payments)
  .leftJoin(plans, eq(payments.planId, plans.id))
  .innerJoin(users, eq(payments.userId, users.id))
  .where(and(...conditions as any))
  .orderBy(desc(payments.paidAt))

  const csv = [
    'Mã tham chiếu,Khách hàng,Email,Gói,Số tiền,Trạng thái,Ngày thanh toán',
    ...rows.map(r =>
      `${r.referenceCode},${r.userName},${r.userEmail},${r.planName},${r.amountVnd},${r.status},${r.paidAt?.toISOString() ?? ''}`
    ),
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=payments-export.csv')
  res.send('\uFEFF' + csv) // BOM for Excel
})

// POST /:id/approve — admin approves payment
router.post('/:id/approve', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { deliveryInfo, adminNote } = req.body

  const [payment] = await db.select().from(payments)
    .where(and(eq(payments.id, id), eq(payments.status, 'awaiting_confirm'))).limit(1)
  if (!payment) return res.status(404).json({ message: 'Đơn không hợp lệ' })

  const now = new Date()

  const plan = await db.select().from(plans).where(eq(plans.id, payment.planId!)).limit(1)
  if (!plan[0]) return res.status(400).json({ message: 'Gói không tồn tại' })

  const planExpiresAt = new Date(now.getTime() + plan[0].durationDays * 86400_000)

  // Transaction: mark paid + activate plan
  await db.update(payments).set({
    status: 'paid', paidAt: now, markedPaidBy: admin.sub,
    adminNote: adminNote ?? null,
  }).where(eq(payments.id, id))

  await db.update(userPlans).set({ isActive: false })
    .where(and(eq(userPlans.userId, payment.userId), eq(userPlans.isActive, true)))

  await db.insert(userPlans).values({
    id: ulid(), userId: payment.userId, planId: payment.planId!,
    startedAt: now, expiresAt: planExpiresAt, isActive: true,
  })

  const total = await quotaUtils.getTotalQuota(payment.userId)
  await quotaRedis.setLimit(payment.userId, total)

  // Send email to customer
  const [customer] = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1)
  mailService.send({
    to: customer.email, template: 'order_paid',
    data: {
      orderId: payment.referenceCode, planName: plan[0].name,
      startedAt: now.toLocaleDateString('vi-VN'),
      expiresAt: planExpiresAt.toLocaleDateString('vi-VN'),
      deliveryInfo: deliveryInfo ?? null,
    },
  }).catch(() => {})

  emitToUser(payment.userId, {
    type: 'payment:success', planCode: plan[0].code, expiresAt: planExpiresAt.toISOString(),
  }).catch(() => {})

  await adminStats.log(admin.sub, 'payment.approve', 'payment', id)
  res.json({ ok: true })
})

// POST /:id/reject — admin rejects payment
router.post('/:id/reject', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { adminNote } = req.body

  const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1)
  if (!payment) return res.status(404).json({ message: 'Đơn không tồn tại' })

  await db.update(payments).set({
    status: 'failed', markedPaidBy: admin.sub, adminNote: adminNote ?? null,
  }).where(eq(payments.id, id))

  const [customer] = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1)
  mailService.send({
    to: customer.email, template: 'order_failed',
    data: { orderId: payment.referenceCode, adminNote: adminNote ?? null },
  }).catch(() => {})

  await adminStats.log(admin.sub, 'payment.reject', 'payment', id, { reason: adminNote })
  res.json({ ok: true })
})

export default router
