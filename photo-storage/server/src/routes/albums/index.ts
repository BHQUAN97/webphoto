import { Router } from 'express'
import { ulid } from 'ulid'
import crypto from 'crypto'
import archiver from 'archiver'
import { db } from '../../utils/db.js'
import { albums, images, users, userPlans, plans, albumShareTokens } from '../../database/schema.js'
import { eq, and, desc, sql, lt } from 'drizzle-orm'
import { requireAuth, requirePlan } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rateLimit.js'
import { feedCache } from '../../utils/redis.js'
import { storage } from '../../utils/storage/index.js'
import { sanitizeText, isValidUlid } from '../../utils/validate.js'
import { logger } from '../../utils/logger.js'
import { quotaUtils } from '../../utils/quota.js'
import { listFiles, listFilesRecursive, listSubfolders, extractFolderId } from '../../utils/googleDrive.js'
import { driveImportQueue } from '../../plugins/bullmq.js'
import { asyncHandler, fail } from '../../utils/asyncHandler.js'
import bcrypt from 'bcryptjs'

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
router.post('/', asyncHandler(async (req, res) => {
  const user = requireAuth(req)
  const { title, description, isPublic, password, expiresAt, maxFavorites } = req.body

  if (!title) return fail(res, 'Tiêu đề album không được để trống')
  const safeTitle = sanitizeText(title, 200)
  if (!safeTitle) return fail(res, 'Tiêu đề album không hợp lệ')

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
      return fail(res, `Đã đạt giới hạn ${activePlan.maxAlbums} album. Nâng cấp gói để tạo thêm.`, 403)
    }
  }

  // Hash password if provided
  let passwordHash: string | null = null
  if (password && typeof password === 'string' && password.trim()) {
    passwordHash = await bcrypt.hash(password.trim(), 10)
  }

  // Validate expiresAt if provided
  let parsedExpiresAt: Date | null = null
  if (expiresAt) {
    parsedExpiresAt = new Date(expiresAt)
    if (isNaN(parsedExpiresAt.getTime())) return fail(res, 'Ngày hết hạn không hợp lệ')
  }

  // Validate maxFavorites if provided
  let parsedMaxFavorites: number | null = null
  if (maxFavorites !== undefined && maxFavorites !== null && maxFavorites !== '') {
    parsedMaxFavorites = parseInt(String(maxFavorites), 10)
    if (isNaN(parsedMaxFavorites) || parsedMaxFavorites < 0) return fail(res, 'Giới hạn yêu thích không hợp lệ')
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
    passwordHash,
    expiresAt: parsedExpiresAt,
    maxFavorites: parsedMaxFavorites,
  })

  res.json({
    id: albumId, title: safeTitle, description, isPublic: isPublic ?? true,
    hasPassword: !!passwordHash, expiresAt: parsedExpiresAt, maxFavorites: parsedMaxFavorites,
  })
}))

