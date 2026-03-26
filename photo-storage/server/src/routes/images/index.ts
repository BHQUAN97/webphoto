import { Router } from 'express'
import { ulid } from 'ulid'
import path from 'path'
import archiver from 'archiver'
import { db } from '../../utils/db.js'
import { images, albums, likes, comments, users } from '../../database/schema.js'
import { eq, and, desc, asc, sql, lt, gte, lte, like as sqlLike, inArray } from 'drizzle-orm'
import { requireAuth, requirePlan } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rateLimit.js'
import { storage } from '../../utils/storage/index.js'
import { quotaUtils } from '../../utils/quota.js'
import { feedCache } from '../../utils/redis.js'
import { emitToUser } from '../../utils/socket-emit.js'
import { imageQueue } from '../../plugins/bullmq.js'
import { getSetting } from '../../utils/settings-cache.js'
import {
  sanitizeSearch, sanitizeFilename, sanitizeText, isAllowedExtension,
  isValidImageStatus, isValidSortBy, isValidDateString, isValidFileSize,
  isValidUlid, clampInt,
} from '../../utils/validate.js'
import { logger } from '../../utils/logger.js'

const router = Router()

// GET / — list images with filters
router.get('/', async (req, res) => {
  const { albumId, liked, status, sortBy, dateFrom, dateTo, search, cursor } = req.query
  const limit = clampInt(req.query.limit, 1, 50, 20)

  const conditions: unknown[] = []

  // Validate albumId format (ULID)
  if (albumId) {
    if (!isValidUlid(albumId as string)) return res.status(400).json({ message: 'albumId không hợp lệ' })
    conditions.push(eq(images.albumId, albumId as string))
  }
  // Validate status enum
  if (status && status !== 'all') {
    if (!isValidImageStatus(status as string)) return res.status(400).json({ message: 'status không hợp lệ' })
    conditions.push(eq(images.status, status as 'uploading' | 'processing' | 'ready' | 'failed'))
  }
  // Validate date strings
  if (dateFrom) {
    if (!isValidDateString(dateFrom as string)) return res.status(400).json({ message: 'dateFrom không hợp lệ' })
    conditions.push(gte(images.createdAt, new Date(dateFrom as string)))
  }
  if (dateTo) {
    if (!isValidDateString(dateTo as string)) return res.status(400).json({ message: 'dateTo không hợp lệ' })
    conditions.push(lte(images.createdAt, new Date(dateTo as string)))
  }
  // Sanitize search — escape LIKE wildcards to prevent injection
  if (search) {
    const safeSearch = sanitizeSearch(search as string)
    if (safeSearch) conditions.push(sqlLike(images.originalName, `%${safeSearch}%`))
  }

  // Validate sortBy enum
  let orderByClause
  const safeSortBy = (sortBy && isValidSortBy(sortBy as string)) ? sortBy : 'newest'
  switch (safeSortBy) {
    case 'oldest':    orderByClause = asc(images.createdAt); break
    case 'most_liked': orderByClause = desc(images.likeCount); break
    case 'largest':   orderByClause = desc(images.originalSize); break
    default:          orderByClause = desc(images.createdAt)
  }

  // Validate cursor format
  if (cursor) {
    if (!isValidUlid(cursor as string)) return res.status(400).json({ message: 'cursor không hợp lệ' })
    conditions.push(lt(images.id, cursor as string))
  }

  // If filtering by liked, use INNER JOIN instead of post-filter (avoids full table scan)
  const wantLiked = (liked === '1' || liked === 'true') && req.user
  if (wantLiked) {
    conditions.push(sql`${likes.userId} = ${req.user!.sub}`)
  }

  const where = conditions.length > 0 ? and(...conditions as any) : undefined

  // Use LEFT JOIN likes to get `liked` flag in single query
  const baseQuery = wantLiked
    ? db.select({
        id: images.id, albumId: images.albumId, userId: images.userId,
        thumbKey: images.thumbKey, previewKey: images.previewKey,
        originalName: images.originalName, mimeType: images.mimeType,
        originalSize: images.originalSize, width: images.width, height: images.height,
        status: images.status, likeCount: images.likeCount, commentCount: images.commentCount,
        expiresAt: images.expiresAt, createdAt: images.createdAt,
        likedByUser: likes.userId,
      })
      .from(images)
      .innerJoin(likes, and(eq(likes.imageId, images.id), eq(likes.userId, req.user!.sub)))
      .where(where)
      .orderBy(orderByClause)
      .limit(limit + 1)
    : db.select({
        id: images.id, albumId: images.albumId, userId: images.userId,
        thumbKey: images.thumbKey, previewKey: images.previewKey,
        originalName: images.originalName, mimeType: images.mimeType,
        originalSize: images.originalSize, width: images.width, height: images.height,
        status: images.status, likeCount: images.likeCount, commentCount: images.commentCount,
        expiresAt: images.expiresAt, createdAt: images.createdAt,
        likedByUser: sql<string | null>`NULL`,
      })
      .from(images)
      .where(where)
      .orderBy(orderByClause)
      .limit(limit + 1)

  const rows = await baseQuery

  // Batch check liked flag for non-liked-filter queries
  let likedSet = new Set<string>()
  if (!wantLiked && req.user && rows.length > 0) {
    const ids = rows.slice(0, limit).map(r => r.id)
    const userLikes = await db.select({ imageId: likes.imageId })
      .from(likes)
      .where(and(eq(likes.userId, req.user.sub), inArray(likes.imageId, ids)))
    likedSet = new Set(userLikes.map(l => l.imageId))
  }

  const itemsWithLiked = rows.slice(0, limit).map(r => ({
    id: r.id, albumId: r.albumId, userId: r.userId,
    originalName: r.originalName, mimeType: r.mimeType,
    originalSize: r.originalSize.toString(),
    width: r.width, height: r.height,
    status: r.status, likeCount: r.likeCount, commentCount: r.commentCount,
    expiresAt: r.expiresAt, createdAt: r.createdAt,
    thumbUrl: r.thumbKey ? storage().publicUrl(r.thumbKey) : null,
    previewUrl: r.previewKey ? storage().publicUrl(r.previewKey) : null,
    liked: wantLiked ? true : likedSet.has(r.id),
  }))

  const hasMore = rows.length > limit
  const nextCursor = hasMore ? itemsWithLiked[itemsWithLiked.length - 1]?.id : undefined

  res.json({ items: itemsWithLiked, nextCursor })
})

