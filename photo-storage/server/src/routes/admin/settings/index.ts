import { Router } from 'express'
import crypto from 'crypto'
import { db } from '../../../utils/db.js'
import { systemSettings } from '../../../database/schema.js'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { adminStats } from '../../../utils/admin-stats.js'
import { invalidateSettingsCache } from '../../../utils/settings-cache.js'
import { storage, refreshStorage, validateBackend } from '../../../utils/storage/index.js'
import { mailService, type MailTemplate } from '../../../utils/mailService.js'

const router = Router()

// ── Encryption helpers for sensitive data ──
const ENC_ALGO = 'aes-256-gcm'
const ENC_KEY = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'fallback-key-change-me').digest()

function encryptSensitive(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ENC_ALGO, ENC_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: enc:iv:tag:ciphertext (all base64)
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function decryptSensitive(stored: string): string {
  if (!stored.startsWith('enc:')) {
    // Not encrypted (legacy) — return as-is
    return stored
  }
  const parts = stored.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted format')
  const iv = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')
  const encrypted = Buffer.from(parts[3], 'base64')
  const decipher = crypto.createDecipheriv(ENC_ALGO, ENC_KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// Export for use by googleDrive.ts
export { decryptSensitive }

// GET / — all system settings
router.get('/', async (req, res) => {
  requireAdmin(req)
  const settings = await db.select().from(systemSettings)

  // Filter out sensitive keys — never send encrypted credentials to client
  const SENSITIVE_KEYS = new Set(['google_service_account'])
  const result: Record<string, string> = {}
  for (const s of settings) {
    if (!SENSITIVE_KEYS.has(s.key)) {
      result[s.key] = s.value
    }
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

// POST /drive-config — Save Google Drive service account JSON
router.post('/drive-config', async (req, res) => {
  const admin = requireAdmin(req)
  const { serviceAccountJson } = req.body

  if (!serviceAccountJson) {
    return res.status(400).json({ message: 'Thiếu Service Account JSON' })
  }

  // Validate JSON format
  let parsed: Record<string, unknown>
  try {
    parsed = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson
  } catch {
    return res.status(400).json({ message: 'JSON không hợp lệ' })
  }

  // Validate required fields
  const required = ['type', 'project_id', 'private_key', 'client_email']
  const missing = required.filter(k => !parsed[k])
  if (missing.length > 0) {
    return res.status(400).json({ message: `Thiếu trường bắt buộc: ${missing.join(', ')}` })
  }

  if (parsed.type !== 'service_account') {
    return res.status(400).json({ message: 'Loại key phải là "service_account"' })
  }

  // Encrypt service account JSON before storing in DB
  const jsonStr = JSON.stringify(parsed)
  const encryptedValue = encryptSensitive(jsonStr)
  const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, 'google_service_account')).limit(1)
  if (existing) {
    await db.update(systemSettings).set({ value: encryptedValue, updatedAt: new Date(), updatedBy: admin.sub })
      .where(eq(systemSettings.key, 'google_service_account'))
  } else {
    await db.insert(systemSettings).values({ key: 'google_service_account', value: encryptedValue, updatedBy: admin.sub })
  }

  invalidateSettingsCache()

  // Test connection
  try {
    const { validateDriveConfig } = await import('../../../utils/googleDrive.js')
    // Temporarily set env for validation
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = jsonStr
    const result = validateDriveConfig()
    await adminStats.log(admin.sub, 'settings.drive_config', 'settings')
    res.json({ ok: true, clientEmail: parsed.client_email, projectId: parsed.project_id, valid: !!result })
  } catch (err) {
    res.json({ ok: true, clientEmail: parsed.client_email, projectId: parsed.project_id, warning: (err as Error).message })
  }
})

// GET /drive-config — Get Drive config status (no secrets)
router.get('/drive-config', async (req, res) => {
  requireAdmin(req)
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, 'google_service_account')).limit(1)

  if (!setting) {
    return res.json({ configured: false })
  }

  try {
    const decrypted = decryptSensitive(setting.value)
    const parsed = JSON.parse(decrypted)
    // Never return private_key or full JSON to client
    res.json({
      configured: true,
      clientEmail: parsed.client_email,
      projectId: parsed.project_id,
      updatedAt: setting.updatedAt,
    })
  } catch {
    // Fallback: try reading unencrypted (migration from old format)
    try {
      const parsed = JSON.parse(setting.value)
      res.json({ configured: true, clientEmail: parsed.client_email, projectId: parsed.project_id, updatedAt: setting.updatedAt })
    } catch {
      res.json({ configured: false })
    }
  }
})

export default router