// POST /from-drive — create album from Google Drive folder
router.post('/from-drive', rateLimit('drive-import', 5, 3600), async (req, res) => {
  const user = requireAuth(req)
  const { folderId: rawFolderId, title, includeSubfolders } = req.body

  if (!rawFolderId) {
    return res.status(400).json({ message: 'folderId là bắt buộc' })
  }

  // Extract folder ID from URL or raw ID
  let folderId: string
  try {
    folderId = extractFolderId(rawFolderId)
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message })
  }

  // Dedup: check if album with same driveFolderId already exists for this user
  const [existingAlbum] = await db.select({ id: albums.id })
    .from(albums)
    .where(and(eq(albums.userId, user.sub), eq(albums.driveFolderId, folderId), eq(albums.isActive, true)))
    .limit(1)

  if (existingAlbum) {
    return res.status(409).json({
      message: 'Folder Google Drive này đã được import trước đó',
      existingAlbumId: existingAlbum.id,
    })
  }

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

  // List files from Google Drive (recursive if includeSubfolders)
  let driveFiles
  try {
    driveFiles = includeSubfolders
      ? await listFilesRecursive(folderId)
      : await listFiles(folderId)
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message })
  }

  // List subfolders if requested
  let subfolders: { id: string; name: string }[] = []
  if (includeSubfolders) {
    try {
      subfolders = await listSubfolders(folderId)
    } catch {
      // Non-critical — just skip
    }
  }

  // Create album record (imageCount starts at 0 — worker increments on success)
  const albumId = ulid()
  const albumTitle = title ? sanitizeText(title, 200) : `Google Drive Import`

  await db.insert(albums).values({
    id: albumId,
    userId: user.sub,
    title: albumTitle || 'Google Drive Import',
    driveFolderId: folderId,
    isPublic: false,
    isActive: true,
    imageCount: 0,
    totalBytes: BigInt(0),
  })

  // Handle empty folder
  if (driveFiles.length === 0) {
    logger.info(`[DriveImport] Empty Drive folder`, { userId: user.sub, albumId, folderId })
    return res.json({ albumId, imageCount: 0, subfolders, message: 'Folder rỗng' })
  }

  // Quota pre-check: estimate total size from Drive file sizes
  const estimatedTotalBytes = driveFiles.reduce((sum, f) => sum + BigInt(f.size || 0), BigInt(0))
  const quotaCheck = await quotaUtils.canUpload(user.sub, estimatedTotalBytes)
  if (!quotaCheck.ok) {
    // Remove the empty album we just created
    await db.delete(albums).where(eq(albums.id, albumId))
    return res.status(403).json({
      message: quotaCheck.reason ?? 'Không đủ dung lượng để import toàn bộ folder',
    })
  }

  // Default expiry: 365 days from now
  const expiresAt = new Date(Date.now() + 365 * 24 * 3600_000)

  // Create image records and queue import jobs
  for (const file of driveFiles) {
    const imageId = ulid()
    const originalKey = `${user.sub}/${imageId}/${file.name}`

    await db.insert(images).values({
      id: imageId,
      albumId,
      userId: user.sub,
      originalKey,
      driveFileId: file.id,
      originalName: file.name,
      mimeType: file.mimeType,
      originalSize: BigInt(file.size || 0),
      status: 'syncing',
      expiresAt,
    })

    await driveImportQueue.add('import', {
      imageId,
      userId: user.sub,
      albumId,
      driveFileId: file.id,
      originalKey,
      mimeType: file.mimeType,
      originalName: file.name,
      fileSize: file.size,
    })
  }

  logger.info(`[DriveImport] Album created from Drive folder`, {
    userId: user.sub, albumId, folderId, fileCount: driveFiles.length,
  })

  res.json({
    albumId,
    imageCount: driveFiles.length,
    subfolders,
  })
})

// GET /:id/subfolders — list subfolders if album has driveFolderId
router.get('/:id/subfolders', asyncHandler(async (req, res) => {
  const user = requireAuth(req)
  const id = req.params.id as string

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return fail(res, 'Album không tồn tại', 404)

  if (!album.driveFolderId) {
    return fail(res, 'Album này không liên kết với Google Drive')
  }

  const subfolders = await listSubfolders(album.driveFolderId)
  res.json({ subfolders })
}))

