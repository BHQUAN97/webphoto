import { db } from './db.js'
import { systemSettings } from '../database/schema.js'
import { logger } from './logger.js'

let cache: Record<string, string> = {}
let lastFetch = 0
const TTL = 60_000 // 1 minute

export async function getSettings(): Promise<Record<string, string>> {
  if (Date.now() - lastFetch < TTL && Object.keys(cache).length > 0) {
    return cache
  }
  try {
    const rows = await db.select().from(systemSettings)
    cache = {}
    for (const row of rows) {
      cache[row.key] = row.value
    }
    lastFetch = Date.now()
  } catch (err) {
    logger.warn('Failed to fetch settings from DB, using cache/defaults', {
      error: (err as Error).message,
      hasCachedValues: Object.keys(cache).length > 0,
    })
    // Keep existing cache if available, otherwise return empty (fallbacks will be used)
  }
  return cache
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const settings = await getSettings()
  return settings[key] ?? fallback
}

export function invalidateSettingsCache() {
  lastFetch = 0
}
