import { Router } from 'express'
import { db } from '../../utils/db.js'
import { images, payments, users, appLogs } from '../../database/schema.js'
import { and, lt, lte, ne, eq, gt, gte, inArray, sql } from 'drizzle-orm'
import { storage } from '../../utils/storage/index.js'
import { getSetting } from '../../utils/settings-cache.js'
import { logger } from '../../utils/logger.js'
import { quotaUtils } from '../../utils/quota.js'
import { quotaRedis, redis } from '../../utils/redis.js'
import { mailService } from '../../utils/mailService.js'

const router = Router()

// Verify cron secret
function verifyCron(req: any, res: any): boolean {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    res.status(401).json({ message: 'Unauthorized' })
    return false
  }
  return true
}

// GET /expire-images — loop until no more expired
router.get('/expire-images', async (req, res) => {
  if (!verifyCron(req, res)) return

  let totalDeleted = 0
  const BATCH = 100

  while (true) {
    const expired = await db.select().from(images)
      .where(and(
        lt(images.expiresAt, new Date()),
        ne(images.status, 'uploading'),
      ))
      .limit(BATCH)

    if (expired.length === 0) break

    const privateKeys = expired.map(i => i.originalKey).filter(Boolean)
    const publicKeys = expired.flatMap(i =>
      [i.thumbKey, i.previewKey].filter(Boolean) as string[]
    )

    await Promise.all([
      privateKeys.length ? storage().deletePrivate(privateKeys) : Promise.resolve(),
      publicKeys.length ? storage().deletePublic(publicKeys) : Promise.resolve(),
    ])

    const ids = expired.map(i => i.id)
    await db.delete(images).where(inArray(images.id, ids))

    const byUser = new Map<string, bigint>()
    for (const img of expired) {
      byUser.set(img.userId, (byUser.get(img.userId) ?? BigInt(0)) + img.originalSize)
    }
    await Promise.all(
      [...byUser.entries()].map(([uid, bytes]) => quotaUtils.subtractUsed(uid, bytes))
    )

    totalDeleted += expired.length
  }

  res.json({ deleted: totalDeleted })
})

// GET /reconcile-quota — sync Redis quota with DB
router.get('/reconcile-quota', async (req, res) => {
  if (!verifyCron(req, res)) return

  const actualByUser = await db.select({
    userId: images.userId,
    total: sql<string>`COALESCE(SUM(original_size), 0)`,
  }).from(images)
    .where(eq(images.status, 'ready'))
    .groupBy(images.userId)

  let fixed = 0
  for (const { userId, total } of actualByUser) {
    const actualBytes = BigInt(total)
    const cachedBytes = await quotaRedis.getUsed(userId)
    if (cachedBytes !== actualBytes) {
      await redis.set(`quota:used:${userId}`, actualBytes.toString())
      fixed++
    }
  }

  res.json({ checked: actualByUser.length, fixed })
})

// GET /remind-payments — remind pending orders > 12h
router.get('/remind-payments', async (req, res) => {
  if (!verifyCron(req, res)) return

  const pendingOrders = await db
    .select({ p: payments, u: users })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .where(and(
      eq(payments.status, 'pending'),
      lt(payments.createdAt, new Date(Date.now() - 12 * 3600_000)),
      gt(payments.expiresAt!, new Date()),
    ))

  for (const { p, u } of pendingOrders) {
    const hoursLeft = Math.max(0, Math.floor((p.expiresAt!.getTime() - Date.now()) / 3600_000))
    await mailService.send({
      to: u.email, template: 'order_reminder',
      data: {
        orderId: p.referenceCode, paymentId: p.id,
        amountVnd: p.amountVnd, referenceCode: p.referenceCode, hoursLeft,
      },
    })
  }

  res.json({ reminded: pendingOrders.length })
})

// GET /cleanup-logs — delete old logs from DB + files
router.get('/cleanup-logs', async (req, res) => {
  if (!verifyCron(req, res)) return

  const retentionDays = parseInt(await getSetting('log_retention_days', '30'))
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000)

  // Delete from DB
  const result = await db.delete(appLogs).where(lte(appLogs.createdAt, cutoff))
  const deletedRows = (result as any)[0]?.affectedRows ?? 0

  // Delete old log files
  const fs = await import('fs')
  const path = await import('path')
  let deletedFiles = 0
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  try {
    const files = fs.readdirSync(logger.logsDir)
    for (const file of files) {
      if (!file.endsWith('.log')) continue
      const fileDate = file.replace('.log', '')
      if (fileDate < cutoffDate) {
        fs.unlinkSync(path.join(logger.logsDir, file))
        deletedFiles++
      }
    }
  } catch {
    // logs directory may not exist yet
  }

  logger.info(`Cleanup logs: ${deletedRows} DB rows, ${deletedFiles} files deleted`, { source: 'cron' })
  res.json({ deletedRows, deletedFiles })
})

export default router
