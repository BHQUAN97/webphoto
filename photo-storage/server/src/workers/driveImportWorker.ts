import { Worker } from 'bullmq'
import { db } from '../utils/db.js'
import { storage } from '../utils/storage/index.js'
import { emitToUser } from '../utils/socket-emit.js'
import { images, albums } from '../database/schema.js'
import { eq, sql } from 'drizzle-orm'
import { imageQueue } from '../plugins/bullmq.js'
import { downloadFile } from '../utils/googleDrive.js'
import { quotaUtils } from '../utils/quota.js'
import { logger } from '../utils/logger.js'

export function createDriveImportWorker() {
  return new Worker('drive-import', async (job) => {
    const { imageId, userId, driveFileId, originalKey, mimeType, originalName, fileSize } = job.data as {
      imageId: string
      userId: string
      driveFileId: string
      originalKey: string
      mimeType: string
      originalName: string
      fileSize: number
    }

    logger.info(`[DriveImport] Starting import for ${originalName}`, {
      source: 'worker:drive-import', imageId, driveFileId, userId,
    })

    try {
      // 1. Download file from Google Drive
      const stream = await downloadFile(driveFileId)

      // Collect stream into buffer
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const buffer = Buffer.concat(chunks)
      const actualSize = buffer.length

      // 2. Check quota before uploading
      const quotaCheck = await quotaUtils.canUpload(userId, BigInt(actualSize))
      if (!quotaCheck.ok) {
        await db.update(images).set({ status: 'failed' }).where(eq(images.id, imageId))
        await emitToUser(userId, {
          type: 'image:failed', imageId,
          reason: quotaCheck.reason ?? 'Không đủ dung lượng',
          message: `Import ảnh ${originalName} thất bại: không đủ dung lượng`,
        })
        return
      }

      // 3. Upload to R2 private bucket
      await storage().uploadPrivateBuffer(originalKey, buffer, mimeType)

      // 4. Update image record: syncing → processing
      await db.update(images).set({
        status: 'processing',
        originalSize: BigInt(actualSize),
      }).where(eq(images.id, imageId))

      // 5. Update album totalBytes
      await db.update(albums).set({
        totalBytes: sql`total_bytes + ${actualSize}`,
      }).where(eq(albums.id, job.data.albumId))

      // 6. Update quota
      await quotaUtils.addUsed(userId, BigInt(actualSize))

      // 7. Queue image processing job (thumb + preview generation)
      await imageQueue.add('process', {
        imageId,
        userId,
        originalKey,
        mimeType,
      })

      logger.info(`[DriveImport] Uploaded to R2, queued processing for ${originalName}`, {
        source: 'worker:drive-import', imageId, actualSize,
      })
    } catch (err) {
      const e = err as Error
      logger.error(`[DriveImport] Failed: ${e.message}`, {
        source: 'worker:drive-import', imageId, driveFileId, stack: e.stack,
      })

      await db.update(images).set({ status: 'failed' }).where(eq(images.id, imageId))

      await emitToUser(userId, {
        type: 'image:failed', imageId,
        reason: e.message,
        message: `Import ảnh ${originalName} từ Google Drive thất bại`,
      })

      throw err
    }
  }, {
    connection: { url: process.env.REDIS_URL },
    concurrency: 2,
  })
}