// POST /upload-url — get presigned multipart URLs
router.post('/upload-url', rateLimit('upload', 60, 60), async (req, res) => {
  const user = requireAuth(req)
  const { filename, size, albumId, mimeType } = req.body

  // Validate required fields
  if (!filename || !size || !albumId || !mimeType) {
    return res.status(400).json({ message: 'Thiếu thông tin upload' })
  }

  // Validate file size is a positive number within absolute limit
  if (!isValidFileSize(size)) {
    return res.status(400).json({ message: 'Dung lượng file không hợp lệ' })
  }

  // Validate albumId format
  if (!isValidUlid(albumId)) {
    return res.status(400).json({ message: 'albumId không hợp lệ' })
  }

  // Sanitize filename — prevent path traversal (../../etc/passwd)
  const safeFilename = sanitizeFilename(filename)

  // Validate file extension against whitelist
  if (!isAllowedExtension(safeFilename)) {
    return res.status(400).json({ message: 'Phần mở rộng file không được phép' })
  }

  // Verify mime type against cached whitelist (avoid DB hit per upload)
  const DEFAULT_MIME_TYPES = '["image/png","image/jpeg","image/webp","image/tiff","image/x-canon-cr2","image/x-sony-arw","image/x-nikon-nef","image/x-adobe-dng"]'
  const allowedRaw = await getSetting('allowed_mime_types', DEFAULT_MIME_TYPES)
  const allowed = JSON.parse(allowedRaw) as string[]
  if (!allowed.includes(mimeType)) {
    return res.status(400).json({ message: 'Định dạng file không được phép' })
  }

  // Check max upload size from cached settings
  const maxMb = await getSetting('max_upload_size_mb', '200')
  const maxBytes = parseInt(maxMb) * 1024 * 1024
  if (size > maxBytes) {
    return res.status(400).json({ message: `File vượt quá giới hạn ${maxMb}MB` })
  }

  // Check quota
  const quota = await quotaUtils.canUpload(user.sub, BigInt(size))
  if (!quota.ok) return res.status(403).json({ message: quota.reason })

  // Verify album ownership
  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.userId, user.sub))).limit(1)
  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  const imageId = ulid()
  // Use sanitized filename for R2 key — prevents path traversal in storage
  const safeExt = path.extname(safeFilename).toLowerCase()
  const key = `${user.sub}/${imageId}/original${safeExt}`
  const stor = storage()
  const uploadId = await stor.createMultipartUpload(key, mimeType)

  const CHUNK = 5 * 1024 * 1024 // 5MB — smaller for smoother progress
  const totalParts = Math.ceil(size / CHUNK)

  // Create image record with sanitized filename
  await db.insert(images).values({
    id: imageId, albumId, userId: user.sub,
    originalKey: key, originalName: safeFilename,
    mimeType, originalSize: BigInt(size), status: 'uploading',
    expiresAt: new Date(Date.now() + 365 * 86400_000),
  })

  logger.info(`[Upload] Created upload session`, { userId: user.sub, imageId, albumId, filename: safeFilename, size, totalParts, mimeType })

  // Always use server-side upload (avoids R2 CORS issues)
  res.json({ imageId, uploadId, key, mode: 'direct', totalParts, chunkSize: CHUNK })
})

