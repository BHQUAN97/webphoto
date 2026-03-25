import { Worker } from 'bullmq'
import { mailService, type MailPayload } from '../utils/mailService.js'

export function createEmailWorker() {
  return new Worker('email-send', async (job) => {
    const payload = job.data as MailPayload
    await mailService.send(payload)
  }, {
    connection: { url: process.env.REDIS_URL },
    concurrency: 5,
  })
}
