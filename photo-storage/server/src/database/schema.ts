import {
  mysqlTable, varchar, bigint, int, boolean, datetime,
  text, mysqlEnum, uniqueIndex, index, primaryKey
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// ─── USERS ────────────────────────────────────────────────────────────────
export const users = mysqlTable('users', {
  id:            varchar('id', { length: 26 }).primaryKey(),
  email:         varchar('email', { length: 255 }).notNull().unique(),
  passwordHash:  varchar('password_hash', { length: 255 }),
  displayName:   varchar('display_name', { length: 100 }).notNull(),
  avatarKey:     varchar('avatar_key', { length: 500 }),
  bio:           text('bio'),
  role:          mysqlEnum('role', ['user', 'admin']).default('user').notNull(),
  isActive:      boolean('is_active').default(true).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  createdAt:     datetime('created_at').default(sql`NOW()`).notNull(),
  updatedAt:     datetime('updated_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
  roleIdx:  index('users_role_idx').on(t.role, t.isActive, t.createdAt),
}))

// ─── PLANS ────────────────────────────────────────────────────────────────
export const plans = mysqlTable('plans', {
  id:           varchar('id', { length: 26 }).primaryKey(),
  code:         varchar('code', { length: 50 }).notNull().unique(),
  name:         varchar('name', { length: 100 }).notNull(),
  priceVnd:     int('price_vnd').notNull().default(0),
  durationDays: int('duration_days').notNull(),
  quotaBytes:   bigint('quota_bytes', { mode: 'bigint' }).notNull(),
  maxAlbums:    int('max_albums'),
  canDownload:  boolean('can_download').default(false).notNull(),
  canFilter:    boolean('can_filter').default(false).notNull(),
  canEditPhoto: boolean('can_edit_photo').default(false).notNull(),
  isActive:     boolean('is_active').default(true).notNull(),
  sortOrder:    int('sort_order').default(0).notNull(),
})

// ─── USER PLANS ───────────────────────────────────────────────────────────
export const userPlans = mysqlTable('user_plans', {
  id:        varchar('id', { length: 26 }).primaryKey(),
  userId:    varchar('user_id', { length: 26 }).notNull(),
  planId:    varchar('plan_id', { length: 26 }).notNull(),
  grantedBy: varchar('granted_by', { length: 26 }),
  startedAt: datetime('started_at').notNull(),
  expiresAt: datetime('expires_at').notNull(),
  isActive:  boolean('is_active').default(true).notNull(),
}, (t) => ({
  userActiveIdx: index('user_plans_user_active_idx').on(t.userId, t.isActive),
  expiryIdx:     index('user_plans_expiry_idx').on(t.expiresAt, t.isActive),
}))

// ─── STORAGE ADD-ONS ──────────────────────────────────────────────────────
export const storageAddons = mysqlTable('storage_addons', {
  id:        varchar('id', { length: 26 }).primaryKey(),
  userId:    varchar('user_id', { length: 26 }).notNull(),
  bytes:     bigint('bytes', { mode: 'bigint' }).notNull(),
  expiresAt: datetime('expires_at').notNull(),
  createdAt: datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  userIdx: index('storage_addons_user_idx').on(t.userId, t.expiresAt),
}))

// ─── PAYMENT METHODS ──────────────────────────────────────────────────────
export const paymentMethods = mysqlTable('payment_methods', {
  id:        varchar('id', { length: 26 }).primaryKey(),
  type:      mysqlEnum('type', ['bank_transfer', 'momo', 'zalopay', 'cash']).notNull(),
  name:      varchar('name', { length: 100 }).notNull(),
  isActive:  boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  sortOrder: int('sort_order').default(0).notNull(),
  config:    text('config').notNull(),
  createdAt: datetime('created_at').default(sql`NOW()`).notNull(),
  updatedAt: datetime('updated_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  activeIdx: index('pm_active_idx').on(t.isActive, t.sortOrder),
}))

