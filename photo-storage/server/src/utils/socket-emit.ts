import { createClient } from 'redis'

let pub: ReturnType<typeof createClient> | null = null

export async function initSocketEmitter() {
  pub = createClient({ url: process.env.REDIS_URL })
  await pub.connect()
}

export type UserEvent =
  | { type: 'image:ready';     imageId: string; thumbUrl: string; message: string }
  | { type: 'image:failed';    imageId: string; reason: string; message: string }
  | { type: 'payment:success'; planCode: string; expiresAt: string }
  | { type: 'photo:liked';     imageId: string; likedBy: string }
  | { type: 'photo:commented'; imageId: string; comment: string; by: string }
  | { type: 'storage:warning'; usedPercent: number }

export type AdminEvent =
  | { type: 'admin:storage:alert';      message: string; usedPercent: number }
  | { type: 'admin:worker:stuck';       jobId: string; queue: string; minutes: number }
  | { type: 'admin:image:error:spike';  count: number; threshold: number }
  | { type: 'admin:new:payment';        paymentId: string; amountVnd: number }
  | { type: 'admin:user:registered';    userId: string; email: string }

export async function emitToUser(userId: string, event: UserEvent): Promise<void> {
  if (!pub) return
  await pub.publish('socket:notify', JSON.stringify({ userId, event }))
}

export async function emitToAdmin(event: AdminEvent): Promise<void> {
  if (!pub) return
  await pub.publish('socket:notify', JSON.stringify({ room: 'admin', event }))
}
