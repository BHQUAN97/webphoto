import { Router } from 'express'
import { db } from '../../utils/db.js'
import { paymentMethods } from '../../database/schema.js'
import { eq, asc } from 'drizzle-orm'
import { feedCache } from '../../utils/redis.js'

const router = Router()

// GET / — public: list active payment methods for checkout
router.get('/', async (_req, res) => {
  const cached = await feedCache.get<unknown>('public:payment-methods')
  if (cached) return res.json(cached)

  const methods = await db.select({
    id: paymentMethods.id,
    type: paymentMethods.type,
    name: paymentMethods.name,
    isDefault: paymentMethods.isDefault,
    config: paymentMethods.config,
  })
  .from(paymentMethods)
  .where(eq(paymentMethods.isActive, true))
  .orderBy(asc(paymentMethods.sortOrder))

  const result = {
    methods: methods.map(m => ({ ...m, config: JSON.parse(m.config) })),
  }
  await feedCache.set('public:payment-methods', result, 600)
  res.json(result)
})

export default router