// POST /complete — complete multipart upload
router.post('/complete', async (req, res) => {
  const user = requireAuth(req)
  const { imageId, uploadId, key, parts } = req.body

  const [image] = await db.select().from(images)
    .where(and(eq(images.id, imageId), eq(images.userId, user.sub))).limit(1)
  if (!image) return res.status(404).json({ message: 'Image not found' })

  logger.info(`[Upload] Completing multipart`, { userId: user.sub, imageId, partsCount: parts?.length })
  await storage().completeMultipart(key, uploadId, parts)
  await db.update(images).set({ status: 'processing' }).where(eq(images.id, imageId))
  await quotaUtils.addUsed(user.sub, image.originalSize)

  // Update album stats
  await db.update(albums).set({
    imageCount: sql`image_count + 1`,
    totalBytes: sql`total_bytes + ${image.originalSize}`,
    updatedAt: new Date(),
  }).where(eq(albums.id, image.albumId))

  // Invalidate feed cache
  await feedCache.invalidate(`feed:album:${image.albumId}*`)

  // Enqueue BullMQ image processing job
  await imageQueue.add('process', { imageId, userId: user.sub, originalKey: key, mimeType: image.mimeType })
  logger.info(`[Upload] Queued processing job`, { userId: user.sub, imageId, mimeType: image.mimeType })

  res.json({ ok: true })
})

// GET /:id — single image detail
router.get('/:id', async (req, res) => {
  const { id } = req.params
  if (!isValidUlid(id)) return res.status(400).json({ message: 'ID không hợp lệ' })

  const [image] = await db.select().from(images).where(eq(images.id, id)).limit(1)
  if (!image) return res.status(404).json({ message: 'Ảnh không tồn tại' })

  // Check access: owner or public album
  if (req.user?.sub !== image.userId) {
    const [album] = await db.select().from(albums)
      .where(and(eq(albums.id, image.albumId), eq(albums.isPublic, true), eq(albums.isActive, true))).limit(1)
    if (!album) return res.status(403).json({ message: 'Không có quyền xem ảnh này' })
  }

  let liked = false
  if (req.user) {
    const [likeRow] = await db.select().from(likes)
      .where(and(eq(likes.userId, req.user.sub), eq(likes.imageId, id))).limit(1)
    liked = !!likeRow
  }

  res.json({
    ...image,
    originalSize: image.originalSize.toString(),
    thumbUrl: image.thumbKey ? storage().publicUrl(image.thumbKey) : null,
    previewUrl: image.previewKey ? storage().publicUrl(image.previewKey) : null,
    liked,
  })
})

