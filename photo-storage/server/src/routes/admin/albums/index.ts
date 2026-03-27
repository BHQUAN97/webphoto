import { Router } from 'express'
import { db } from '../../../utils/db.js'
import { albums, images, users } from '../../../database/schema.js'
import { eq, and, or, desc, lt, like as sqlLike } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { storageFor } from '../../../utils/storage/index.js'
import { adminStats } from '../../../utils/admin-stats.js'
import { feedCache } from '../../../utils/redis.js'

const router = Router()

// GET / — list albums
router.get('/', async (req, res) => {
  requireAdmin(req)
  const { search, visibility, cursor } = req.query
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

  const conditions: unknown[] = []
  if (search) {
    conditions.push(or(
      sqlLike(albums.title, `%${search}%`),
      sqlLike(users.displayName, `%${search}%`),
    ))
  }
  if (visibility === 'public') conditions.push(eq(albums.isPublic, true))
  if (visibility === 'private') conditions.push(eq(albums.isPublic, false))
  if (cursor) conditions.push(lt(albums.id, cursor as string))

  const where = conditions.length > 0 ? and(...conditions as any) : undefined

  const rows = await db.select({
    id: albums.id, title: albums.title, isPublic: albums.isPublic,
    isActive: albums.isActive, imageCount: albums.imageCount,
    totalBytes: albums.totalBytes, createdAt: albums.createdAt,
    userId: albums.userId,
    ownerName: users.displayName, ownerEmail: users.email,
  })
  .from(albums)
  .innerJoin(users, eq(albums.userId, users.id))
  .where(where)
  .orderBy(desc(albums.createdAt))
  .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map(r => ({
    ...r, totalBytes: r.totalBytes.toString(),
  }))
  const nextCursor = hasMore ? items[items.length - 1].id : undefined

  res.json({ items, nextCursor })
})

// PATCH /:id — toggle visibility
router.patch('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { isPublic, isActive } = req.body

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (isPublic !== undefined) updates.isPublic = isPublic
  if (isActive !== undefined) updates.isActive = isActive

  await db.update(albums).set(updates).where(eq(albums.id, id))
  await feedCache.invalidate('feed:public:*')

  await adminStats.log(admin.sub, 'album.update', 'album', id, { updates: req.body })
  res.json({ ok: true })
})

// DELETE /:id — delete album + cascade
router.delete('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params

  const albumImages = await db.select().from(images).where(eq(images.albumId, id))
  if (albumImages.length > 0) {
    // Group by storage backend
    const byBackend = new Map<string, { priv: string[]; pub: string[] }>()
    for (const i of albumImages) {
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
    await db.delete(images).where(eq(images.albumId, id))
  }

  await db.delete(albums).where(eq(albums.id, id))
  await feedCache.invalidate('feed:public:*')

  await adminStats.log(admin.sub, 'album.delete', 'album', id)
  res.json({ ok: true })
})

export default router