// POST /:id/drive-sync — resync album from Google Drive (add new files only)
router.post('/:id/drive-sync', rateLimit('drive-sync', 5, 3600), async (req, res) => {
  const user = requireAuth(req)
  const id = req.params.id as string

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })
  if (!album.driveFolderId) return res.status(400).json({ message: 'Album không liên kết với Google Drive' })

  // List current Drive files (recursive to include subfolders)
  let driveFiles
  try {
    driveFiles = await listFilesRecursive(album.driveFolderId)
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message })
  }

  // Get existing driveFileIds in this album
  const existingImages = await db.select({ driveFileId: images.driveFileId })
    .from(images).where(eq(images.albumId, id))
  const existingDriveIds = new Set(existingImages.map(i => i.driveFileId).filter(Boolean))

  // Filter only new files
  const newFiles = driveFiles.filter(f => !existingDriveIds.has(f.id))

  if (newFiles.length === 0) {
    return res.json({ newImages: 0, message: 'Không có ảnh mới từ Drive' })
  }

  // Quota check
  const estimatedBytes = newFiles.reduce((sum, f) => sum + BigInt(f.size || 0), BigInt(0))
  const quotaCheck = await quotaUtils.canUpload(user.sub, estimatedBytes)
  if (!quotaCheck.ok) {
    return res.status(403).json({ message: quotaCheck.reason ?? 'Không đủ dung lượng' })
  }

  const expiresAt = new Date(Date.now() + 365 * 24 * 3600_000)

  for (const file of newFiles) {
    const imageId = ulid()
    const originalKey = `${user.sub}/${imageId}/${file.name}`

    await db.insert(images).values({
      id: imageId, albumId: id, userId: user.sub,
      originalKey, driveFileId: file.id, originalName: file.name,
      mimeType: file.mimeType, originalSize: BigInt(file.size || 0),
      status: 'syncing', expiresAt,
    })

    await driveImportQueue.add('import', {
      imageId, userId: user.sub, albumId: id,
      driveFileId: file.id, originalKey,
      mimeType: file.mimeType, originalName: file.name, fileSize: file.size,
    })
  }

  logger.info(`[DriveSync] Resync found new files`, { userId: user.sub, albumId: id, newCount: newFiles.length })
  res.json({ newImages: newFiles.length })
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

  // Don't expose passwordHash — return hasPassword boolean instead
  const { passwordHash, ...albumData } = album
  res.json({
    ...albumData,
    totalBytes: album.totalBytes.toString(),
    hasPassword: !!passwordHash,
    owner,
  })
})

// PATCH /:id — update album
router.patch('/:id', asyncHandler(async (req, res) => {
  const user = requireAuth(req)
  const id = req.params.id as string
  const { title, description, isPublic, coverKey, driveFolderId, password, expiresAt, maxFavorites } = req.body

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return fail(res, 'Album không tồn tại', 404)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = String(title).slice(0, 200)
  if (description !== undefined) updates.description = String(description).slice(0, 2000)
  if (isPublic !== undefined) updates.isPublic = isPublic
  if (coverKey !== undefined) updates.coverKey = coverKey
  if (driveFolderId !== undefined) {
    if (driveFolderId === null) {
      updates.driveFolderId = null
    } else if (typeof driveFolderId === 'string' && /^[a-zA-Z0-9_-]+$/.test(driveFolderId)) {
      updates.driveFolderId = driveFolderId
    } else {
      return fail(res, 'Drive folder ID không hợp lệ')
    }
  }

  // Handle password update
  if (password !== undefined) {
    if (password === null || password === '') {
      updates.passwordHash = null
    } else if (typeof password === 'string' && password.trim()) {
      updates.passwordHash = await bcrypt.hash(password.trim(), 10)
    }
  }

  // Handle expiresAt update
  if (expiresAt !== undefined) {
    if (expiresAt === null) {
      updates.expiresAt = null
    } else {
      const parsed = new Date(expiresAt)
      if (isNaN(parsed.getTime())) return fail(res, 'Ngày hết hạn không hợp lệ')
      updates.expiresAt = parsed
    }
  }

  // Handle maxFavorites update
  if (maxFavorites !== undefined) {
    if (maxFavorites === null || maxFavorites === '') {
      updates.maxFavorites = null
    } else {
      const parsed = parseInt(String(maxFavorites), 10)
      if (isNaN(parsed) || parsed < 0) return fail(res, 'Giới hạn yêu thích không hợp lệ')
      updates.maxFavorites = parsed
    }
  }

  await db.update(albums).set(updates).where(eq(albums.id, id))

  // Invalidate feed cache
  await feedCache.invalidate(`feed:album:${id}*`)
  await feedCache.invalidate('feed:public:*')

  const [updated] = await db.select({
    id: albums.id,
    title: albums.title,
    description: albums.description,
    isPublic: albums.isPublic,
    coverKey: albums.coverKey,
    driveFolderId: albums.driveFolderId,
    imageCount: albums.imageCount,
    createdAt: albums.createdAt,
    updatedAt: albums.updatedAt,
    expiresAt: albums.expiresAt,
    maxFavorites: albums.maxFavorites,
    passwordHash: albums.passwordHash,
  }).from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  const { passwordHash: pwHash, ...updatedData } = updated!
  res.json({ ...updatedData, hasPassword: !!pwHash })
}))

