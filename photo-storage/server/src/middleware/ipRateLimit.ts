import { Request, Response, NextFunction } from 'express'
import { redis } from '../utils/redis.js'

// Rate-limit theo IP cho cac endpoint public (login, register, share, voucher...)
// Khac voi rateLimit.ts — khong yeu cau req.user
const IS_PROD = process.env.NODE_ENV === 'production'
const LOCAL_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export function ipRateLimit(prefix: string, maxRequests: number, windowSec = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Cloudflare / Nginx forward client IP
      const ip = (req.headers['cf-connecting-ip'] as string)
        || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket.remoteAddress
        || 'unknown'

      // Bypass localhost trong dev/test — tranh E2E suite false positive 429.
      // Prod van bi chan vi dung cf-connecting-ip (real client IP).
      if (!IS_PROD && LOCAL_IPS.has(ip)) return next()

      const key = `ipRate:${prefix}:${ip}`
      const current = await redis.incr(key)
      if (current === 1) {
        await redis.expire(key, windowSec)
      }

      if (current > maxRequests) {
        res.setHeader('Retry-After', String(windowSec))
        return res.status(429).json({
          message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
        })
      }
    } catch {
      // Redis down — allow through (fail-open)
    }
    next()
  }
}
