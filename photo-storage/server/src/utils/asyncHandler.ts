import { Request, Response, NextFunction } from 'express'
import { logger } from './logger.js'

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((err: Error) => {
      logger.error(`[${req.method}] ${req.path} — ${err.message}`, {
        userId: (req as any).user?.id ?? 'anonymous',
        errorName: err.name,
        stack: err.stack,
      })
      next(err)
    })
  }

export const ok = (res: Response, data: unknown, message = 'Success') =>
  res.status(200).json({ success: true, message, data })

export const created = (res: Response, data: unknown, message = 'Created') =>
  res.status(201).json({ success: true, message, data })

export const noContent = (res: Response) => res.status(204).send()

export const fail = (res: Response, message: string, code = 400) =>
  res.status(code).json({ success: false, message, data: null })

export const unauthorized = (res: Response, message = 'Unauthorized') =>
  fail(res, message, 401)

export const forbidden = (res: Response, message = 'Forbidden') =>
  fail(res, message, 403)

export const notFound = (res: Response, message = 'Not found') =>
  fail(res, message, 404)

export const conflict = (res: Response, message = 'Conflict') =>
  fail(res, message, 409)

export const serverError = (res: Response, message = 'Internal server error') =>
  fail(res, message, 500)

export const globalErrorHandler = (
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isDev = process.env.NODE_ENV === 'development'
  const status = err.status ?? 500
  const message = isDev ? err.message : status === 500
    ? 'Internal server error'
    : err.message

  res.status(status).json({
    success: false,
    message,
    data: null,
    ...(isDev && { stack: err.stack }),
  })
}
