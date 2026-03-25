import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { authMiddleware } from './middleware/auth.js'
import { requestLogger } from './middleware/requestLogger.js'
import { adminGuard } from './middleware/admin.js'
import { connectRedis } from './utils/redis.js'
import { initSocketEmitter } from './utils/socket-emit.js'
import { initStorage, getStorageBackend } from './utils/storage/index.js'
import { logger } from './utils/logger.js'
import { getSetting } from './utils/settings-cache.js'

// Auth routes
import registerRoute from './routes/auth/register.js'
import loginRoute from './routes/auth/login.js'
import logoutRoute from './routes/auth/logout.js'
import refreshRoute from './routes/auth/refresh.js'

// User routes
import userMeRoute from './routes/users/me.js'

// Album routes
import albumRoutes from './routes/albums/index.js'

// Image routes
import imageRoutes from './routes/images/index.js'

// Payment routes
import paymentRoutes from './routes/payments/index.js'

// Public routes (no auth required)
import publicPlanRoutes from './routes/plans/index.js'
import publicPaymentMethodRoutes from './routes/payment-methods/index.js'

// Admin routes
import adminDashboardRoutes from './routes/admin/dashboard/index.js'
import adminUserRoutes from './routes/admin/users/index.js'
import adminAlbumRoutes from './routes/admin/albums/index.js'
import adminPaymentRoutes from './routes/admin/payments/index.js'
import adminPlanRoutes from './routes/admin/plans/index.js'
import adminPaymentMethodRoutes from './routes/admin/payment-methods/index.js'
import adminSettingsRoutes from './routes/admin/settings/index.js'
import adminLogRoutes from './routes/admin/logs/index.js'

// Share routes (public, no auth)
import shareRoutes from './routes/share/index.js'

// Storage routes (for local storage mode)
import storageRoutes from './routes/storage/index.js'

// Cron routes
import cronRoutes from './routes/cron/index.js'

const app = express()
const PORT = parseInt(process.env.PORT ?? '4000')

// Trust proxy (Cloudflare Tunnel / Nginx forwards X-Forwarded-Proto)
app.set('trust proxy', 1)

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '0') // rely on CSP instead
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  // CSP handled by Nginx on frontend, not needed on API responses
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.removeHeader('X-Powered-By')
  next()
})

// Middleware
app.use(cors({
  origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map(s => s.trim()),
  credentials: true,
}))
app.use(cookieParser())
app.use(requestLogger)
app.use(authMiddleware)

// Binary upload routes — BEFORE express.json() to avoid body stream conflict
app.use('/api/storage', storageRoutes)

// JSON body parser — after binary routes are registered
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})


// Public auth routes
app.use('/api/auth', registerRoute)
app.use('/api/auth', loginRoute)
app.use('/api/auth', logoutRoute)
app.use('/api/auth', refreshRoute)

// User routes
app.use('/api/users', userMeRoute)

// Album routes
app.use('/api/albums', albumRoutes)

// Image routes
app.use('/api/images', imageRoutes)

// Payment routes
app.use('/api/payments', paymentRoutes)

// Public data routes (plans & payment methods for upgrade page)
app.use('/api/plans', publicPlanRoutes)
app.use('/api/payment-methods', publicPaymentMethodRoutes)

// Admin routes (protected by adminGuard)
app.use('/api/admin/dashboard', adminGuard, adminDashboardRoutes)
app.use('/api/admin/users', adminGuard, adminUserRoutes)
app.use('/api/admin/albums', adminGuard, adminAlbumRoutes)
app.use('/api/admin/payments', adminGuard, adminPaymentRoutes)
app.use('/api/admin/plans', adminGuard, adminPlanRoutes)
app.use('/api/admin/payment-methods', adminGuard, adminPaymentMethodRoutes)
app.use('/api/admin/settings', adminGuard, adminSettingsRoutes)
app.use('/api/admin/logs', adminGuard, adminLogRoutes)

// Share routes (public album sharing, no auth)
app.use('/api/share', shareRoutes)

// Cron routes
app.use('/api/cron', cronRoutes)

// Error handler — structured logging + debug mode toggle
app.use(async (err: Error & { statusCode?: number }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.statusCode ?? 500

  // Always log via structured logger
  const logLevel = status >= 500 ? 'error' : 'warn' as const
  logger[logLevel](err.message, {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.sub,
    statusCode: status,
    stack: status >= 500 ? err.stack : undefined,
  })

  // Check debug mode for detailed 5xx responses
  if (status >= 500) {
    const debugMode = await getSetting('debug_mode', 'false')
    if (debugMode === 'true') {
      return res.status(status).json({
        message: err.message,
        stack: err.stack,
        requestId: req.requestId,
        context: { method: req.method, url: req.originalUrl },
      })
    }
    return res.status(status).json({
      message: 'Lỗi hệ thống, vui lòng thử lại sau',
      requestId: req.requestId,
    })
  }

  // 4xx — always return original message + requestId
  res.status(status).json({
    message: err.message,
    requestId: req.requestId,
  })
})

async function start() {
  await connectRedis()
  await initStorage()
  await initSocketEmitter()

  // Serve local storage public files if backend is local
  const backend = await getStorageBackend()
  if (backend === 'local') {
    const { default: path } = await import('path')
    const dir = await getSetting('local_storage_dir', './data/storage')
    const publicDir = path.resolve(dir, 'public')
    app.use('/storage/public', express.static(publicDir, { maxAge: '30d', immutable: true }))
    logger.info(`Serving local storage public files from ${publicDir}`)
  }

  // Start API server
  app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`)
  })

  // Start Socket.io server on separate port
  try {
    const SOCKET_PORT = parseInt(process.env.SOCKET_PORT ?? '4001')
    const { createServer } = await import('http')
    const { setupSocketServer } = await import('./plugins/socket.js')
    const socketHttpServer = createServer()
    await setupSocketServer(socketHttpServer)
    socketHttpServer.listen(SOCKET_PORT, () => {
      logger.info(`Socket.io server running on port ${SOCKET_PORT}`)
    })
    socketHttpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Socket.io port ${SOCKET_PORT} in use, skipping. API still running.`)
      } else {
        logger.error('Socket.io error', { stack: (err as Error).stack })
      }
    })
  } catch (err) {
    logger.warn('Socket.io server failed to start, API continues', { stack: (err as Error).stack })
  }
}

start().catch((err) => logger.fatal('Server start failed', { stack: (err as Error).stack }))