// DELETE /:id — delete single image (owner only)
router.delete('/:id', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params
  if (!isValidUlid(id)) return res.status(400).json({ message: 'ID không hợp lệ' })

  const [image] = await db.select().from(images)
    .where(and(eq(images.id, id), eq(images.userId, user.sub))).limit(1)
  if (!image) return res.status(404).json({ message: 'Ảnh không tồn tại' })

  // Delete from R2
  const privateKeys = [image.originalKey].filter(Boolean)
  const publicKeys = [image.thumbKey, image.previewKey].filter(Boolean) as string[]
  await Promise.all([
    privateKeys.length ? storage().deletePrivate(privateKeys) : Promise.resolve(),
    publicKeys.length ? storage().deletePublic(publicKeys) : Promise.resolve(),
  ])

  // Delete likes and comments
  await db.delete(likes).where(eq(likes.imageId, id))
  await db.delete(comments).where(eq(comments.imageId, id))
  await db.delete(images).where(eq(images.id, id))

  // Update album stats
  await db.update(albums).set({
    imageCount: sql`GREATEST(image_count - 1, 0)`,
    totalBytes: sql`GREATEST(total_bytes - ${image.originalSize}, 0)`,
    updatedAt: new Date(),
  }).where(eq(albums.id, image.albumId))

  // Update quota
  await quotaUtils.subtractUsed(user.sub, image.originalSize)

  // Invalidate cache
  await feedCache.invalidate(`feed:album:${image.albumId}*`)

  res.json({ ok: true })
})

// POST /:id/like
router.post('/:id/like', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params

  const [image] = await db.select().from(images).where(eq(images.id, id)).limit(1)
  if (!image) return res.status(404).json({ message: 'Ảnh không tồn tại' })

  // Check if already liked
  const [existing] = await db.select().from(likes)
    .where(and(eq(likes.userId, user.sub), eq(likes.imageId, id))).limit(1)
  if (existing) return res.json({ ok: true, likeCount: image.likeCount })

  await db.insert(likes).values({ userId: user.sub, imageId: id })
  await db.update(images).set({ likeCount: sql`like_count + 1` }).where(eq(images.id, id))

  // Notify image owner
  if (image.userId !== user.sub) {
    emitToUser(image.userId, { type: 'photo:liked', imageId: id, likedBy: user.email }).catch(() => {})
  }

  res.json({ ok: true, likeCount: image.likeCount + 1 })
})

// DELETE /:id/like
router.delete('/:id/like', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params

  await db.delete(likes).where(and(eq(likes.userId, user.sub), eq(likes.imageId, id)))
  await db.update(images).set({ likeCount: sql`GREATEST(like_count - 1, 0)` }).where(eq(images.id, id))

  const [image] = await db.select({ likeCount: images.likeCount }).from(images).where(eq(images.id, id)).limit(1)
  res.json({ ok: true, likeCount: image?.likeCount ?? 0 })
})

