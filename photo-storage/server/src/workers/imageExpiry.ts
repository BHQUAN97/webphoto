import { Worker } from 'bullmq'
import { db } from '../utils/db.js'
import { images } from '../database/schema.js'
import { and, lt, ne, inArray } from 'drizzle-orm'
import { storage } from '../utils/storage/index.js'
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

    return { deleted: totalDeleted }
  }, { connection: { url: process.env.REDIS_URL } })
}
