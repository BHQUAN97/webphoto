import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { ulid } from 'ulid'
import { plans, systemSettings, users, userPlans } from './schema.js'
import { hash } from 'bcryptjs'

async function seed() {
  const pool = mysql.createPool(process.env.DATABASE_URL!)
  const db = drizzle(pool)

  console.log('Seeding plans...')
  const freePlanId = ulid()
  const basicPlanId = ulid()
  const proPlanId = ulid()

  await db.insert(plans).values([
    {
      id: freePlanId,
      code: 'free',
      name: 'Free',
      priceVnd: 0,
      durationDays: 30,
      quotaBytes: BigInt(5 * 1024 * 1024 * 1024), // 5GB
      maxAlbums: 5,
      canDownload: false,
      canFilter: false,
      canEditPhoto: false,
      isActive: true,
      sortOrder: 0,
    },
    {
      id: basicPlanId,
      code: 'basic',
      name: 'Cơ bản',
      priceVnd: 49000,
      durationDays: 30,
      quotaBytes: BigInt(50 * 1024 * 1024 * 1024), // 50GB
      maxAlbums: null,
      canDownload: true,
      canFilter: true,
      canEditPhoto: false,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: proPlanId,
      code: 'pro',
      name: 'Pro',
      priceVnd: 499000,
      durationDays: 365,
      quotaBytes: BigInt(200 * 1024 * 1024 * 1024), // 200GB
      maxAlbums: null,
      canDownload: true,
      canFilter: true,
      canEditPhoto: true,
      isActive: true,
      sortOrder: 2,
    },
  ])

  console.log('Seeding system settings...')
  await db.insert(systemSettings).values([
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
  ])

  console.log('Seeding admin user...')
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

  // Grant free plan to admin
  await db.insert(userPlans).values({
    id: ulid(),
    userId: adminId,
    planId: proPlanId,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 86400_000),
    isActive: true,
  })

  console.log('Seed completed!')
  await pool.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
