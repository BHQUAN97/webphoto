import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../utils/db.js'
import { albums, images, users, albumShareTokens, comments } from '../../database/schema.js'
import { eq, and, desc, sql, lt } from 'drizzle-orm'
import { clampInt, isValidUlid } from '../../utils/validate.js'
import { storage } from '../../utils/storage/index.js'
import { sanitizeText } from '../../utils/validate.js'

const router = Router()

// ─── Helper: validate share token and return share row ───────────────────────
async function validateShareToken(token: string) {
  const [share] = await db.select().from(albumShareTokens)
    .where(eq(albumShareTokens.token, token)).limit(1)

  if (!share) return { error: { status: 404, message: 'Link chia sẻ không tồn tại' } }
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return { error: { status: 410, message: 'Link chia sẻ đã hết hạn' } }
  }
  return { share }
}

// ─── Helper: validate image belongs to shared album ──────────────────────────
async function validateSharedImage(imageId: string, albumId: string) {
  const [image] = await db.select().from(images)
    .where(and(eq(images.id, imageId), eq(images.albumId, albumId))).limit(1)
  if (!image) return { error: { status: 404, message: 'Ảnh không tồn tại' } }
  return { image }
}

// GET /:token — view shared album (no auth required)
router.get('/:token', async (req, res) => {
  const { token } = req.params

  const result = await validateShareToken(token)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const share = result.share!

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, share.albumId), eq(albums.isActive, true))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  const [owner] = await db.select({
    displayName: users.displayName, avatarKey: users.avatarKey,
  }).from(users).where(eq(users.id, album.userId)).limit(1)

  // Pagination support
  const limit = clampInt(req.query.limit, 1, 100, 30)
  const cursor = req.query.cursor as string | undefined

  const conditions: unknown[] = [eq(images.albumId, share.albumId)]
  if (cursor && isValidUlid(cursor)) {
    conditions.push(lt(images.id, cursor))
  }

  // Get album images
  const albumImages = await db.select({
    id: images.id, thumbKey: images.thumbKey, previewKey: images.previewKey,
    originalName: images.originalName, originalSize: images.originalSize,
    width: images.width, height: images.height,
    status: images.status, likeCount: images.likeCount, commentCount: images.commentCount,
    createdAt: images.createdAt,
  })
  .from(images)
  .where(and(...conditions as any))
  .orderBy(desc(images.createdAt))
  .limit(limit + 1)

  const hasMore = albumImages.length > limit
  const items = albumImages.slice(0, limit)
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  const imageItems = items.map(img => ({
    ...img,
    originalSize: img.originalSize.toString(),
    thumbUrl: img.thumbKey ? storage().publicUrl(img.thumbKey) : null,
    previewUrl: img.previewKey ? storage().publicUrl(img.previewKey) : null,
  }))

  // Get total likes + total image count
  const [stats] = await db.select({
    totalLikes: sql<number>`CAST(COALESCE(SUM(${images.likeCount}), 0) AS UNSIGNED)`,
    totalImages: sql<number>`COUNT(*)`,
  }).from(images).where(eq(images.albumId, share.albumId))

  res.json({
    album: {
      ...album,
      totalBytes: album.totalBytes.toString(),
      totalLikes: Number(stats?.totalLikes ?? 0),
      owner,
    },
    images: imageItems,
    totalImages: Number(stats?.totalImages ?? 0),
    nextCursor,
    permissions: {
      allowLike: share.allowLike,
      allowComment: share.allowComment,
      allowDownload: share.allowDownload,
    },
  })
})

// POST /:token/images/:imageId/like — guest like (no auth, increments count)
router.post('/:token/images/:imageId/like', async (req, res) => {
  const { token, imageId } = req.params

  const result = await validateShareToken(token)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const share = result.share!

  // Check allowLike permission
  if (!share.allowLike) {
    return res.status(403).json({ message: 'Chức năng thích đã bị tắt cho link chia sẻ này' })
  }

  const imgResult = await validateSharedImage(imageId, share.albumId)
  if (imgResult.error) return res.status(imgResult.error.status).json({ message: imgResult.error.message })
  const image = imgResult.image!

  await db.update(images).set({ likeCount: sql`like_count + 1` }).where(eq(images.id, imageId))
  res.json({ ok: true, likeCount: image.likeCount + 1 })
})

// DELETE /:token/images/:imageId/like — guest unlike
router.delete('/:token/images/:imageId/like', async (req, res) => {
  const { token, imageId } = req.params

  const result = await validateShareToken(token)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const share = result.share!

  // Check allowLike permission
  if (!share.allowLike) {
    return res.status(403).json({ message: 'Chức năng thích đã bị tắt cho link chia sẻ này' })
  }

  const imgResult = await validateSharedImage(imageId, share.albumId)
  if (imgResult.error) return res.status(imgResult.error.status).json({ message: imgResult.error.message })

  await db.update(images).set({ likeCount: sql`GREATEST(like_count - 1, 0)` }).where(eq(images.id, imageId))
  const [updated] = await db.select({ likeCount: images.likeCount }).from(images).where(eq(images.id, imageId)).limit(1)
  res.json({ ok: true, likeCount: updated?.likeCount ?? 0 })
})