// POST /:id/verify-password — verify album password for shared view
router.post('/:id/verify-password', asyncHandler(async (req, res) => {
  const id = req.params.id as string
  const { password } = req.body

  if (!password || typeof password !== 'string') return fail(res, 'Mật khẩu không được để trống')

  const [album] = await db.select({ passwordHash: albums.passwordHash })
    .from(albums)
    .where(and(eq(albums.id, id), eq(albums.isActive, true)))
    .limit(1)

  if (!album) return fail(res, 'Album không tồn tại', 404)
  if (!album.passwordHash) return fail(res, 'Album không yêu cầu mật khẩu')

  const match = await bcrypt.compare(password, album.passwordHash)
  if (!match) return fail(res, 'Mật khẩu không đúng', 403)

  res.json({ success: true, message: 'Xác thực thành công' })
}))

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
  const { allowLike, allowComment, allowDownload } = req.body ?? {}

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  // Check if share token already exists
  const [existing] = await db.select().from(albumShareTokens)
    .where(eq(albumShareTokens.albumId, id)).limit(1)

  if (existing) {
    return res.json({
      token: existing.token,
      expiresAt: existing.expiresAt,
      permissions: {
        allowLike: existing.allowLike,
        allowComment: existing.allowComment,
        allowDownload: existing.allowDownload,
      },
    })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const shareId = ulid()

  await db.insert(albumShareTokens).values({
    id: shareId,
    albumId: id,
    token,
    allowLike: allowLike ?? true,
    allowComment: allowComment ?? true,
    allowDownload: allowDownload ?? true,
    expiresAt: null, // no expiry by default
  })

  res.json({
    token,
    expiresAt: null,
    permissions: {
      allowLike: allowLike ?? true,
      allowComment: allowComment ?? true,
      allowDownload: allowDownload ?? true,
    },
  })
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

  res.json({
    token: token?.token ?? null,
    expiresAt: token?.expiresAt ?? null,
    permissions: token ? {
      allowLike: token.allowLike,
      allowComment: token.allowComment,
      allowDownload: token.allowDownload,
    } : null,
  })
})

// PATCH /:id/share — update share permissions on existing token
router.patch('/:id/share', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params
  const { allowLike, allowComment, allowDownload } = req.body

  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.userId, user.sub))).limit(1)

  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  const [existing] = await db.select().from(albumShareTokens)
    .where(eq(albumShareTokens.albumId, id)).limit(1)

  if (!existing) return res.status(404).json({ message: 'Chưa có link chia sẻ cho album này' })

  const updates: Record<string, unknown> = {}
  if (typeof allowLike === 'boolean') updates.allowLike = allowLike
  if (typeof allowComment === 'boolean') updates.allowComment = allowComment
  if (typeof allowDownload === 'boolean') updates.allowDownload = allowDownload

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Không có thông tin cần cập nhật' })
  }

  await db.update(albumShareTokens).set(updates).where(eq(albumShareTokens.id, existing.id))

  // Fetch updated record
  const [updated] = await db.select().from(albumShareTokens)
    .where(eq(albumShareTokens.id, existing.id)).limit(1)

  res.json({
    token: updated.token,
    expiresAt: updated.expiresAt,
    permissions: {
      allowLike: updated.allowLike,
      allowComment: updated.allowComment,
      allowDownload: updated.allowDownload,
    },
  })
})

// POST /:id/download-zip — batch download album as ZIP
const MAX_BATCH_SIZE = 100

