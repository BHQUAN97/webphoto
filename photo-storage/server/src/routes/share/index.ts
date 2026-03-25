import { Router } from 'express'
import { db } from '../../utils/db.js'
import { albums, images, users, albumShareTokens } from '../../database/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { storage } from '../../utils/storage/index.js'

const router = Router()

// GET /:token — view shared album (no auth required)
router.get('/:token', async (req, res) => {
  const { token } = req.params

  const [share] = await db.select().from(albumShareTokens)
    .where(eq(albumShareTokens.token, token)).limit(1)

  if (!share) return res.status(404).json({ message: 'Link chia sẻ không tồn tại' })

  // Check expiry
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return res.status(410).json({ message: 'Link chia sẻ đã hết hạn' })
  }

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, share.albumId), eq(albums.isActive, true))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  const [owner] = await db.select({
    displayName: users.displayName, avatarKey: users.avatarKey,
  }).from(users).where(eq(users.id, album.userId)).limit(1)

  // Get album images
  const albumImages = await db.select({
    id: images.id, thumbKey: images.thumbKey, previewKey: images.previewKey,
    originalName: images.originalName, originalSize: images.originalSize,
    width: images.width, height: images.height,
    status: images.status, likeCount: images.likeCount, commentCount: images.commentCount,
    createdAt: images.createdAt,
  })
  .from(images)
  .where(eq(images.albumId, share.albumId))
  .orderBy(desc(images.createdAt))
  .limit(200)

  const imageItems = albumImages.map(img => ({
    ...img,
    originalSize: img.originalSize.toString(),
    thumbUrl: img.thumbKey ? storage().publicUrl(img.thumbKey) : null,
    previewUrl: img.previewKey ? storage().publicUrl(img.previewKey) : null,
  }))

  res.json({
    album: {
      ...album,
      totalBytes: album.totalBytes.toString(),
      owner,
    },
    images: imageItems,
  })
})

export default router
