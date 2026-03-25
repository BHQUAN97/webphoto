import 'dotenv/config'
import { connectRedis } from '../utils/redis.js'
import { initSocketEmitter } from '../utils/socket-emit.js'
import { createImageWorker } from './imageProcessor.js'
import { createImageExpiryWorker } from './imageExpiry.js'
import { createStorageMonitorWorker } from './storageMonitor.js'
import { createEmailWorker } from './emailSender.js'
import { setupRecurringJobs } from '../plugins/bullmq.js'
import { logger } from '../utils/logger.js'

async function start() {
  logger.info('[Worker] Connecting to Redis...', { source: 'worker' })
  await connectRedis()
  await initSocketEmitter()

  logger.info('[Worker] Starting workers...', { source: 'worker' })
  const imageWorker = createImageWorker()
  const expiryWorker = createImageExpiryWorker()
  const storageWorker = createStorageMonitorWorker()
  const emailWorker = createEmailWorker()

  await setupRecurringJobs()

  logger.info('[Worker] All workers started: image-process(3), image-expiry, storage-monitor, email-send(5)', { source: 'worker' })

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('[Worker] Shutting down...', { source: 'worker' })
    await Promise.all([
      imageWorker.close(),
      expiryWorker.close(),
      storageWorker.close(),
      emailWorker.close(),
    ])
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

start().catch((err) => {
  logger.fatal('[Worker] Fatal error', { source: 'worker', stack: (err as Error).stack })
  process.exit(1)
})
