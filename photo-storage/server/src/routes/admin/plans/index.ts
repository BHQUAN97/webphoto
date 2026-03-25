import { Router } from 'express'
import { ulid } from 'ulid'
import { db } from '../../../utils/db.js'
import { plans, userPlans } from '../../../database/schema.js'
import { eq, and, sql, asc } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { adminStats } from '../../../utils/admin-stats.js'

const router = Router()

// GET / — list plans with user count
router.get('/', async (req, res) => {
  requireAdmin(req)

  // Single query with LEFT JOIN + GROUP BY — avoid N+1
  const allPlans = await db.select({
    id: plans.id, code: plans.code, name: plans.name,
    priceVnd: plans.priceVnd, durationDays: plans.durationDays,
    quotaBytes: plans.quotaBytes, maxAlbums: plans.maxAlbums,
    canDownload: plans.canDownload, canFilter: plans.canFilter,
    canEditPhoto: plans.canEditPhoto, isActive: plans.isActive,
    sortOrder: plans.sortOrder,
    activeUsers: sql<number>`COUNT(DISTINCT ${userPlans.userId})`,
  })
  .from(plans)
  .leftJoin(userPlans, and(eq(userPlans.planId, plans.id), eq(userPlans.isActive, true)))
  .groupBy(plans.id)
  .orderBy(asc(plans.sortOrder))

  res.json({
    plans: allPlans.map(p => ({ ...p, quotaBytes: p.quotaBytes.toString() })),
  })
})

// POST / — create plan
router.post('/', async (req, res) => {
  const admin = requireAdmin(req)
  const { code, name, priceVnd, durationDays, quotaBytes, maxAlbums,
          canDownload, canFilter, canEditPhoto, sortOrder } = req.body

  if (!code || !name) return res.status(400).json({ message: 'Thiếu thông tin gói' })

  const planId = ulid()
  await db.insert(plans).values({
    id: planId, code, name,
    priceVnd: priceVnd ?? 0,
    durationDays: durationDays ?? 30,
    quotaBytes: BigInt(quotaBytes ?? 5 * 1024 * 1024 * 1024),
    maxAlbums: maxAlbums ?? null,
    canDownload: canDownload ?? false,
    canFilter: canFilter ?? false,
    canEditPhoto: canEditPhoto ?? false,
    isActive: true,
    sortOrder: sortOrder ?? 0,
  })

  await adminStats.log(admin.sub, 'plan.create', 'plan', planId)
  res.json({ id: planId })
})

// PATCH /:id — update plan
router.patch('/:id', async (req, res) => {
  const admin = requireAdmin(req)
  const { id } = req.params
  const { name, priceVnd, durationDays, quotaBytes, maxAlbums,
          canDownload, canFilter, canEditPhoto, isActive, sortOrder } = req.body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (priceVnd !== undefined) updates.priceVnd = priceVnd
  if (durationDays !== undefined) updates.durationDays = durationDays
  if (quotaBytes !== undefined) updates.quotaBytes = BigInt(quotaBytes)
  if (maxAlbums !== undefined) updates.maxAlbums = maxAlbums
  if (canDownload !== undefined) updates.canDownload = canDownload
  if (canFilter !== undefined) updates.canFilter = canFilter
  if (canEditPhoto !== undefined) updates.canEditPhoto = canEditPhoto
  if (isActive !== undefined) updates.isActive = isActive
  if (sortOrder !== undefined) updates.sortOrder = sortOrder

  await db.update(plans).set(updates).where(eq(plans.id, id))

  await adminStats.log(admin.sub, 'plan.update', 'plan', id, { updates: req.body })
  res.json({ ok: true })
})

export default router
