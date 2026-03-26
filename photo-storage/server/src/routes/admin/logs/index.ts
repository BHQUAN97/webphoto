import { Router } from 'express'
import { db } from '../../../utils/db.js'
import { appLogs } from '../../../database/schema.js'
import { and, desc, lt, lte, gte, eq, like as sqlLike, sql } from 'drizzle-orm'
import { requireAdmin } from '../../../middleware/auth.js'
import { sanitizeSearch, isValidUlid, isValidDateString, clampInt } from '../../../utils/validate.js'

const router = Router()

const VALID_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const
const LEVEL_ORDER: Record<string, number> = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 }

// GET / — list logs with filters + cursor pagination
router.get('/', async (req, res) => {
  requireAdmin(req)
  const { level, minLevel, from, to, search, userId, requestId, cursor } = req.query
  const limit = clampInt(req.query.limit, 1, 100, 50)

  const conditions: unknown[] = []

  // Exact level filter
  if (level) {
    const upperLevel = (level as string).toUpperCase()
    if (VALID_LEVELS.includes(upperLevel as any)) {
      conditions.push(eq(appLogs.level, upperLevel as any))
    }
  }

  // Minimum level filter (e.g., WARN → WARN + ERROR + FATAL)
  if (minLevel && !level) {
    const upperMin = (minLevel as string).toUpperCase()
    const minIdx = LEVEL_ORDER[upperMin]
    if (minIdx !== undefined) {
      const included = VALID_LEVELS.filter((_, i) => i >= minIdx)
      if (included.length < VALID_LEVELS.length) {
        conditions.push(sql`${appLogs.level} IN (${sql.raw(included.map(l => `'${l}'`).join(','))})`)
      }
    }
  }

  // Date range
  if (from) {
    if (!isValidDateString(from as string)) return res.status(400).json({ message: 'from không hợp lệ' })
    conditions.push(gte(appLogs.createdAt, new Date(from as string)))
  }
  if (to) {
    if (!isValidDateString(to as string)) return res.status(400).json({ message: 'to không hợp lệ' })
    conditions.push(lte(appLogs.createdAt, new Date(to as string)))
  }

  // Search in message
  if (search) {
    const safeSearch = sanitizeSearch(search as string)
    if (safeSearch) {
      conditions.push(sqlLike(appLogs.message, `%${safeSearch}%`))
    }
  }

  // Filter by userId in context JSON
  if (userId) {
    if (!isValidUlid(userId as string)) return res.status(400).json({ message: 'userId không hợp lệ' })
    conditions.push(sql`JSON_EXTRACT(${appLogs.context}, '$.userId') = ${userId as string}`)
  }

  // Filter by requestId in context JSON
  if (requestId) {
    conditions.push(sql`JSON_EXTRACT(${appLogs.context}, '$.requestId') = ${requestId as string}`)
  }

  // Cursor pagination (ULID-based, descending)
  if (cursor) {
    if (!isValidUlid(cursor as string)) return res.status(400).json({ message: 'cursor không hợp lệ' })
    conditions.push(lt(appLogs.id, cursor as string))
  }

  const where = conditions.length > 0 ? and(...conditions as any) : undefined

  const rows = await db.select()
    .from(appLogs)
    .where(where)
    .orderBy(desc(appLogs.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : undefined

  // Parse context JSON for response
  const parsed = items.map(row => ({
    ...row,
    context: row.context ? JSON.parse(row.context) : null,
  }))

  res.json({ items: parsed, nextCursor })
})

// GET /:id — single log detail
router.get('/:id', async (req, res) => {
  requireAdmin(req)
  if (!isValidUlid(req.params.id)) return res.status(400).json({ message: 'id không hợp lệ' })

  const [row] = await db.select().from(appLogs).where(eq(appLogs.id, req.params.id)).limit(1)
  if (!row) return res.status(404).json({ message: 'Log không tồn tại' })

  res.json({
    ...row,
    context: row.context ? JSON.parse(row.context) : null,
  })
})

// DELETE / — bulk delete old logs
router.delete('/', async (req, res) => {
  requireAdmin(req)
  const olderThanDays = clampInt(req.query.olderThanDays ?? req.body?.olderThanDays, 1, 365, 30)

  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000)
  const result = await db.delete(appLogs).where(lte(appLogs.createdAt, cutoff))

  res.json({ deleted: (result as any)[0]?.affectedRows ?? 0 })
})

export default router
