import { Router } from 'express'
import { db } from '../../../utils/db.js'
import { systemSettings } from '../../../database/schema.js'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { adminStats } from '../../../utils/admin-stats.js'
import { invalidateSettingsCache } from '../../../utils/settings-cache.js'
import { storage, refreshStorage, validateBackend } from '../../../utils/storage/index.js'
import { mailService, type MailTemplate } from '../../../utils/mailService.js'

const router = Router()

// GET / — all system settings
router.get('/', async (req, res) => {
  requireAdmin(req)
  const settings = await db.select().from(systemSettings)

  const result: Record<string, string> = {}
  for (const s of settings) {
    result[s.key] = s.value
  }
  res.json(result)
})

// PATCH / — update settings
router.patch('/', async (req, res) => {
  const admin = requireAdmin(req)
  const updates = req.body as Record<string, string>

  // Validate storage backend before saving
  if (updates.storage_backend) {
    const err = await validateBackend(
      updates.storage_backend,
      updates.local_storage_dir,
    )
    if (err) {
      return res.status(400).json({ message: err })
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    await db.update(systemSettings).set({
      value: typeof value === 'string' ? value : JSON.stringify(value),
      updatedAt: new Date(),
      updatedBy: admin.sub,
    }).where(eq(systemSettings.key, key))
  }

  invalidateSettingsCache()

  // Refresh storage provider if backend was changed
  if (updates.storage_backend || updates.local_storage_dir) {
    await refreshStorage()
  }

  await adminStats.log(admin.sub, 'settings.update', 'settings', undefined, { keys: Object.keys(updates) })
  res.json({ ok: true })
})

// GET /storage-info — get current storage backend info
router.get('/storage-info', async (req, res) => {
  requireAdmin(req)
  const info = await storage().getStorageInfo()
  res.json(info)
})

// POST /test-mail — Send a test email to verify mail configuration
const VALID_TEMPLATES: MailTemplate[] = [
  'order_new', 'order_customer_confirm', 'order_paid',
  'order_failed', 'order_reminder', 'register_welcome',
  'reset_password', 'storage_warning', 'system_restart',
]

router.post('/test-mail', async (req, res) => {
  const admin = requireAdmin(req)
  const { to, template } = req.body as { to?: string; template?: string }

  if (!to || !template) {
    return res.status(400).json({ message: 'Thiếu trường to hoặc template' })
  }

  if (!VALID_TEMPLATES.includes(template as MailTemplate)) {
    return res.status(400).json({ message: `Template không hợp lệ. Cho phép: ${VALID_TEMPLATES.join(', ')}` })
  }

  // Build sample data for the template
  const sampleData: Record<string, unknown> = {
    orderId: 'TEST-001',
    customerName: 'Khách hàng test',
    customerEmail: to,
    planName: 'Pro',
    amountVnd: 499000,
    referenceCode: 'PS-TEST001',
    methodName: 'Chuyển khoản',
    createdAt: new Date().toLocaleString('vi-VN'),
    confirmedAt: new Date().toLocaleString('vi-VN'),
    customerNote: 'Đây là email test',
    paymentId: 'test-payment-id',
    startedAt: new Date().toLocaleString('vi-VN'),
    expiresAt: new Date(Date.now() + 365 * 86400_000).toLocaleString('vi-VN'),
    deliveryInfo: 'Tài khoản test',
    adminNote: 'Lý do test',
    hoursLeft: 24,
    displayName: 'Test User',
    resetUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/reset-password?token=test`,
    usedGB: 45,
    limitGB: 50,
    remainPercent: 10,
    timestamp: new Date().toLocaleString('vi-VN'),
    nodeVersion: process.version,
    port: process.env.PORT ?? '4000',
    storageBackend: 'test',
  }

  try {
    await mailService.send({ to, template: template as MailTemplate, data: sampleData })
    await adminStats.log(admin.sub, 'settings.test_mail', 'settings', undefined, { to, template })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: `Gửi mail thất bại: ${(err as Error).message}` })
  }
})

export default router