// GET /:id/comments
router.get('/:id/comments', async (req, res) => {
  const { id } = req.params

  if (!isValidUlid(id)) return res.status(400).json({ message: 'ID ảnh không hợp lệ' })

  const commentList = await db.select({
    id: comments.id, content: comments.content, createdAt: comments.createdAt,
    userId: comments.userId, guestName: comments.guestName,
    displayName: users.displayName, avatarKey: users.avatarKey,
  })
  .from(comments)
  .leftJoin(users, eq(comments.userId, users.id))
  .where(eq(comments.imageId, id))
  .orderBy(desc(comments.createdAt))

  res.json({
    comments: commentList.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      userId: c.userId,
      guestName: c.guestName,
      displayName: c.displayName ?? c.guestName ?? 'Khách',
      avatarKey: c.avatarKey,
    })),
  })
})

// POST /:id/comments
router.post('/:id/comments', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params
  const { content } = req.body

  // Validate image ID
  if (!isValidUlid(id)) return res.status(400).json({ message: 'ID ảnh không hợp lệ' })

  if (!content?.trim()) return res.status(400).json({ message: 'Nội dung comment không được để trống' })

  // Sanitize comment content — strip HTML tags and control chars
  const safeContent = sanitizeText(content, 2000)
  if (!safeContent) return res.status(400).json({ message: 'Nội dung comment không hợp lệ' })

  const [image] = await db.select().from(images).where(eq(images.id, id)).limit(1)
  if (!image) return res.status(404).json({ message: 'Ảnh không tồn tại' })

  const commentId = ulid()
  await db.insert(comments).values({
    id: commentId, imageId: id, userId: user.sub, guestName: null, content: safeContent, createdAt: new Date(),
  })
  await db.update(images).set({ commentCount: sql`comment_count + 1` }).where(eq(images.id, id))

  // Notify image owner
  if (image.userId !== user.sub) {
    emitToUser(image.userId, {
      type: 'photo:commented', imageId: id, comment: safeContent, by: user.email,
    }).catch(() => {})
  }

  const [author] = await db.select({ displayName: users.displayName, avatarKey: users.avatarKey })
    .from(users).where(eq(users.id, user.sub)).limit(1)

  res.json({
    id: commentId, content: safeContent, createdAt: new Date(),
    userId: user.sub, displayName: author?.displayName, avatarKey: author?.avatarKey,
  })
})

// GET /:id/download-url
router.get('/:id/download-url', async (req, res) => {
  const user = requirePlan(req, 'basic')
  const { id } = req.params

  const [image] = await db.select().from(images)
    .where(and(eq(images.id, id), eq(images.status, 'ready'))).limit(1)
  if (!image) return res.status(404).json({ message: 'Ảnh không tồn tại' })

  // Check ownership or public album
  if (image.userId !== user.sub) {
    const [album] = await db.select().from(albums)
      .where(and(eq(albums.id, image.albumId), eq(albums.isPublic, true))).limit(1)
    if (!album) return res.status(403).json({ message: 'Không có quyền tải ảnh này' })
  }

  const url = await storage().downloadUrl(image.originalKey, image.originalName)
  res.json({ url })
})

