import { Queue } from 'bullmq'

const connection = { url: process.env.REDIS_URL }

export const imageQueue = new Queue('image-process', { connection })
export const emailQueue = new Queue('email-send', { connection })
export const storageMonitorQueue = new Queue('storage-monitor', { connection })
export const imageExpiryQueue = new Queue('image-expiry', { connection })

// Schedule recurring jobs
export async function setupRecurringJobs() {
  // Storage monitor every hour
  await storageMonitorQueue.upsertJobScheduler(
    'storage-monitor-hourly',
    { every: 3600_000 },
    { name: 'monitor' },
  )
}
