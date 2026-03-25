// ─── User ────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  displayName: string
  avatarKey: string | null
  bio: string | null
  role: 'user' | 'admin'
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface UserProfile extends User {
  planCode: string
  planName: string
  expiresAt: string | null
}

// ─── Plan ────────────────────────────────────────────────────────────────
export interface Plan {
  id: string
  code: string
  name: string
  priceVnd: number
  durationDays: number
  quotaBytes: string
  maxAlbums: number | null
  canDownload: boolean
  canFilter: boolean
  canEditPhoto: boolean
  isActive: boolean
  sortOrder: number
}

// ─── Album ───────────────────────────────────────────────────────────────
export interface Album {
  id: string
  userId: string
  title: string
  description: string | null
  coverKey: string | null
  isPublic: boolean
  isActive: boolean
  imageCount: number
  totalBytes: string
  createdAt: string
  updatedAt: string
  ownerName?: string
  expiresAt?: string
}

// ─── Image ───────────────────────────────────────────────────────────────
export type ImageStatus = 'uploading' | 'processing' | 'ready' | 'failed'

export interface ImageItem {
  id: string
  albumId: string
  userId: string
  originalKey: string
  thumbKey: string | null
  previewKey: string | null
  thumbUrl: string | null
  previewUrl: string | null
  originalName: string
  mimeType: string
  originalSize: string
  width: number | null
  height: number | null
  status: ImageStatus
  likeCount: number
  commentCount: number
  liked?: boolean
  expiresAt: string
  createdAt: string
}

// ─── Comment ─────────────────────────────────────────────────────────────
export interface Comment {
  id: string
  imageId: string
  userId: string
  content: string
  createdAt: string
  user?: { displayName: string; avatarKey: string | null }
}

// ─── Payment ─────────────────────────────────────────────────────────────
export type PaymentStatus = 'pending' | 'awaiting_confirm' | 'paid' | 'failed'

export interface Payment {
  id: string
  userId: string
  planId: string | null
  addonBytes: string | null
  amountVnd: number
  referenceCode: string
  paymentMethodId: string | null
  status: PaymentStatus
  customerNote: string | null
  adminNote: string | null
  confirmedByUser: boolean
  confirmedAt: string | null
  paidAt: string | null
  expiresAt: string | null
  createdAt: string
  planName?: string
  userName?: string
}

// ─── Payment Method ──────────────────────────────────────────────────────
export interface PaymentMethod {
  id: string
  type: 'bank_transfer' | 'momo' | 'zalopay' | 'cash'
  name: string
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  config: BankTransferConfig | MomoConfig | ZaloPayConfig | Record<string, unknown>
  createdAt: string
}

export interface BankTransferConfig {
  bankId: string
  bankName: string
  accountNo: string
  accountName: string
  branch?: string
  qrImageKey?: string
}

export interface MomoConfig {
  phone: string
  accountName: string
  qrImageKey?: string
}

export interface ZaloPayConfig {
  phone: string
  accountName: string
  qrImageKey?: string
}

// ─── Notification ────────────────────────────────────────────────────────
export type UserEventType =
  | 'image:ready' | 'image:failed' | 'payment:success'
  | 'photo:liked' | 'photo:commented' | 'storage:warning'

export type AdminEventType =
  | 'admin:storage:alert' | 'admin:worker:stuck'
  | 'admin:image:error:spike' | 'admin:new:payment' | 'admin:user:registered'

export interface Notification {
  id: string
  type: UserEventType | AdminEventType
  message: string
  data?: Record<string, unknown>
  read: boolean
  createdAt: string
}

// ─── Storage ─────────────────────────────────────────────────────────────
export interface StorageInfo {
  usedBytes: string
  limitBytes: string
}

// ─── Upload ──────────────────────────────────────────────────────────────
export type UploadFileStatus = 'uploading' | 'processing' | 'ready' | 'failed'

export interface UploadFile {
  id: string
  name: string
  progress: number
  status: UploadFileStatus
  imageId?: string
  speed?: number // bytes per second
}

// ─── Admin ───────────────────────────────────────────────────────────────
export interface AdminStats {
  totalUsers: number
  newUsers30d: number
  totalImages: number
  processingImages: number
  failedImages: number
  totalAlbums: number
  revenue30d: number
}

export interface StorageSnapshot {
  id: string
  totalBytesPrivate: string
  totalBytesPublic: string
  totalUsers: number
  totalImages: number
  totalAlbums: number
  newUsersToday: number
  revenueToday: number
  visitCount: number
  snapshotAt: string
}

export interface ChartData {
  snapshots: StorageSnapshot[]
  visits: { date: string; count: number }[]
  revenueMonthly: { month: string; total: number }[]
  planDistribution: { planCode: string; planName: string; userCount: number }[]
}

export interface TopStorageUser {
  userId: string
  displayName: string
  email: string
  avatarKey: string | null
  totalBytes: string
  imageCount: number
}

export interface AdminAlert {
  id: string
  level: 'error' | 'warning'
  message: string
  type: AdminEventType
  dismissedAt?: string
}

// ─── Pagination ──────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  nextCursor: string | null
  total?: number
}

// ─── System Settings ─────────────────────────────────────────────────────
export interface SystemSettings {
  registration_open: boolean
  max_upload_size_mb: number
  allowed_mime_types: string[]
  storage_alert_threshold_percent: number
  image_error_spike_threshold: number
  worker_stuck_minutes: number
  storage_backend: 'r2' | 'local'
  local_storage_dir: string
}
