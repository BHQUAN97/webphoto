import { db } from './db.js'
import { redis } from './redis.js'
import * as schema from '../database/schema.js'
import { sql, eq, gte, and, desc } from 'drizzle-orm'
import { ulid } from 'ulid'

export const adminStats = {
  async getOverview() {
    const d30 = new Date(Date.now() - 30 * 86400_000)

    const [[totalUsers], [newUsers30d],
           [totalImages], [processing], [failed],
           [totalAlbums], [rev30d]] = await Promise.all([
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.users),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.users).where(gte(schema.users.createdAt, d30)),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.images),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.images).where(eq(schema.images.status, 'processing')),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.images).where(eq(schema.images.status, 'failed')),
      db.select({ c: sql<number>`COUNT(*)` }).from(schema.albums),
      db.select({ t: sql<number>`COALESCE(SUM(amount_vnd),0)` }).from(schema.payments)
        .where(and(eq(schema.payments.status, 'paid'), gte(schema.payments.paidAt!, d30))),
    ])

    return {
      totalUsers: totalUsers.c, newUsers30d: newUsers30d.c,
      totalImages: totalImages.c, processingImages: processing.c, failedImages: failed.c,
      totalAlbums: totalAlbums.c, revenue30d: rev30d.t,
    }
  },

  async getChartData(days = 30) {
    const since = new Date(Date.now() - days * 86400_000)

    const snapshots = await db.select().from(schema.storageSnapshots)
      .where(gte(schema.storageSnapshots.snapshotAt, since))
      .orderBy(schema.storageSnapshots.snapshotAt)

    let visits: { date: string; count: number }[] = []
    try {
      const visitKeys = Array.from({ length: days }, (_, i) => {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
        return `visit:day:${d}`
      }).reverse()
      const visitVals = await redis.mGet(visitKeys)
      visits = visitKeys.map((k, i) => ({
        date: k.split(':').pop()!, count: parseInt(visitVals[i] ?? '0'),
      }))
    } catch {
      // Redis unavailable — return empty visits
    }

    let revenueMonthly: { month: string; total: number }[] = []
    try {
      revenueMonthly = await db.select({
        month: sql<string>`DATE_FORMAT(paid_at,'%Y-%m')`,
        total: sql<number>`SUM(amount_vnd)`,
      }).from(schema.payments)
        .where(and(eq(schema.payments.status, 'paid'),
          gte(schema.payments.paidAt!, new Date(Date.now() - 365 * 86400_000))))
        .groupBy(sql`DATE_FORMAT(paid_at,'%Y-%m')`)
        .orderBy(sql`DATE_FORMAT(paid_at,'%Y-%m')`)
    } catch {
      // No paid payments yet
    }

    const planDistribution = await db.select({
      planCode:  schema.plans.code,
      planName:  schema.plans.name,
      userCount: sql<number>`COUNT(DISTINCT ${schema.userPlans.userId})`,
    }).from(schema.userPlans)
      .innerJoin(schema.plans, eq(schema.userPlans.planId, schema.plans.id))
      .where(eq(schema.userPlans.isActive, true))
      .groupBy(schema.plans.code, schema.plans.name)

    return { snapshots, visits, revenueMonthly, planDistribution }
  },

  async getTopStorageUsers(limit = 10) {
    return db.select({
      userId:      schema.images.userId,
      displayName: schema.users.displayName,
      email:       schema.users.email,
      avatarKey:   schema.users.avatarKey,
      totalBytes:  sql<string>`SUM(${schema.images.originalSize})`,
      imageCount:  sql<number>`COUNT(*)`,
    })
    .from(schema.images)
    .innerJoin(schema.users, eq(schema.images.userId, schema.users.id))
    .where(eq(schema.images.status, 'ready'))
    .groupBy(schema.images.userId, schema.users.displayName, schema.users.email, schema.users.avatarKey)
    .orderBy(desc(sql`SUM(${schema.images.originalSize})`))
    .limit(limit)
  },

  async log(adminId: string, action: string, targetType?: string, targetId?: string, meta?: object) {
    await db.insert(schema.adminLogs).values({
      id: ulid(), adminId, action, targetType: targetType ?? null, targetId: targetId ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    })
  },
}
