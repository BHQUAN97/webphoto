import { Router } from 'express'
import { db } from '../../../utils/db.js'
import { systemSettings } from '../../../database/schema.js'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { adminStats } from '../../../utils/admin-stats.js'
import { invalidateSettingsCache } from '../../../utils/settings-cache.js'
import { storage, refreshStorage, validateBackend } from '../../../utils/storage/index.js'

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

export default router