// ─── PAYMENTS ─────────────────────────────────────────────────────────────
export const payments = mysqlTable('payments', {
  id:              varchar('id', { length: 26 }).primaryKey(),
  userId:          varchar('user_id', { length: 26 }).notNull(),
  planId:          varchar('plan_id', { length: 26 }),
  addonBytes:      bigint('addon_bytes', { mode: 'bigint' }),
  amountVnd:       int('amount_vnd').notNull(),
  referenceCode:   varchar('reference_code', { length: 50 }).notNull().unique(),
  paymentMethodId: varchar('payment_method_id', { length: 26 }),
  status:          mysqlEnum('status', ['pending', 'awaiting_confirm', 'paid', 'failed'])
                     .default('pending').notNull(),
  customerNote:    text('customer_note'),
  adminNote:       text('admin_note'),
  confirmedByUser: boolean('confirmed_by_user').default(false).notNull(),
  confirmedAt:     datetime('confirmed_at'),
  markedPaidBy:    varchar('marked_paid_by', { length: 26 }),
  paidAt:          datetime('paid_at'),
  expiresAt:       datetime('expires_at'),
  createdAt:       datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  refIdx:    uniqueIndex('payments_ref_idx').on(t.referenceCode),
  userIdx:   index('payments_user_idx').on(t.userId, t.createdAt),
  statusIdx: index('payments_status_idx').on(t.status, t.createdAt),
  methodIdx: index('payments_method_idx').on(t.paymentMethodId),
}))

// ─── ALBUMS ───────────────────────────────────────────────────────────────
export const albums = mysqlTable('albums', {
  id:          varchar('id', { length: 26 }).primaryKey(),
  userId:      varchar('user_id', { length: 26 }).notNull(),
  title:       varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  coverKey:      varchar('cover_key', { length: 500 }),
  driveFolderId: varchar('drive_folder_id', { length: 100 }),
  isPublic:      boolean('is_public').default(true).notNull(),
  isActive:    boolean('is_active').default(true).notNull(),
  imageCount:  int('image_count').default(0).notNull(),
  totalBytes:  bigint('total_bytes', { mode: 'bigint' }).default(sql`0`).notNull(),
  createdAt:   datetime('created_at').default(sql`NOW()`).notNull(),
  updatedAt:   datetime('updated_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  userIdx:   index('albums_user_idx').on(t.userId, t.createdAt),
  publicIdx: index('albums_public_idx').on(t.isPublic, t.isActive, t.createdAt),
}))

// ─── IMAGES ───────────────────────────────────────────────────────────────
export const images = mysqlTable('images', {
  id:           varchar('id', { length: 26 }).primaryKey(),
  albumId:      varchar('album_id', { length: 26 }).notNull(),
  userId:       varchar('user_id', { length: 26 }).notNull(),
  originalKey:  varchar('original_key', { length: 500 }).notNull(),
  thumbKey:     varchar('thumb_key', { length: 500 }),
  previewKey:   varchar('preview_key', { length: 500 }),
  driveFileId:  varchar('drive_file_id', { length: 100 }),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType:     varchar('mime_type', { length: 100 }).notNull(),
  originalSize: bigint('original_size', { mode: 'bigint' }).notNull(),
  width:        int('width'),
  height:       int('height'),
  status:       mysqlEnum('status', ['uploading', 'processing', 'ready', 'failed', 'syncing'])
                  .default('uploading').notNull(),
  likeCount:    int('like_count').default(0).notNull(),
  commentCount: int('comment_count').default(0).notNull(),
  expiresAt:    datetime('expires_at').notNull(),
  createdAt:    datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  albumCreatedIdx: index('images_album_created_idx').on(t.albumId, t.createdAt),
  userCreatedIdx:  index('images_user_created_idx').on(t.userId, t.createdAt),
  expiryIdx:       index('images_expiry_idx').on(t.expiresAt, t.status),
  statusIdx:       index('images_status_idx').on(t.status, t.createdAt),
  albumLikeIdx:    index('images_album_like_idx').on(t.albumId, t.likeCount),
  albumSizeIdx:    index('images_album_size_idx').on(t.albumId, t.originalSize),
}))

// ─── LIKES ────────────────────────────────────────────────────────────────
export const likes = mysqlTable('likes', {
  userId:    varchar('user_id', { length: 26 }).notNull(),
  imageId:   varchar('image_id', { length: 26 }).notNull(),
  createdAt: datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  pk:       primaryKey({ columns: [t.userId, t.imageId] }),
  imageIdx: index('likes_image_idx').on(t.imageId),
  userIdx:  index('likes_user_idx').on(t.userId, t.createdAt),
}))

