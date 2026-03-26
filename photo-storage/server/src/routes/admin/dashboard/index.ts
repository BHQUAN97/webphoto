import { Router } from 'express'
import { adminStats } from '../../../utils/admin-stats.js'
import { feedCache } from '../../../utils/redis.js'

const router = Router()

// GET /stats
router.get('/stats', async (_req, res) => {
  const cached = await feedCache.get<unknown>('admin:stats')
  if (cached) return res.json(cached)

  const stats = await adminStats.getOverview()
  await feedCache.set('admin:stats', stats, 300)
  res.json(stats)
})

// GET /charts
router.get('/charts', async (_req, res) => {
  const cached = await feedCache.get<unknown>('admin:charts')
  if (cached) return res.json(cached)

  const data = await adminStats.getChartData()
  // Convert BigInt values to strings for JSON serialization
  const safe = JSON.parse(JSON.stringify(data, (_k, v) => typeof v === 'bigint' ? Number(v) : v))
  await feedCache.set('admin:charts', safe, 300)
  res.json(safe)
})

// GET /alerts
router.get('/alerts', async (_req, res) => {
  const r2LimitGB = parseInt(process.env.R2_LIMIT_GB ?? '10')
  res.json({ r2LimitGB })
})

// GET /top-users — FE gọi endpoint riêng cho top storage users
router.get('/top-users', async (_req, res) => {
  const cached = await feedCache.get<unknown>('admin:top-users')
  if (cached) return res.json(cached)

  const topUsers = await adminStats.getTopStorageUsers()
  await feedCache.set('admin:top-users', topUsers, 300)
  res.json(topUsers)
})

export default router
