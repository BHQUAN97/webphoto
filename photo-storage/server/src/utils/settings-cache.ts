import { db } from './db.js'
import { systemSettings } from '../database/schema.js'

let cache: Record<string, string> = {}
let lastFetch = 0
const TTL = 60_000 // 1 minute

export async function getSettings(): Promise<Record<string, string>> {
  if (Date.now() - lastFetch < TTL && Object.keys(cache).length > 0) {
    return cache
  }
  const rows = await db.select().from(systemSettings)
  cache = {}
  for (const row of rows) {
    cache[row.key] = row.value
  }
  lastFetch = Date.now()
  return cache
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const settings = await getSettings()
  return settings[key] ?? fallback
}

export function invalidateSettingsCache() {
  lastFetch = 0
}
