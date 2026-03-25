import { Request, Response, NextFunction } from 'express'
import { ulid } from 'ulid'
import { logger } from '../utils/logger.js'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = ulid()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  const start = Date.now()

  res.on('finish', () => {
    const durationMs = Date.now() - start
    const status = res.statusCode
    const meta = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.sub,
      statusCode: status,
      durationMs,
    }

    if (status >= 500) {
      logger.error(`${req.method} ${req.originalUrl} ${status} (${durationMs}ms)`, meta)
    } else if (status >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} ${status} (${durationMs}ms)`, meta)
    } else {
      logger.info(`${req.method} ${req.originalUrl} ${status} (${durationMs}ms)`, meta)
    }
  })

  next()
}
