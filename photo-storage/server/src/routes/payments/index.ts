import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../utils/db.js'
import { payments, plans, users, paymentMethods } from '../../database/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'
import { acquirePaymentLock } from '../../utils/redis.js'
import { mailService } from '../../utils/mailService.js'
import { emitToAdmin } from '../../utils/socket-emit.js'

const router = Router()

// POST /create — create payment order
router.post('/create', async (req, res) => {
  const user = requireAuth(req)
  const { planCode, paymentMethodId } = req.body

  const [plan] = await db.select().from(plans)
    .where(eq(plans.code, planCode)).limit(1)
  if (!plan) return res.status(400).json({ message: 'Gói không tồn tại' })

  const methodCondition = paymentMethodId
    ? and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.isActive, true))
    : and(eq(paymentMethods.isDefault, true), eq(paymentMethods.isActive, true))

  const [method] = await db.select().from(paymentMethods)
    .where(methodCondition).limit(1)
  if (!method) return res.status(400).json({ message: 'Không có phương thức thanh toán' })

  const ref = `DH${ulid().slice(-6).toUpperCase()}`
  const paymentId = ulid()
  await db.insert(payments).values({
    id: paymentId, userId: user.sub, planId: plan.id,
    amountVnd: plan.priceVnd, referenceCode: ref,
    paymentMethodId: method.id, status: 'pending',
    expiresAt: new Date(Date.now() + 24 * 3600_000),
  })

  const [customer] = await db.select().from(users).where(eq(users.id, user.sub)).limit(1)
  mailService.sendToAdmins('order_new', {
    orderId: ref, paymentId,
    customerName: customer.displayName, customerEmail: customer.email,
    planName: plan.name, amountVnd: plan.priceVnd,
    referenceCode: ref, methodName: method.name,
    createdAt: new Date().toLocaleString('vi-VN'),
  }).catch(() => {})

  res.json({
    paymentId, referenceCode: ref, amount: plan.priceVnd,
    method: { type: method.type, name: method.name, config: JSON.parse(method.config) },
  })
})

// POST /:id/confirm — customer confirms transfer
router.post('/:id/confirm', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params
  const { customerNote } = req.body

  const [payment] = await db.select().from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, user.sub), eq(payments.status, 'pending')))
    .limit(1)
  if (!payment) return res.status(404).json({ message: 'Đơn hàng không tồn tại' })
  if (payment.expiresAt && payment.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Đơn hàng đã hết hạn' })
  }

  const locked = await acquirePaymentLock(payment.referenceCode)
  if (!locked) return res.status(409).json({ message: 'Đang xử lý, vui lòng thử lại' })

  const now = new Date()
  await db.update(payments).set({
    status: 'awaiting_confirm', confirmedByUser: true,
    confirmedAt: now, customerNote: customerNote ?? null,
  }).where(eq(payments.id, id))

  const [customer] = await db.select().from(users).where(eq(users.id, user.sub)).limit(1)
  mailService.sendToAdmins('order_customer_confirm', {
    orderId: payment.referenceCode, paymentId: payment.id,
    customerName: customer.displayName, customerEmail: customer.email,
    amountVnd: payment.amountVnd, referenceCode: payment.referenceCode,
    customerNote, confirmedAt: now.toLocaleString('vi-VN'),
  }).catch(() => {})

  emitToAdmin({ type: 'admin:new:payment', paymentId: payment.id, amountVnd: payment.amountVnd }).catch(() => {})

  res.json({ ok: true })
})

// POST /:id/cancel — customer cancels order
router.post('/:id/cancel', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params

  const [payment] = await db.select().from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, user.sub), eq(payments.status, 'pending')))
    .limit(1)
  if (!payment) return res.status(404).json({ message: 'Đơn hàng không tồn tại' })

  await db.update(payments).set({ status: 'failed' }).where(eq(payments.id, id))
  res.json({ ok: true })
})

export default router
