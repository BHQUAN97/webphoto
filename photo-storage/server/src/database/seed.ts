import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { ulid } from 'ulid'
import { plans, systemSettings, users, userPlans } from './schema.js'
import { hash } from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'

async function seed() {
  const pool = mysql.createPool(process.env.DATABASE_URL!)
  const db = drizzle(pool)

  // ── Plans (upsert by code) ──
  console.log('Seeding plans...')
  const planData = [
    {
      id: ulid(),
      code: 'free',
      name: 'Free',
      priceVnd: 0,
      durationDays: 30,
      quotaBytes: BigInt(5 * 1024 * 1024 * 1024),
      maxAlbums: 5,
      canDownload: false,
      canFilter: false,
      canEditPhoto: false,
      isActive: true,
      sortOrder: 0,
    },
    {
      id: ulid(),
      code: 'basic',
      name: 'Cơ bản',
      priceVnd: 49000,
      durationDays: 30,
      quotaBytes: BigInt(50 * 1024 * 1024 * 1024),
      maxAlbums: null,
      canDownload: true,
      canFilter: true,
      canEditPhoto: false,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: ulid(),
      code: 'pro',
      name: 'Pro',
      priceVnd: 499000,
      durationDays: 365,
      quotaBytes: BigInt(200 * 1024 * 1024 * 1024),
      maxAlbums: null,
      canDownload: true,
      canFilter: true,
      canEditPhoto: true,
      isActive: true,
      sortOrder: 2,
    },
  ]

  for (const plan of planData) {
    await db.insert(plans).values(plan)
      .onDuplicateKeyUpdate({ set: { name: plan.name, priceVnd: plan.priceVnd } })
  }

  // ── System Settings (upsert by key) ──
  console.log('Seeding system settings...')
  const settingsData = [
    { key: 'registration_open', value: 'true' },
    { key: 'max_upload_size_mb', value: '200' },
    {
      key: 'allowed_mime_types',
      value: JSON.stringify([
        'image/x-canon-cr2', 'image/x-sony-arw',
        'image/x-nikon-nef', 'image/x-adobe-dng',
        'image/jpeg', 'image/png', 'image/tiff',
      ]),
    },
    { key: 'storage_alert_threshold_percent', value: '80' },
    { key: 'image_error_spike_threshold', value: '20' },
    { key: 'worker_stuck_minutes', value: '30' },
    { key: 'storage_backend', value: 'r2' },
    { key: 'local_storage_dir', value: './data/storage' },
    { key: 'debug_mode', value: 'false' },
    { key: 'log_retention_days', value: '30' },
    { key: 'admin_email', value: 'buihongquan28041997@gmail.com' },
    { key: 'admin_name', value: 'BHQuan' },
    { key: 'app_developer', value: 'BHQuan' },
    { key: 'app_address', value: 'Vietnam' },
    { key: 'contact_zalo', value: '' },
    { key: 'contact_messenger', value: '' },
  ]

  for (const setting of settingsData) {
    await db.insert(systemSettings).values(setting)
      .onDuplicateKeyUpdate({ set: { key: sql`\`key\`` } }) // no-op update, keep existing value
  }

  // ── Admin user (skip if exists) ──
  console.log('Seeding admin user...')
  const existing = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'admin@photostorage.com'))
    .limit(1)

  if (existing.length === 0) {
    const adminId = ulid()
    const passwordHash = await hash('admin123', 10)
    await db.insert(users).values({
      id: adminId,
      email: 'admin@photostorage.com',
      passwordHash,
      displayName: 'Admin',
      role: 'admin',
      isActive: true,
      emailVerified: true,
    })

    // Lay pro plan id
    const proPlan = await db.select({ id: plans.id })
      .from(plans)
      .where(eq(plans.code, 'pro'))
      .limit(1)

    if (proPlan.length > 0) {
      await db.insert(userPlans).values({
        id: ulid(),
        userId: adminId,
        planId: proPlan[0].id,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 86400_000),
        isActive: true,
      })
    }
  } else {
    console.log('  Admin already exists, skipping')
  }

  console.log('Seed completed!')
  await pool.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
