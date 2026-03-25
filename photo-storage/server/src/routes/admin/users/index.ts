import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../../utils/db.js'
import { users, userPlans, plans, albums, images, payments, likes, comments, refreshTokens } from '../../../database/schema.js'
import { eq, and, or, sql, desc, asc, lt, like as sqlLike } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { quotaRedis } from '../../../utils/redis.js'
import { quotaUtils } from '../../../utils/quota.js'
import { adminStats } from '../../../utils/admin-stats.js'
import { sanitizeSearch, isValidUlid, clampInt } from '../../../utils/validate.js'

const router = Router()

// GET / — list users with search, filter, pagination
router.get('/', async (req, res) => {
  const admin = requireAdmin(req)
  const { search, planCode, status, sortBy, cursor } = req.query
  const limit = clampInt(req.query.limit, 1, 50, 20)

  const conditions: unknown[] = []

  // Sanitize search to prevent LIKE injection
  if (search) {
    const safeSearch = sanitizeSearch(search as string)
    if (safeSearch) {
      conditions.push(or(
        sqlLike(users.displayName, `%${safeSearch}%`),
        sqlLike(users.email, `%${safeSearch}%`),
      ))
    }
  }
  if (status === 'active') conditions.push(eq(users.isActive, true))
  if (status === 'banned') conditions.push(eq(users.isActive, false))
  if (cursor) {
    if (!isValidUlid(cursor as string)) return res.status(400).json({ message: 'cursor không hợp lệ' })
    conditions.push(lt(users.id, cursor as string))
  }

  let orderByClause
  switch (sortBy) {
    case 'name':    orderByClause = asc(users.displayName); break
    case 'oldest':  orderByClause = asc(users.createdAt); break
    default:        orderByClause = desc(users.createdAt)
  }

  const where = conditions.length > 0 ? and(...conditions as any) : undefined

  // Single JOIN query — avoid N+1
  const rows = await db.select({
    id: users.id, email: users.email, displayName: users.displayName,
    avatarKey: users.avatarKey, role: users.role, isActive: users.isActive,
    createdAt: users.createdAt,
    planCode: plans.code,
    planName: plans.name,
  })
  .from(users)
  .leftJoin(userPlans, and(eq(userPlans.userId, users.id), eq(userPlans.isActive, true)))
  .leftJoin(plans, eq(userPlans.planId, plans.id))
  .where(where)
  .orderBy(orderByClause)
  .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : undefined

  // Batch Redis calls — avoid N+1 Redis round-trips
  const userIds = items.map(u => u.id)
  const [usedValues, limitValues] = await Promise.all([
    Promise.all(userIds.map(id => quotaRedis.getUsed(id))),
    Promise.all(userIds.map(id => quotaRedis.getLimit(id))),
  ])

  const enriched = items.map((u, i) => ({
    ...u,
    planCode: u.planCode ?? 'free',
    planName: u.planName ?? 'Free',
    usedBytes: usedValues[i].toString(),
    limitBytes: limitValues[i].toString(),
  }))

  res.json({ items: enriched, nextCursor })
})

// GET /:id — user detail
router.get('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) return res.status(404).json({ message: 'User not found' })

  const [plan] = await db.select({
    code: plans.code, name: plans.name, expiresAt: userPlans.expiresAt,
  }).from(userPlans).innerJoin(plans, eq(userPlans.planId, plans.id))
    .where(and(eq(userPlans.userId, id), eq(userPlans.isActive, true)))
    .limit(1)

  const userAlbums = await db.select().from(albums)
    .where(eq(albums.userId, id)).orderBy(desc(albums.createdAt))

  const paymentHistory = await db.select({
    id: payments.id, referenceCode: payments.referenceCode,
    amountVnd: payments.amountVnd, status: payments.status,
    createdAt: payments.createdAt, paidAt: payments.paidAt,
    planName: plans.name,
  }).from(payments)
    .leftJoin(plans, eq(payments.planId, plans.id))
    .where(eq(payments.userId, id))
    .orderBy(desc(payments.createdAt))

  const [used, limit] = await Promise.all([
    quotaRedis.getUsed(id),
    quotaUtils.getTotalQuota(id),
  ])

  res.json({
    user: { ...user, passwordHash: undefined },
    plan: plan ?? { code: 'free', name: 'Free', expiresAt: null },
    albums: userAlbums.map(a => ({ ...a, totalBytes: a.totalBytes.toString() })),
    payments: paymentHistory,
    storage: { used: used.toString(), limit: limit.toString() },
  })
})

// PATCH /:id — update user
router.patch('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { displayName, email, role, isActive, quotaOverride } = req.body

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (displayName !== undefined) updates.displayName = displayName
  if (email !== undefined) updates.email = email
  if (role !== undefined) updates.role = role
  if (isActive !== undefined) updates.isActive = isActive

  await db.update(users).set(updates).where(eq(users.id, id))

  if (quotaOverride !== undefined) {
    await quotaRedis.setLimit(id, BigInt(quotaOverride))
  }

  await adminStats.log(admin.sub, 'user.update', 'user', id, { updates: req.body })
  res.json({ ok: true })
})

// DELETE /:id — delete user + cascade
router.delete('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params

  // Cascade delete
  await db.delete(comments).where(eq(comments.userId, id))
  await db.delete(likes).where(eq(likes.userId, id))
  await db.delete(images).where(eq(images.userId, id))
  await db.delete(albums).where(eq(albums.userId, id))
  await db.delete(payments).where(eq(payments.userId, id))
  await db.delete(userPlans).where(eq(userPlans.userId, id))
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, id))
  await db.delete(users).where(eq(users.id, id))

  await adminStats.log(admin.sub, 'user.delete', 'user', id)
  res.json({ ok: true })
})

// POST /:id/grant-plan — grant plan to user
router.post('/:id/grant-plan', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { planCode, durationDays, days: daysAlias } = req.body

  const [plan] = await db.select().from(plans)
    .where(eq(plans.code, planCode)).limit(1)
  if (!plan) return res.status(400).json({ message: 'Gói không tồn tại' })

  // Deactivate current plan
  await db.update(userPlans).set({ isActive: false })
    .where(and(eq(userPlans.userId, id), eq(userPlans.isActive, true)))

  const now = new Date()
  // Accept both "durationDays" and "days" from FE
  const days = durationDays ?? daysAlias ?? plan.durationDays
  await db.insert(userPlans).values({
    id: ulid(), userId: id, planId: plan.id,
    grantedBy: admin.sub,
    startedAt: now,
    expiresAt: new Date(now.getTime() + days * 86400_000),
    isActive: true,
  })

  // Update quota
  const total = await quotaUtils.getTotalQuota(id)
  await quotaRedis.setLimit(id, total)

  await adminStats.log(admin.sub, 'user.grant_plan', 'user', id, { planCode, durationDays: days })
  res.json({ ok: true })
})

export default router
