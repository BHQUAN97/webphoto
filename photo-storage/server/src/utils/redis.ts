import { createClient } from 'redis'

export const redis = createClient({ url: process.env.REDIS_URL })

// Bat buoc co error handler de tranh crash va hang
redis.on('error', (err) => {
  console.error(`[Redis] Error: ${err.message}`)
})

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect()
  }
}

export const quotaRedis = {
  async getUsed(userId: string): Promise<bigint> {
    return BigInt((await redis.get(`quota:used:${userId}`)) ?? '0')
  },
  async addUsed(userId: string, bytes: bigint): Promise<void> {
    await redis.incrBy(`quota:used:${userId}`, Number(bytes))
  },
  async decrUsed(userId: string, bytes: bigint): Promise<void> {
    await redis.decrBy(`quota:used:${userId}`, Number(bytes))
  },
  async getLimit(userId: string): Promise<bigint> {
    return BigInt((await redis.get(`quota:limit:${userId}`)) ?? String(5 * 1024 ** 3))
  },
  async setLimit(userId: string, bytes: bigint): Promise<void> {
    await redis.set(`quota:limit:${userId}`, bytes.toString())
  },
}

export const feedCache = {
  async get<T>(key: string): Promise<T | null> {
    const v = await redis.get(key)
    return v ? JSON.parse(v) : null
  },
  async set(key: string, data: unknown, ttlSec = 300): Promise<void> {
    await redis.set(key, JSON.stringify(data), { EX: ttlSec })
  },
  async invalidate(pattern: string): Promise<void> {
    // Use SCAN instead of KEYS to avoid blocking Redis on large datasets
    let cursor: string = '0'
    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 })
      cursor = String(result.cursor)
      const keys = result.keys as string[]
      if (keys.length) await redis.del(keys)
    } while (cursor !== '0')
  },
}

export async function incrVisit(userId: string): Promise<void> {
  if (!userId) return
  const key = `visit:day:${new Date().toISOString().slice(0, 10)}`
  await redis.incr(key)
  await redis.expire(key, 35 * 86400)
}

export async function acquirePaymentLock(referenceCode: string): Promise<boolean> {
  const key = `webhook:lock:${referenceCode}`
  const result = await redis.set(key, '1', { NX: true, EX: 30 })
  return result === 'OK'
}
