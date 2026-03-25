import { Worker } from 'bullmq'
import { db } from '../utils/db.js'
import { storage } from '../utils/storage/index.js'
import { emitToUser } from '../utils/socket-emit.js'
import { images, albums } from '../database/schema.js'
import { eq, sql } from 'drizzle-orm'
import { imageQueue } from '../plugins/bullmq.js'
import { downloadFile } from '../utils/googleDrive.js'
import { quotaUtils } from '../utils/quota.js'
import { getSetting } from '../utils/settings-cache.js'
import { logger } from '../utils/logger.js'

// Minimum part size for S3/R2 multipart upload (5 MB)
const MIN_PART_SIZE = 5 * 1024 * 1024

export function createDriveImportWorker() {
  return new Worker('drive-import', async (job) => {
    const { imageId, userId, driveFileId, originalKey, mimeType, originalName, fileSize, albumId } = job.data as {
      imageId: string
      userId: string
      albumId: string
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
      // 0. Check max upload size setting — skip if file exceeds limit
      const maxMb = parseInt(await getSetting('max_upload_size_mb', '200'))
      const maxBytes = (maxMb > 0 ? maxMb : 200) * 1024 * 1024
      if (fileSize > 0 && fileSize > maxBytes) {
        logger.warn(`[DriveImport] Skipping oversized file: ${originalName} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`, {
          source: 'worker:drive-import', imageId, fileSize, maxBytes,
        })
        await db.update(images).set({ status: 'failed' }).where(eq(images.id, imageId))
        await emitToUser(userId, {
          type: 'image:failed', imageId,
          reason: `File vượt quá giới hạn ${maxMb}MB`,
          message: `Import ảnh ${originalName} thất bại: vượt quá giới hạn kích thước`,
        })
        return
      }

      // 1. Check quota BEFORE downloading (use estimated file size from Drive metadata)
      if (fileSize > 0) {
        const quotaCheck = await quotaUtils.canUpload(userId, BigInt(fileSize))
        if (!quotaCheck.ok) {
          await db.update(images).set({ status: 'failed' }).where(eq(images.id, imageId))
          await emitToUser(userId, {
            type: 'image:failed', imageId,
            reason: quotaCheck.reason ?? 'Không đủ dung lượng',
            message: `Import ảnh ${originalName} thất bại: không đủ dung lượng`,
          })
          return
        }
      }

      // 2. Download from Google Drive as stream
      const stream = await downloadFile(driveFileId)

      // 3. Stream to R2 via multipart upload (avoids buffering entire file in memory)
      const stor = storage()
      const uploadId = await stor.createMultipartUpload(originalKey, mimeType)
      const parts: { ETag: string; PartNumber: number }[] = []
      let partNumber = 1
      let pendingBuffer = Buffer.alloc(0)
      let totalBytes = 0

      try {
        for await (const chunk of stream) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          pendingBuffer = Buffer.concat([pendingBuffer, buf])
          totalBytes += buf.length

          // Upload part when we have enough data (5 MB minimum for S3/R2)
          while (pendingBuffer.length >= MIN_PART_SIZE) {
            const partData = pendingBuffer.subarray(0, MIN_PART_SIZE)
            pendingBuffer = pendingBuffer.subarray(MIN_PART_SIZE)
            const etag = await stor.uploadPart(originalKey, uploadId, partNumber, Buffer.from(partData))
            parts.push({ ETag: etag, PartNumber: partNumber })
            partNumber++
          }
        }

        // Upload remaining data as final part
        if (pendingBuffer.length > 0) {
          const etag = await stor.uploadPart(originalKey, uploadId, partNumber, pendingBuffer)
          parts.push({ ETag: etag, PartNumber: partNumber })
        }

        await stor.completeMultipart(originalKey, uploadId, parts)
      } catch (uploadErr) {
        // Abort multipart upload on failure
        try { await stor.abortMultipart(originalKey, uploadId) } catch { /* ignore */ }
        throw uploadErr
      }

      const actualSize = totalBytes

      // 4. Re-check quota with actual size (if actual differs from estimated)
      if (fileSize <= 0) {
        const quotaCheck = await quotaUtils.canUpload(userId, BigInt(actualSize))
        if (!quotaCheck.ok) {
          // Clean up uploaded file
          try { await stor.deletePrivate([originalKey]) } catch { /* ignore */ }
          await db.update(images).set({ status: 'failed' }).where(eq(images.id, imageId))
          await emitToUser(userId, {
            type: 'image:failed', imageId,
            reason: quotaCheck.reason ?? 'Không đủ dung lượng',
            message: `Import ảnh ${originalName} thất bại: không đủ dung lượng`,
          })
          return
        }
      }

      // 5. Update image record: syncing → processing
      await db.update(images).set({
        status: 'processing',
        originalSize: BigInt(actualSize),
      }).where(eq(images.id, imageId))

      // 6. Update album totalBytes + increment imageCount
      await db.update(albums).set({
        totalBytes: sql`total_bytes + ${actualSize}`,
        imageCount: sql`image_count + 1`,
      }).where(eq(albums.id, albumId))

      // 7. Update quota
      await quotaUtils.addUsed(userId, BigInt(actualSize))

      // 8. Queue image processing job (thumb + preview generation)
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
