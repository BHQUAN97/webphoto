import { Worker } from 'bullmq'
import sharp from 'sharp'
import { spawn } from 'child_process'
import { db } from '../utils/db.js'
import { storage } from '../utils/storage/index.js'
import { emitToUser } from '../utils/socket-emit.js'
import { images, albums } from '../database/schema.js'
import { eq, and, isNull } from 'drizzle-orm'
import { logger } from '../utils/logger.js'

const RAW_MIME_TYPES = new Set([
  'image/x-canon-cr2', 'image/x-sony-arw',
  'image/x-nikon-nef', 'image/x-adobe-dng',
])

async function decodeToTiff(inputStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dcraw = spawn('dcraw', ['-c', '-w', '-T', '-'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []

    inputStream.pipe(dcraw.stdin)
    dcraw.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    dcraw.stdout.on('end', () => resolve(Buffer.concat(chunks)))
    dcraw.on('error', reject)
    dcraw.stderr.on('data', (d: Buffer) => logger.error('[dcraw] ' + d.toString(), { source: 'worker:image-process' }))
    dcraw.on('exit', (code) => { if (code !== 0) reject(new Error(`dcraw exit ${code}`)) })
  })
}

export function createImageWorker() {
  return new Worker('image-process', async (job) => {
    const { imageId, userId, originalKey, mimeType } = job.data
    logger.info(`[Worker] Processing image ${imageId}`, { source: 'worker:image-process', userId, imageId, mimeType, originalKey })
    try {
      const rawStream = await storage().getStream(originalKey)

      let sharpInput: Buffer

      if (RAW_MIME_TYPES.has(mimeType)) {
        sharpInput = await decodeToTiff(rawStream)
      } else {
        // Collect stream into buffer for Sharp
        const chunks: Buffer[] = []
        for await (const chunk of rawStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        sharpInput = Buffer.concat(chunks)
      }

      const pipeline = sharp(sharpInput, { failOn: 'none' })

      const [thumbBuf, previewBuf, meta] = await Promise.all([
        pipeline.clone().resize(400).webp({ quality: 80 }).toBuffer(),
        pipeline.clone().resize(1920, 1920, { fit: 'inside' }).webp({ quality: 85 }).toBuffer(),
        pipeline.metadata(),
      ])

      const base = `${userId}/${imageId}`
      await Promise.all([
        storage().uploadBuffer(`${base}/thumb.webp`, thumbBuf, 'image/webp'),
        storage().uploadBuffer(`${base}/preview.webp`, previewBuf, 'image/webp'),
      ])

      await db.update(images).set({
        thumbKey: `${base}/thumb.webp`, previewKey: `${base}/preview.webp`,
        width: meta.width, height: meta.height, status: 'ready',
      }).where(eq(images.id, imageId))

      logger.info(`[Worker] Image ready ${imageId} (${meta.width}x${meta.height})`, { source: 'worker:image-process', userId, imageId })

      // Auto-set album cover if album has no cover yet
      const [img] = await db.select({ albumId: images.albumId, originalName: images.originalName }).from(images).where(eq(images.id, imageId)).limit(1)
      if (img?.albumId) {
        await db.update(albums).set({ coverKey: `${base}/thumb.webp` })
          .where(and(eq(albums.id, img.albumId), isNull(albums.coverKey)))
      }

      const imageName = img?.originalName ?? imageId

      await emitToUser(userId, {
        type: 'image:ready', imageId,
        thumbUrl: storage().publicUrl(`${base}/thumb.webp`),
        message: `Ảnh ${imageName} đã xử lý xong`,
      })
    } catch (err) {
      const e = err as Error & { code?: string }
      logger.error(`[Worker] Image failed ${imageId}: ${e.message}`, { source: 'worker:image-process', userId, imageId, errorName: e.constructor?.name, errorCode: e.code, originalKey: job.data.originalKey, mimeType: job.data.mimeType, stack: e.stack })
      await db.update(images).set({ status: 'failed' }).where(eq(images.id, imageId))

      // Query image name for meaningful notification
      const [failedImg] = await db.select({ originalName: images.originalName }).from(images).where(eq(images.id, imageId)).limit(1)
      const failedName = failedImg?.originalName ?? imageId

      await emitToUser(userId, { type: 'image:failed', imageId, reason: String(err), message: `Xử lý ảnh ${failedName} thất bại` })
      throw err
    }
  }, { connection: { url: process.env.REDIS_URL }, concurrency: 3 })
}
