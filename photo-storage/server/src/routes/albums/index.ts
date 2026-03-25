import { Router } from 'express'
import { ulid } from 'ulid'
import crypto from 'crypto'
import { db } from '../../utils/db.js'
import { albums, images, users, userPlans, plans, albumShareTokens } from '../../database/schema.js'
import { eq, and, desc, sql, lt } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'
import { feedCache } from '../../utils/redis.js'
import { storage } from '../../utils/storage/index.js'
import { sanitizeText, isValidUlid, clampInt } from '../../utils/validate.js'

const router = Router()

// GET / — public feed (public albums)
router.get('/', async (req, res) => {
  const cursor = req.query.cursor as string | undefined
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

  const cacheKey = `feed:public:${cursor ?? 'start'}`
  const cached = await feedCache.get<unknown>(cacheKey)
  if (cached) return res.json(cached)

  let query = db.select({
    id: albums.id, title: albums.title, description: albums.description,
    coverKey: albums.coverKey, imageCount: albums.imageCount,
    createdAt: albums.createdAt,
    userId: albums.userId,
    displayName: users.displayName, avatarKey: users.avatarKey,
  })
  .from(albums)
  .innerJoin(users, eq(albums.userId, users.id))
  .where(and(eq(albums.isPublic, true), eq(albums.isActive, true)))
  .orderBy(desc(albums.createdAt))
  .limit(limit + 1)

  if (cursor) {
    query = db.select({
      id: albums.id, title: albums.title, description: albums.description,
      coverKey: albums.coverKey, imageCount: albums.imageCount,
      createdAt: albums.createdAt,
      userId: albums.userId,
      displayName: users.displayName, avatarKey: users.avatarKey,
    })
    .from(albums)
    .innerJoin(users, eq(albums.userId, users.id))
    .where(and(
      eq(albums.isPublic, true), eq(albums.isActive, true),
      lt(albums.id, cursor),
    ))
    .orderBy(desc(albums.createdAt))
    .limit(limit + 1)
  }

  const rows = await query
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : undefined

  const result = { items, nextCursor }
  await feedCache.set(cacheKey, result, 300)
  res.json(result)
})

// POST / — create album
router.post('/', async (req, res) => {
  const user = requireAuth(req)
  const { title, description, isPublic } = req.body

  if (!title) return res.status(400).json({ message: 'Tiêu đề album không được để trống' })
  const safeTitle = sanitizeText(title, 200)
  if (!safeTitle) return res.status(400).json({ message: 'Tiêu đề album không hợp lệ' })

  // Check album limit
  const [activePlan] = await db
    .select({ maxAlbums: plans.maxAlbums })
    .from(userPlans)
    .innerJoin(plans, eq(userPlans.planId, plans.id))
    .where(and(eq(userPlans.userId, user.sub), eq(userPlans.isActive, true)))
    .limit(1)

  if (activePlan?.maxAlbums !== null && activePlan?.maxAlbums !== undefined) {
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(albums).where(eq(albums.userId, user.sub))
    if (count >= activePlan.maxAlbums) {
      return res.status(403).json({ message: `Đã đạt giới hạn ${activePlan.maxAlbums} album. Nâng cấp gói để tạo thêm.` })
    }
  }

  const albumId = ulid()
  await db.insert(albums).values({
    id: albumId,
    userId: user.sub,
    title: safeTitle,
    description: description ? sanitizeText(description, 1000) : null,
    isPublic: isPublic ?? true,
    isActive: true,
    imageCount: 0,
    totalBytes: BigInt(0),
  })

  res.json({ id: albumId, title, description, isPublic: isPublic ?? true })
})

// GET /:id — album detail with images
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.isActive, true))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  // Check access: public or owner
  if (!album.isPublic) {
    if (!req.user || req.user.sub !== album.userId) {
      return res.status(403).json({ message: 'Album riêng tư' })
    }
  }

  const [owner] = await db.select({
    displayName: users.displayName, avatarKey: users.avatarKey,
  }).from(users).where(eq(users.id, album.userId)).limit(1)

  res.json({
    ...album,
    totalBytes: album.totalBytes.toString(),
    owner,
  })
})

// PATCH /:id — update album
router.patch('/:id', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params
  const { title, description, isPublic, coverKey } = req.body

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (isPublic !== undefined) updates.isPublic = isPublic
  if (coverKey !== undefined) updates.coverKey = coverKey

  await db.update(albums).set(updates).where(eq(albums.id, id))

  // Invalidate feed cache
  await feedCache.invalidate(`feed:album:${id}*`)
  await feedCache.invalidate('feed:public:*')

  res.json({ ok: true })
})

// DELETE /:id — delete album + cascade images
router.delete('/:id', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  // Get all images to delete from R2
  const albumImages = await db.select().from(images).where(eq(images.albumId, id))

  if (albumImages.length > 0) {
    const privateKeys = albumImages.map(i => i.originalKey).filter(Boolean)
    const publicKeys = albumImages.flatMap(i =>
      [i.thumbKey, i.previewKey].filter(Boolean) as string[]
    )

    await Promise.all([
      privateKeys.length ? storage().deletePrivate(privateKeys) : Promise.resolve(),
      publicKeys.length ? storage().deletePublic(publicKeys) : Promise.resolve(),
    ])

    await db.delete(images).where(eq(images.albumId, id))
  }

  await db.delete(albums).where(eq(albums.id, id))

  // Invalidate cache
  await feedCache.invalidate(`feed:album:${id}*`)
  await feedCache.invalidate('feed:public:*')

  res.json({ ok: true })
})

// POST /:id/share — generate share link
router.post('/:id/share', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  // Check if share token already exists
  const [existing] = await db.select().from(albumShareTokens)
    .where(eq(albumShareTokens.albumId, id)).limit(1)

  if (existing) {
    return res.json({ token: existing.token, expiresAt: existing.expiresAt })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const shareId = ulid()

  await db.insert(albumShareTokens).values({
    id: shareId,
    albumId: id,
    token,
    expiresAt: null, // no expiry by default
  })

  res.json({ token, expiresAt: null })
})

// DELETE /:id/share — revoke share link
router.delete('/:id/share', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  await db.delete(albumShareTokens).where(eq(albumShareTokens.albumId, id))

  res.json({ ok: true })
})

// GET /:id/share — get current share token
router.get('/:id/share', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  const [token] = await db.select().from(albumShareTokens)
    .where(eq(albumShareTokens.albumId, id)).limit(1)

  res.json({ token: token?.token ?? null, expiresAt: token?.expiresAt ?? null })
})

export default router
