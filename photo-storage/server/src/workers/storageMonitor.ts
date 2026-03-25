import { Worker } from 'bullmq'
import { db } from '../utils/db.js'
import { redis } from '../utils/redis.js'
import * as schema from '../database/schema.js'
import { emitToAdmin } from '../utils/socket-emit.js'
import { sql, eq, gte, and } from 'drizzle-orm'
import { ulid } from 'ulid'

export function createStorageMonitorWorker() {
  return new Worker('storage-monitor', async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [[imgStats], [userCount], [albumCount], [todayRev], [todayUsers]] = await Promise.all([
      db.select({
        totalPrivate: sql<string>`COALESCE(SUM(original_size),0)`,
        count: sql<number>`COUNT(*)`,
      }).from(schema.images).where(eq(schema.images.status, 'ready')),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.users),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.albums),
      db.select({ t: sql<number>`COALESCE(SUM(amount_vnd),0)` }).from(schema.payments)
        .where(and(eq(schema.payments.status, 'paid'), gte(schema.payments.paidAt!, new Date(today)))),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.users)
        .where(gte(schema.users.createdAt, new Date(today))),
    ])

    const visitCount = parseInt((await redis.get(`visit:day:${today}`)) ?? '0')

    await db.insert(schema.storageSnapshots).values({
      id: ulid(),
      totalBytesPrivate: BigInt(imgStats.totalPrivate),
      totalBytesPublic: BigInt(imgStats.totalPrivate) / BigInt(10),
      totalUsers: userCount.c, totalImages: imgStats.count,
      totalAlbums: albumCount.c, newUsersToday: todayUsers.c,
      revenueToday: todayRev.t, visitCount,
    })

    // Storage alert threshold
    const [threshRow] = await db.select({ value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, 'storage_alert_threshold_percent'))
    const threshold = parseInt(threshRow?.value ?? '80')
    const r2LimitBytes = BigInt(parseInt(process.env.R2_LIMIT_GB ?? '10') * 1024 ** 3)
    const usedPct = Number(BigInt(imgStats.totalPrivate) * BigInt(100) / r2LimitBytes)
    if (usedPct >= threshold) {
      await emitToAdmin({ type: 'admin:storage:alert', message: `R2 dùng ${usedPct}%`, usedPercent: usedPct })
    }

    // Error spike check
    const [spikeRow] = await db.select({ value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, 'image_error_spike_threshold'))
    const spikeN = parseInt(spikeRow?.value ?? '20')
    const [errRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(schema.images)
      .where(and(eq(schema.images.status, 'failed'),
        gte(schema.images.createdAt, new Date(Date.now() - 3600_000))))
    if (errRow.c >= spikeN) {
      await emitToAdmin({ type: 'admin:image:error:spike', count: errRow.c, threshold: spikeN })
    }
  }, { connection: { url: process.env.REDIS_URL } })
}
