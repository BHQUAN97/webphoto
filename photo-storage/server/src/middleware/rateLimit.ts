import { Request, Response, NextFunction } from 'express'
import { redis } from '../utils/redis.js'

export function rateLimit(prefix: string, maxRequests: number, windowSec = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next()

    try {
      const key = `rate:${prefix}:${req.user.sub}`
      const current = await redis.incr(key)
      if (current === 1) {
        await redis.expire(key, windowSec)
      }

      if (current > maxRequests) {
        return res.status(429).json({ message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' })
      }
    } catch {
      // If Redis fails, allow the request through
    }
    next()
  }
}
