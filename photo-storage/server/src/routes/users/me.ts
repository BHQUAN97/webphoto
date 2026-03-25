import { Router } from 'express'
import { db } from '../../utils/db.js'
import { users, userPlans, plans, albums, images, likes, comments, payments } from '../../database/schema.js'
import { eq, and, sql, desc } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'
import { hashPassword, verifyPassword } from '../../utils/hash.js'
import { quotaRedis } from '../../utils/redis.js'
import { quotaUtils } from '../../utils/quota.js'
import { sanitizeText, isValidDisplayName, isValidPassword } from '../../utils/validate.js'
import { storage } from '../../utils/storage/index.js'
import { ulid } from 'ulid'

const router = Router()

// GET /api/users/me — profile + plan info
router.get('/me', async (req, res) => {
  const user = requireAuth(req)

  const [profile] = await db.select({
    id: users.id, email: users.email, displayName: users.displayName,
    avatarKey: users.avatarKey, bio: users.bio, role: users.role,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, user.sub)).limit(1)

  if (!profile) return res.status(404).json({ message: 'User not found' })

  const [activePlan] = await db
    .select({ code: plans.code, name: plans.name, expiresAt: userPlans.expiresAt })
    .from(userPlans)
    .innerJoin(plans, eq(userPlans.planId, plans.id))
    .where(and(eq(userPlans.userId, user.sub), eq(userPlans.isActive, true)))
    .limit(1)

  res.json({
    ...profile,
    planCode: activePlan?.code ?? 'free',
    planName: activePlan?.name ?? 'Free',
    planExpiresAt: activePlan?.expiresAt ?? null,
  })
})

// PATCH /api/users/me — update profile / password
router.patch('/me', async (req, res) => {
  const user = requireAuth(req)
  const { displayName, bio, avatarKey, currentPassword, newPassword } = req.body

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (displayName !== undefined) {
    if (!isValidDisplayName(displayName)) {
      return res.status(400).json({ message: 'Tên hiển thị không hợp lệ (1-100 ký tự)' })
    }
    updates.displayName = sanitizeText(displayName, 100)
  }
  if (bio !== undefined) updates.bio = sanitizeText(bio, 500)
  if (avatarKey !== undefined) updates.avatarKey = avatarKey

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ message: 'Cần nhập mật khẩu hiện tại' })
    }
    // Validate new password strength
    const pwCheck = isValidPassword(newPassword)
    if (!pwCheck.ok) {
      return res.status(400).json({ message: pwCheck.reason })
    }
    const [current] = await db.select({ passwordHash: users.passwordHash })
      .from(users).where(eq(users.id, user.sub)).limit(1)
    if (!current?.passwordHash) {
      return res.status(400).json({ message: 'Không thể đổi mật khẩu' })
    }
    const valid = await verifyPassword(currentPassword, current.passwordHash)
    if (!valid) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' })
    }
    updates.passwordHash = await hashPassword(newPassword)
  }

  await db.update(users).set(updates).where(eq(users.id, user.sub))
  res.json({ ok: true })
})

// POST /api/users/me/avatar — upload avatar via presigned URL
router.post('/me/avatar', async (req, res) => {
  const user = requireAuth(req)
  const { mimeType } = req.body

  if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return res.status(400).json({ message: 'Chỉ hỗ trợ JPEG, PNG, WebP' })
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const key = `avatars/${user.sub}/${ulid()}.${ext}`

  const url = await storage().presignUpload(key, mimeType)

  res.json({ url, key })
})

// GET /api/users/me/storage
router.get('/me/storage', async (req, res) => {
  const user = requireAuth(req)
  const [used, limit] = await Promise.all([
    quotaRedis.getUsed(user.sub),
    quotaUtils.getTotalQuota(user.sub),
  ])
  res.json({ usedBytes: used.toString(), limitBytes: limit.toString() })
})

// GET /api/users/me/albums — supports ?limit=N
router.get('/me/albums', async (req, res) => {
  const user = requireAuth(req)
  const queryLimit = req.query.limit ? Math.min(parseInt(req.query.limit as string) || 100, 200) : undefined

  const [activePlan] = await db
    .select({ expiresAt: userPlans.expiresAt })
    .from(userPlans)
    .where(and(eq(userPlans.userId, user.sub), eq(userPlans.isActive, true)))
    .limit(1)

  let query = db.select().from(albums)
    .where(eq(albums.userId, user.sub))
    .orderBy(desc(albums.createdAt))

  if (queryLimit) {
    query = query.limit(queryLimit) as typeof query
  }

  const myAlbums = await query

  res.json({
    albums: myAlbums.map(a => ({
      ...a,
      totalBytes: a.totalBytes.toString(),
      expiresAt: activePlan?.expiresAt ?? null,
    })),
  })
})

// GET /api/users/me/stats
router.get('/me/stats', async (req, res) => {
  const user = requireAuth(req)

  // Single query with CASE — replaces 6 separate queries
  const [[imageStats], [albumCount]] = await Promise.all([
    db.select({
      totalImages:      sql<number>`COUNT(*)`,
      processingImages: sql<number>`SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END)`,
      failedImages:     sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
      totalLikes:       sql<number>`COALESCE(SUM(like_count), 0)`,
      totalComments:    sql<number>`COALESCE(SUM(comment_count), 0)`,
    }).from(images).where(eq(images.userId, user.sub)),
    db.select({ c: sql<number>`COUNT(*)` }).from(albums).where(eq(albums.userId, user.sub)),
  ])

  res.json({
    totalImages: imageStats.totalImages,
    processingImages: imageStats.processingImages,
    failedImages: imageStats.failedImages,
    totalAlbums: albumCount.c,
    totalLikes: imageStats.totalLikes,
    totalComments: imageStats.totalComments,
  })
})

// GET /api/users/me/payments
router.get('/me/payments', async (req, res) => {
  const user = requireAuth(req)

  const paymentList = await db.select({
    id: payments.id,
    referenceCode: payments.referenceCode,
    amountVnd: payments.amountVnd,
    status: payments.status,
    createdAt: payments.createdAt,
    paidAt: payments.paidAt,
    planName: plans.name,
  })
  .from(payments)
  .leftJoin(plans, eq(payments.planId, plans.id))
  .where(eq(payments.userId, user.sub))
  .orderBy(desc(payments.createdAt))

  res.json({ payments: paymentList })
})

export default router