// POST /batch — batch operations (rename, delete)
router.post('/batch', rateLimit('batch', 10, 60), async (req, res) => {
  const user = requireAuth(req)
  const { action, imageIds, pattern, replacement } = req.body

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({ message: 'Chọn ít nhất 1 ảnh' })
  }
  if (imageIds.length > 500) {
    return res.status(400).json({ message: 'Tối đa 500 ảnh mỗi lần' })
  }
  // Validate all IDs
  if (!imageIds.every((id: string) => isValidUlid(id))) {
    return res.status(400).json({ message: 'ID ảnh không hợp lệ' })
  }

  // Verify user owns these images (via album ownership)
  const userImages = await db.select({ id: images.id, albumId: images.albumId, originalName: images.originalName })
    .from(images)
    .innerJoin(albums, eq(images.albumId, albums.id))
    .where(and(inArray(images.id, imageIds), eq(albums.userId, user.sub)))

  if (userImages.length === 0) {
    return res.status(404).json({ message: 'Không tìm thấy ảnh' })
  }

  const validIds = userImages.map(i => i.id)

  if (action === 'rename') {
    if (!pattern && !replacement) {
      return res.status(400).json({ message: 'Cần nhập mẫu đổi tên' })
    }
    let renamed = 0
    for (const img of userImages) {
      let newName = img.originalName
      if (pattern && replacement !== undefined) {
        // Simple find-replace in filename
        newName = newName.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement)
      } else if (replacement) {
        // Replace entire name (keep extension)
        const ext = img.originalName.includes('.') ? '.' + img.originalName.split('.').pop() : ''
        const idx = userImages.indexOf(img)
        newName = `${replacement}_${String(idx + 1).padStart(3, '0')}${ext}`
      }
      if (newName !== img.originalName) {
        await db.update(images).set({ originalName: sanitizeFilename(newName) }).where(eq(images.id, img.id))
        renamed++
      }
    }
    return res.json({ ok: true, action: 'rename', affected: renamed })

  } else if (action === 'delete') {
    // Delete images + R2 files
    const toDelete = await db.select().from(images).where(inArray(images.id, validIds))

    const privateKeys = toDelete.map(i => i.originalKey).filter(Boolean) as string[]
    const publicKeys = toDelete.flatMap(i => [i.thumbKey, i.previewKey].filter(Boolean)) as string[]

    await Promise.all([
      privateKeys.length ? storage().deletePrivate(privateKeys) : Promise.resolve(),
      publicKeys.length ? storage().deletePublic(publicKeys) : Promise.resolve(),
    ])

    await db.delete(images).where(inArray(images.id, validIds))

    // Update album image counts
    const albumIds = [...new Set(toDelete.map(i => i.albumId))]
    for (const albumId of albumIds) {
      const [count] = await db.select({ c: sql<number>`COUNT(*)` }).from(images).where(eq(images.albumId, albumId))
      await db.update(albums).set({ imageCount: count.c }).where(eq(albums.id, albumId))
    }

    // Invalidate feed cache
    for (const albumId of albumIds) {
      await feedCache.invalidate(`feed:album:${albumId}*`)
    }

    return res.json({ ok: true, action: 'delete', affected: toDelete.length })

  } else if (action === 'download') {
    // Stream selected images as ZIP
    const toDownload = await db.select({
      id: images.id,
      originalKey: images.originalKey,
      originalName: images.originalName,
    }).from(images)
      .innerJoin(albums, eq(images.albumId, albums.id))
      .where(and(inArray(images.id, imageIds), eq(albums.userId, user.sub), eq(images.status, 'ready')))

    if (toDownload.length === 0) {
      return res.status(400).json({ message: 'Không có ảnh nào sẵn sàng để tải' })
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="selected_${toDownload.length}_photos.zip"`)

    const archive = archiver('zip', { zlib: { level: 1 } })
    archive.on('error', (err) => {
      logger.error(`[Batch Download] Archive error`, { error: err.message })
      if (!res.headersSent) res.status(500).json({ message: 'Lỗi tạo file ZIP' })
      else res.end()
    })
    archive.pipe(res)

    const usedNames = new Map<string, number>()
    for (const img of toDownload) {
      try {
        const stream = await storage().getStream(img.originalKey)
        let filename = img.originalName || `${img.id}.raw`
        const baseCount = usedNames.get(filename) || 0
        if (baseCount > 0) {
          const ext = filename.lastIndexOf('.')
          const name = ext > 0 ? filename.slice(0, ext) : filename
          const extStr = ext > 0 ? filename.slice(ext) : ''
          filename = `${name}_${baseCount}${extStr}`
        }
        usedNames.set(img.originalName || `${img.id}.raw`, baseCount + 1)
        archive.append(stream, { name: filename })
      } catch (err) {
        logger.warn(`[Batch Download] Failed to stream`, { imageId: img.id, error: (err as Error).message })
      }
    }
    await archive.finalize()

  } else {
    return res.status(400).json({ message: 'Action không hợp lệ (rename | delete | download)' })
  }
})

export default router
