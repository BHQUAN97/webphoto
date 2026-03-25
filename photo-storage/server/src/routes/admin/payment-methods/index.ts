import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../../utils/db.js'
import { paymentMethods } from '../../../database/schema.js'
import { eq, asc } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { adminStats } from '../../../utils/admin-stats.js'
import { storage } from '../../../utils/storage/index.js'

const router = Router()

// GET / — list payment methods
router.get('/', async (req, res) => {
  requireAdmin(req)
  const methods = await db.select().from(paymentMethods)
    .orderBy(asc(paymentMethods.sortOrder))

  res.json({
    methods: methods.map(m => ({
      ...m,
      config: JSON.parse(m.config),
    })),
  })
})

// POST / — create payment method
router.post('/', async (req, res) => {
  const admin = requireAdmin(req)
  const { type, name, config, isDefault, sortOrder } = req.body

  if (!type || !name || !config) {
    return res.status(400).json({ message: 'Thiếu thông tin phương thức thanh toán' })
  }

  // If isDefault, unset other defaults
  if (isDefault) {
    await db.update(paymentMethods).set({ isDefault: false })
      .where(eq(paymentMethods.isDefault, true))
  }

  const methodId = ulid()
  await db.insert(paymentMethods).values({
    id: methodId, type, name,
    config: JSON.stringify(config),
    isActive: true,
    isDefault: isDefault ?? false,
    sortOrder: sortOrder ?? 0,
  })

  await adminStats.log(admin.sub, 'payment_method.create', 'payment_method', methodId)
  res.json({ id: methodId })
})

// PATCH /:id — update payment method
router.patch('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { type, name, config, isActive, isDefault, sortOrder } = req.body

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (type !== undefined) updates.type = type
  if (name !== undefined) updates.name = name
  if (config !== undefined) updates.config = JSON.stringify(config)
  if (isActive !== undefined) updates.isActive = isActive
  if (sortOrder !== undefined) updates.sortOrder = sortOrder

  if (isDefault) {
    await db.update(paymentMethods).set({ isDefault: false })
      .where(eq(paymentMethods.isDefault, true))
    updates.isDefault = true
  } else if (isDefault === false) {
    updates.isDefault = false
  }

  await db.update(paymentMethods).set(updates).where(eq(paymentMethods.id, id))

  await adminStats.log(admin.sub, 'payment_method.update', 'payment_method', id)
  res.json({ ok: true })
})

// POST /upload-qr — get presigned URL for QR image upload
router.post('/upload-qr', async (req, res) => {
  requireAdmin(req)
  const { mimeType } = req.body

  if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return res.status(400).json({ message: 'Chỉ hỗ trợ JPEG, PNG, WebP' })
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const key = `payment-qr/${ulid()}.${ext}`

  const url = await storage().presignUpload(key, mimeType)
  res.json({ url, key })
})

// DELETE /:id — delete payment method
router.delete('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params

  await db.delete(paymentMethods).where(eq(paymentMethods.id, id))

  await adminStats.log(admin.sub, 'payment_method.delete', 'payment_method', id)
  res.json({ ok: true })
})

export default router
