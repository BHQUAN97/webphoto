import { Request, Response, NextFunction } from 'express'
import { jwtUtils, type JWTPayload } from '../utils/jwt.js'
import { incrVisit } from '../utils/redis.js'

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

const SKIP_VISIT_PATHS = ['/api/cron', '/api/health']

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token
    ?? req.headers.authorization?.replace('Bearer ', '')

  if (token) {
    const payload = await jwtUtils.verify(token)
    if (payload) {
      req.user = payload
      const isSkip = SKIP_VISIT_PATHS.some(p => req.path.startsWith(p))
      if (!isSkip) {
        incrVisit(payload.sub).catch(() => {})
      }
    }
  }
  next()
}

export function requireAuth(req: Request): JWTPayload {
  if (!req.user) {
    const err = new Error('Chưa đăng nhập') as Error & { statusCode: number }
    err.statusCode = 401
    throw err
  }
  return req.user
}

export function requireAdmin(req: Request): JWTPayload {
  const user = requireAuth(req)
  if (user.role !== 'admin') {
    const err = new Error('Không có quyền') as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }
  return user
}

export function requirePlan(req: Request, plan: 'basic' | 'pro'): JWTPayload {
  const user = requireAuth(req)
  const order: Record<string, number> = { free: 0, basic: 1, pro: 2, admin: 99 }
  if ((order[user.planCode] ?? 0) < order[plan]) {
    const err = new Error(`Yêu cầu gói ${plan} trở lên`) as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }
  return user
}
