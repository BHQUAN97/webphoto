import { Worker } from 'bullmq'
import { db } from '../utils/db.js'
import { images } from '../database/schema.js'
import { and, lt, ne, inArray } from 'drizzle-orm'
import { storageFor } from '../utils/storage/index.js'
import { quotaUtils } from '../utils/quota.js'

export function createImageExpiryWorker() {
  return new Worker('image-expiry', async () => {
    const BATCH = 100
    let totalDeleted = 0

    while (true) {
      const expired = await db.select().from(images)
        .where(and(
          lt(images.expiresAt, new Date()),
          ne(images.status, 'uploading'),
        ))
        .limit(BATCH)

      if (expired.length === 0) break

      // Group keys by storage backend
      const byBackend = new Map<string, { priv: string[]; pub: string[] }>()
      for (const i of expired) {
        const b = i.storageBackend || 'r2'
        if (!byBackend.has(b)) byBackend.set(b, { priv: [], pub: [] })
        const g = byBackend.get(b)!
        if (i.originalKey) g.priv.push(i.originalKey)
        if (i.thumbKey) g.pub.push(i.thumbKey)
        if (i.previewKey) g.pub.push(i.previewKey)
      }

      await Promise.all(
        [...byBackend.entries()].flatMap(([backend, { priv, pub }]) => [
          priv.length ? storageFor(backend).deletePrivate(priv) : Promise.resolve(),
          pub.length ? storageFor(backend).deletePublic(pub) : Promise.resolve(),
        ]),
      )

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

    return { deleted: totalDeleted }
  }, { connection: { url: process.env.REDIS_URL } })
}