// ─── COMMENTS ─────────────────────────────────────────────────────────────
export const comments = mysqlTable('comments', {
  id:        varchar('id', { length: 26 }).primaryKey(),
  imageId:   varchar('image_id', { length: 26 }).notNull(),
  userId:    varchar('user_id', { length: 26 }),
  guestName: varchar('guest_name', { length: 50 }),
  content:   text('content').notNull(),
  createdAt: datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  imageIdx: index('comments_image_idx').on(t.imageId, t.createdAt),
}))

// ─── REFRESH TOKENS ───────────────────────────────────────────────────────
export const refreshTokens = mysqlTable('refresh_tokens', {
  id:        varchar('id', { length: 26 }).primaryKey(),
  userId:    varchar('user_id', { length: 26 }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: datetime('expires_at').notNull(),
  createdAt: datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  userIdx: index('refresh_tokens_user_idx').on(t.userId),
}))

// ─── ALBUM SHARE TOKENS ──────────────────────────────────────────────────
export const albumShareTokens = mysqlTable('album_share_tokens', {
  id:            varchar('id', { length: 26 }).primaryKey(),
  albumId:       varchar('album_id', { length: 26 }).notNull(),
  token:         varchar('token', { length: 64 }).notNull().unique(),
  allowLike:     boolean('allow_like').default(true).notNull(),
  allowComment:  boolean('allow_comment').default(true).notNull(),
  allowDownload: boolean('allow_download').default(true).notNull(),
  expiresAt:     datetime('expires_at'),
  createdAt:     datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex('share_tokens_token_idx').on(t.token),
  albumIdx: index('share_tokens_album_idx').on(t.albumId),
}))

// ─── SYSTEM SETTINGS ──────────────────────────────────────────────────────
export const systemSettings = mysqlTable('system_settings', {
  key:       varchar('key', { length: 100 }).primaryKey(),
  value:     text('value').notNull(),
  updatedAt: datetime('updated_at').default(sql`NOW()`).notNull(),
  updatedBy: varchar('updated_by', { length: 26 }),
})

// ─── ADMIN LOGS ───────────────────────────────────────────────────────────
export const adminLogs = mysqlTable('admin_logs', {
  id:         varchar('id', { length: 26 }).primaryKey(),
  adminId:    varchar('admin_id', { length: 26 }).notNull(),
  action:     varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId:   varchar('target_id', { length: 26 }),
  meta:       text('meta'),
  createdAt:  datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  adminIdx:  index('admin_logs_admin_idx').on(t.adminId, t.createdAt),
  targetIdx: index('admin_logs_target_idx').on(t.targetType, t.targetId),
}))

// ─── APP LOGS ────────────────────────────────────────────────────────────
export const appLogs = mysqlTable('app_logs', {
  id:        varchar('id', { length: 26 }).primaryKey(),
  level:     mysqlEnum('level', ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).notNull(),
  message:   text('message').notNull(),
  context:   text('context'),
  stack:     text('stack'),
  createdAt: datetime('created_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  levelCreatedIdx: index('app_logs_level_created_idx').on(t.level, t.createdAt),
  createdIdx:      index('app_logs_created_idx').on(t.createdAt),
}))

// ─── STORAGE SNAPSHOTS ────────────────────────────────────────────────────
export const storageSnapshots = mysqlTable('storage_snapshots', {
  id:                varchar('id', { length: 26 }).primaryKey(),
  totalBytesPrivate: bigint('total_bytes_private', { mode: 'bigint' }).notNull(),
  totalBytesPublic:  bigint('total_bytes_public', { mode: 'bigint' }).notNull(),
  totalUsers:        int('total_users').notNull(),
  totalImages:       int('total_images').notNull(),
  totalAlbums:       int('total_albums').notNull(),
  newUsersToday:     int('new_users_today').default(0).notNull(),
  revenueToday:      int('revenue_today').default(0).notNull(),
  visitCount:        int('visit_count').default(0).notNull(),
  snapshotAt:        datetime('snapshot_at').default(sql`NOW()`).notNull(),
}, (t) => ({
  timeIdx: index('storage_snapshots_time_idx').on(t.snapshotAt),
}))
