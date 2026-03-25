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

// Capture response body for error logging
function captureResponseBody(res: Response): { getBody: () => string | null } {
  const chunks: Buffer[] = []
  const originalWrite = res.write.bind(res)
  const originalEnd = res.end.bind(res)

  res.write = function (chunk: any, ...args: any[]) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return (originalWrite as any)(chunk, ...args)
  } as any

  res.end = function (chunk: any, ...args: any[]) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return (originalEnd as any)(chunk, ...args)
  } as any

  return {
    getBody: () => {
      if (chunks.length === 0) return null
      try {
        return Buffer.concat(chunks).toString('utf-8').slice(0, 500)
      } catch {
        return null
      }
    },
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = ulid()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  const start = Date.now()

  // Capture response body only for non-2xx (to log error messages)
  const capture = captureResponseBody(res)

  // Log request body for mutation methods
  const hasMutationBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body
  let reqBodyPreview: string | undefined
  if (hasMutationBody) {
    try {
      // Skip binary data
      if (Buffer.isBuffer(req.body)) {
        reqBodyPreview = `[binary ${req.body.length}B]`
      } else {
        reqBodyPreview = JSON.stringify(req.body).slice(0, 500)
      }
    } catch {
      reqBodyPreview = '[unserializable]'
    }
  }

  res.on('finish', () => {
    const durationMs = Date.now() - start
    const status = res.statusCode
    const meta: Record<string, unknown> = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.sub,
      statusCode: status,
      durationMs,
    }

    // Add request body for non-2xx or slow requests
    if (reqBodyPreview && (status >= 400 || durationMs > 3000)) {
      meta.reqBody = reqBodyPreview
    }

    // Add response body for errors
    if (status >= 400) {
      const resBody = capture.getBody()
      if (resBody) {
        meta.resBody = resBody
      }
    }

    // Add IP and user-agent for important requests
    if (status >= 400 || req.originalUrl.includes('/auth/')) {
      meta.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
      meta.ua = (req.headers['user-agent'] ?? '').slice(0, 150)
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