router.post('/:id/download-zip', async (req, res) => {
  const user = requirePlan(req, 'basic')
  const { id } = req.params
  if (!isValidUlid(id)) return res.status(400).json({ message: 'ID album không hợp lệ' })

  // Verify album exists and user has access (owner or public)
  const [album] = await db.select().from(albums)
    .where(and(eq(albums.id, id), eq(albums.isActive, true))).limit(1)
  if (!album) return res.status(404).json({ message: 'Album không tồn tại' })

  if (album.userId !== user.sub && !album.isPublic) {
    return res.status(403).json({ message: 'Không có quyền tải album này' })
  }

  // Get all ready images in the album
  const readyImages = await db.select({
    id: images.id,
    originalKey: images.originalKey,
    originalName: images.originalName,
    originalSize: images.originalSize,
  }).from(images)
    .where(and(eq(images.albumId, id), eq(images.status, 'ready')))
    .orderBy(desc(images.createdAt))

  if (readyImages.length === 0) {
    return res.status(400).json({ message: 'Không có ảnh nào sẵn sàng để tải' })
  }

  // Optional: client can request a specific batch
  const batchIndex = parseInt(req.body.batch as string) || 0

  // If > MAX_BATCH_SIZE and no batch specified, return batch info
  if (readyImages.length > MAX_BATCH_SIZE && req.body.batch === undefined) {
    const totalBatches = Math.ceil(readyImages.length / MAX_BATCH_SIZE)
    const batches = []
    for (let i = 0; i < totalBatches; i++) {
      const start = i * MAX_BATCH_SIZE
      const end = Math.min(start + MAX_BATCH_SIZE, readyImages.length)
      batches.push({
        batch: i,
        count: end - start,
        url: `/api/albums/${id}/download-zip`,
      })
    }
    return res.json({
      mode: 'multi-batch',
      totalImages: readyImages.length,
      totalBatches,
      batches,
    })
  }

  // Determine which images to include in this batch
  const start = batchIndex * MAX_BATCH_SIZE
  const batchImages = readyImages.slice(start, start + MAX_BATCH_SIZE)

  if (batchImages.length === 0) {
    return res.status(400).json({ message: 'Batch không hợp lệ' })
  }

  const safeTitle = (album.title || 'album').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF _-]/g, '_')
  const batchSuffix = readyImages.length > MAX_BATCH_SIZE ? `_part${batchIndex + 1}` : ''
  const zipFilename = `${safeTitle}${batchSuffix}.zip`

  logger.info(`[Download ZIP] Starting`, {
    userId: user.sub,
    albumId: id,
    batch: batchIndex,
    imageCount: batchImages.length,
    totalImages: readyImages.length,
  })

  // Set response headers for ZIP stream
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`)

  const archive = archiver('zip', { zlib: { level: 1 } }) // level 1 for speed (images are already compressed)

  archive.on('error', (err) => {
    logger.error(`[Download ZIP] Archive error`, { albumId: id, error: err.message })
    if (!res.headersSent) {
      res.status(500).json({ message: 'Lỗi tạo file ZIP' })
    } else {
      res.end()
    }
  })

  archive.on('warning', (err) => {
    logger.warn(`[Download ZIP] Archive warning`, { albumId: id, error: err.message })
  })

  // Pipe archive to response
  archive.pipe(res)

  // Track filenames to avoid duplicates
  const usedNames = new Map<string, number>()
  let skippedCount = 0

  for (const img of batchImages) {
    try {
      const stream = await storage().getStream(img.originalKey)

      // Generate unique filename within ZIP
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
      skippedCount++
      logger.warn(`[Download ZIP] Failed to stream image`, {
        imageId: img.id,
        key: img.originalKey,
        error: (err as Error).message,
      })
    }
  }

  await archive.finalize()

  logger.info(`[Download ZIP] Completed`, {
    userId: user.sub,
    albumId: id,
    batch: batchIndex,
    imageCount: batchImages.length,
    skippedCount,
  })
})

export default router