// GET /:token/images/:imageId/comments — list comments for shared image
router.get('/:token/images/:imageId/comments', async (req, res) => {
  const { token, imageId } = req.params

  const result = await validateShareToken(token)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const share = result.share!

  const imgResult = await validateSharedImage(imageId, share.albumId)
  if (imgResult.error) return res.status(imgResult.error.status).json({ message: imgResult.error.message })

  // Fetch comments — LEFT JOIN users for registered user info, guest comments have userId=null
  const commentList = await db.select({
    id: comments.id,
    content: comments.content,
    createdAt: comments.createdAt,
    userId: comments.userId,
    guestName: comments.guestName,
    displayName: users.displayName,
    avatarKey: users.avatarKey,
  })
  .from(comments)
  .leftJoin(users, eq(comments.userId, users.id))
  .where(eq(comments.imageId, imageId))
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

// POST /:token/images/:imageId/comments — guest comment (no auth required)
router.post('/:token/images/:imageId/comments', async (req, res) => {
  const { token, imageId } = req.params
  const { guestName, content } = req.body

  const result = await validateShareToken(token)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const share = result.share!

  // Check allowComment permission
  if (!share.allowComment) {
    return res.status(403).json({ message: 'Chức năng bình luận đã bị tắt cho link chia sẻ này' })
  }

  // Validate guestName
  if (!guestName || typeof guestName !== 'string' || guestName.trim().length === 0) {
    return res.status(400).json({ message: 'Tên người bình luận không được để trống' })
  }
  if (guestName.trim().length > 50) {
    return res.status(400).json({ message: 'Tên người bình luận không được vượt quá 50 ký tự' })
  }

  // Validate content
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ message: 'Nội dung bình luận không được để trống' })
  }

  const safeContent = sanitizeText(content, 2000)
  if (!safeContent) return res.status(400).json({ message: 'Nội dung bình luận không hợp lệ' })

  const safeGuestName = sanitizeText(guestName, 50)
  if (!safeGuestName) return res.status(400).json({ message: 'Tên người bình luận không hợp lệ' })

  // Validate image belongs to shared album
  const imgResult = await validateSharedImage(imageId, share.albumId)
  if (imgResult.error) return res.status(imgResult.error.status).json({ message: imgResult.error.message })

  const commentId = ulid()
  await db.insert(comments).values({
    id: commentId,
    imageId,
    userId: null,
    guestName: safeGuestName,
    content: safeContent,
    createdAt: new Date(),
  })

  // Update comment count
  await db.update(images).set({ commentCount: sql`comment_count + 1` }).where(eq(images.id, imageId))

  res.json({
    id: commentId,
    content: safeContent,
    createdAt: new Date(),
    userId: null,
    guestName: safeGuestName,
    displayName: safeGuestName,
    avatarKey: null,
  })
})

// GET /:token/images/:imageId/download-url — guest download (no auth, no plan check)
router.get('/:token/images/:imageId/download-url', async (req, res) => {
  const { token, imageId } = req.params

  const result = await validateShareToken(token)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const share = result.share!

  // Check allowDownload permission
  if (!share.allowDownload) {
    return res.status(403).json({ message: 'Chức năng tải xuống đã bị tắt cho link chia sẻ này' })
  }

  // Validate image belongs to shared album and is ready
  const [image] = await db.select().from(images)
    .where(and(eq(images.id, imageId), eq(images.albumId, share.albumId), eq(images.status, 'ready')))
    .limit(1)

  if (!image) return res.status(404).json({ message: 'Ảnh không tồn tại hoặc chưa sẵn sàng' })

  // Return proxy download URL
  res.json({ url: `/api/share/${token}/images/${imageId}/download` })
})

// GET /:token/images/:imageId/download — proxy download for shared album
router.get('/:token/images/:imageId/download', async (req, res) => {
  const { token, imageId } = req.params

  const result = await validateShareToken(token)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const share = result.share!

  if (!share.allowDownload) {
    return res.status(403).json({ message: 'Chức năng tải xuống đã bị tắt' })
  }

  const [image] = await db.select().from(images)
    .where(and(eq(images.id, imageId), eq(images.albumId, share.albumId), eq(images.status, 'ready')))
    .limit(1)
  if (!image) return res.status(404).json({ message: 'Ảnh không tồn tại' })

  const stream = await storage().getStream(image.originalKey)
  const safeName = encodeURIComponent(image.originalName || 'image')
  res.set('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`)
  res.set('Content-Type', image.mimeType || 'application/octet-stream')
  if (image.originalSize) res.set('Content-Length', image.originalSize.toString())
  stream.pipe(res)
})

export default router
