import { Request, Response, NextFunction } from 'express'

export function adminGuard(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    const err = new Error('Admin only') as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }
  next()
}
