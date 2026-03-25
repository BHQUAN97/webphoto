import { Router } from 'express'
import { db } from '../../utils/db.js'
import { plans } from '../../database/schema.js'
import { eq, asc } from 'drizzle-orm'
import { feedCache } from '../../utils/redis.js'

const router = Router()

// GET / — public: list active plans for upgrade page
router.get('/', async (_req, res) => {
  const cached = await feedCache.get<unknown>('public:plans')
  if (cached) return res.json(cached)

  const activePlans = await db.select({
    id: plans.id,
    code: plans.code,
    name: plans.name,
    priceVnd: plans.priceVnd,
    durationDays: plans.durationDays,
    quotaBytes: plans.quotaBytes,
    maxAlbums: plans.maxAlbums,
    canDownload: plans.canDownload,
    canFilter: plans.canFilter,
    canEditPhoto: plans.canEditPhoto,
    sortOrder: plans.sortOrder,
  })
  .from(plans)
  .where(eq(plans.isActive, true))
  .orderBy(asc(plans.sortOrder))

  const result = {
    plans: activePlans.map(p => ({ ...p, quotaBytes: p.quotaBytes.toString() })),
  }
  await feedCache.set('public:plans', result, 600)
  res.json(result)
})

export default router
