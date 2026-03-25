import { Router } from 'express'
import express from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { storage, getStorageBackend } from '../../utils/storage/index.js'
import { jwtVerify } from 'jose'
import { logger } from '../../utils/logger.js'

const router = Router()

// POST /upload-chunk — receive a chunk for multipart upload (both R2 and local)
router.post('/upload-chunk', requireAuth, express.raw({ limit: '11mb', type: '*/*' }), async (req, res) => {
  const { key, uploadId, partNumber } = req.query
  if (!key || !uploadId || !partNumber) {
    return res.status(400).json({ message: 'Thieu key, uploadId hoac partNumber' })
  }

  const bodySize = Buffer.isBuffer(req.body) ? req.body.length : 0
  logger.debug(`[Chunk] Receiving part ${partNumber} (${(bodySize / 1024 / 1024).toFixed(1)}MB)`, { key, uploadId: uploadId as string, partNumber: Number(partNumber), bytes: bodySize })

  const stor = storage()
  const etag = await stor.uploadPart(key as string, uploadId as string, Number(partNumber), req.body as Buffer)
  logger.debug(`[Chunk] Part ${partNumber} uploaded, ETag=${etag}`, { key, partNumber: Number(partNumber) })
  res.json({ ETag: etag, PartNumber: Number(partNumber) })
})

// PUT /upload-public — receive a public file (avatar, QR) for local storage
router.put('/upload-public', requireAuth, express.raw({ limit: '5mb', type: '*/*' }), async (req, res) => {
  const backend = await getStorageBackend()
  if (backend !== 'local') return res.status(400).json({ message: 'Chi dung cho local storage' })

  const { key, contentType } = req.query
  if (!key || !contentType) {
    return res.status(400).json({ message: 'Thieu key hoac contentType' })
  }

  await storage().uploadBuffer(key as string, req.body as Buffer, contentType as string)
  res.json({ ok: true })
})

// GET /download — serve private file with JWT token
router.get('/download', async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ message: 'Thieu token' })

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token as string, secret)
    const { key, filename } = payload as { key: string; filename: string }

    const stream = await storage().getStream(key)
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    stream.pipe(res)
  } catch {
    res.status(403).json({ message: 'Token khong hop le hoac het han' })
  }
})

export default router
