# PROMPT — Xây dựng hệ thống lưu trữ ảnh cho thợ ảnh chuyên nghiệp

> Dùng prompt này để yêu cầu Claude Code triển khai toàn bộ hệ thống.
> Paste toàn bộ nội dung bên dưới vào Claude Code (hoặc Cursor / Copilot Chat).

---

## 1. BỐI CẢNH & BÀI TOÁN

Xây dựng nền tảng lưu trữ và chia sẻ ảnh chuyên nghiệp dành cho **thợ chụp ảnh**, với các đặc điểm:

- Thợ ảnh upload file RAW dung lượng lớn (CR2/ARW/NEF/DNG, 20–80MB/file)
- Khi **xem** trên web: hiển thị ảnh đã được tối ưu (webp, giảm kích thước) — không cần full RAW
- Khi **download**: trả về file gốc 100% nguyên vẹn (không nén lại)
- Người dùng thường (chưa đăng ký) chỉ được **xem** ảnh công khai
- Thợ ảnh đăng ký tài khoản để upload, quản lý album, nhận thông báo real-time

---

## 2. YÊU CẦU CHỨC NĂNG

### 2.1 Xác thực
- Đăng ký / Đăng nhập bằng email + password
- JWT access token (15 phút) + refresh token (7 ngày) lưu HttpOnly cookie
- OAuth Google (tùy chọn mở rộng)
- Middleware bảo vệ route theo role: `guest | user | admin`

### 2.2 Gói dịch vụ & thanh toán
| Gói | Giá | Album | Lưu trữ | Download | Filter |
|-----|-----|-------|----------|----------|--------|
| Free | 0 ₫ | 5 album | 30 ngày | Không | Không |
| Cơ bản | 49.000 ₫/tháng | Không giới hạn | 30 ngày | Có | Có |
| Pro | 499.000 ₫/năm | Không giới hạn | 1 năm | Có | Có + chỉnh sửa ảnh |

- Add-on dung lượng: +50GB / +200GB / +500GB / +1TB
- Thanh toán thủ công: Admin xem đơn → xác nhận thực tế → gửi mail giao hàng cho KH

### 2.3 Album & ảnh
- Tạo / sửa / xóa album
- Upload ảnh RAW (multipart S3 resumable, hỗ trợ nhiều file cùng lúc, progress per-file)
- Xem ảnh dạng lưới (thumbnail), click xem full preview
- Like / bỏ like ảnh, comment trên ảnh
- Xem danh sách ảnh yêu thích
- Tải album (zip) / tải từng ảnh gốc (Cơ bản + Pro)
- **Bộ lọc & tìm kiếm ảnh** (Cơ bản + Pro):
  - Lọc theo yêu thích (chỉ hiện ảnh đã like)
  - Lọc theo trạng thái: tất cả / đã xử lý / đang xử lý / lỗi
  - Lọc theo khoảng thời gian upload (từ ngày / đến ngày)
  - Sắp xếp: mới nhất / cũ nhất / nhiều like nhất / dung lượng lớn nhất
  - Tìm kiếm theo tên file
- **Chỉnh sửa ảnh frontend** (Pro only): brightness / contrast / saturation / sharpness — CSS filter, không lưu server

### 2.4 Trang Profile người dùng
- Đổi avatar, tên hiển thị, bio
- Đổi mật khẩu (verify mật khẩu cũ)
- **4 stat cards tổng quan:**
  - Tổng ảnh / Đang xử lý / Lỗi
  - Dung lượng đã dùng / Tổng quota (progress bar đổi màu cảnh báo khi > 80%)
  - Số album / Giới hạn album theo gói
  - Tổng like nhận được / Tổng comment nhận được
- **Danh sách album của tôi** (grid ngay trong profile):
  - Card: ảnh bìa, tiêu đề, số ảnh, ngày tạo, badge public/private
  - Badge gói hiện tại kế bên album (Free / Cơ bản / Pro)
  - Ngày hết hạn lưu trữ
  - Quick action: Xem | Sửa | Xóa | Tải zip
- **Gói hiện tại:** badge gói + ngày hết hạn + nút Gia hạn / Nâng cấp
- **Lịch sử thanh toán:** bảng — gói, số tiền, mã tham chiếu, trạng thái, ngày

### 2.5 Thông báo real-time (Socket.io)
**Sự kiện cho user:**
- `image:ready` — RAW xử lý xong
- `image:failed` — decode RAW lỗi
- `payment:success` — gói được kích hoạt
- `photo:liked` — ai đó like ảnh của bạn
- `photo:commented` — comment mới trên ảnh của bạn
- `storage:warning` — còn < 10% dung lượng

**Sự kiện cho admin** (room `admin`):
- `admin:storage:alert` — R2 vượt ngưỡng cảnh báo
- `admin:worker:stuck` — BullMQ job bị treo > 30 phút
- `admin:image:error:spike` — số ảnh lỗi tăng đột biến trong 1 giờ
- `admin:new:payment` — có giao dịch mới
- `admin:user:registered` — user mới đăng ký

### 2.6 Trang Admin (role = admin — full quyền)

Admin có full quyền trên mọi tài nguyên, không bị giới hạn bởi gói dịch vụ.

#### 2.6.1 Dashboard tổng quan (`/admin`)
**Stat cards hàng đầu:**
- Tổng người dùng (+ badge so với tháng trước)
- Người dùng mới 30 ngày
- Doanh thu tháng này (VNĐ)
- Tổng storage đang dùng (GB)
- Ảnh đang xử lý / Ảnh lỗi (badge đỏ nếu > 0)

**Biểu đồ (vue-chartjs):**
- **Line chart — Lượt truy cập 30 ngày:** số request API authenticated mỗi ngày (Redis counter)
- **Line chart — Người dùng mới 30 ngày:** số đăng ký mỗi ngày
- **Bar chart — Doanh thu theo tháng:** 12 tháng gần nhất (VNĐ)
- **Line chart — Dung lượng storage 30 ngày:** tổng GB private + public
- **Donut chart — Phân bổ theo gói:** Free / Cơ bản / Pro chiếm bao nhiêu user
- **Gauge (doughnut bán nguyệt) — R2 usage:** % đã dùng, màu xanh/vàng/đỏ theo ngưỡng

**Bảng cảnh báo real-time** (socket, dismiss-able):
- Banner đỏ: R2 storage vượt ngưỡng
- Banner vàng: Worker BullMQ stuck
- Banner đỏ: Spike ảnh lỗi

**Top 10 user dùng storage nhiều nhất:** avatar, tên, gói, GB, số ảnh, nút Xem

#### 2.6.2 Quản lý người dùng (`/admin/users`)
- Bảng: avatar, tên, email, gói, storage dùng, ngày tạo, trạng thái
- Tìm kiếm theo tên / email
- Lọc theo gói + trạng thái (active / banned)
- Sắp xếp: ngày tạo / storage / tên
- **Actions:**
  - Xem chi tiết: info + gói + lịch sử thanh toán + danh sách album
  - Sửa: tên, email, role
  - Kích hoạt / Tạm khóa (isActive)
  - Tặng gói thủ công (chọn gói + số ngày, bypass thanh toán)
  - Điều chỉnh quota thủ công
  - Xóa tài khoản + cascade (confirm dialog)
- Pagination cursor-based server-side

#### 2.6.3 Quản lý Album (`/admin/albums`)
- Bảng: tên album, owner, số ảnh, dung lượng, public/private, ngày tạo
- Tìm kiếm theo tên / tên user
- Lọc: public/private, gói owner
- Actions: Xem, Ẩn/hiện (override isPublic), Xóa + cascade ảnh

#### 2.6.4 Quản lý thanh toán (`/admin/payments`)
- Bảng: mã tham chiếu, user, gói, số tiền (VNĐ), trạng thái, ngày tạo, ngày thanh toán
- Lọc: trạng thái (pending/awaiting_confirm/paid/failed), gói, khoảng thời gian
- Tìm kiếm theo mã tham chiếu / email
- Tổng doanh thu trong khoảng filter hiện tại
- **Export CSV** báo cáo doanh thu
- Nút "Đánh dấu đã thanh toán" thủ công (cho trường hợp xử lý offline)

#### 2.6.5 Quản lý gói (`/admin/plans`)
- Danh sách gói với số user đang dùng mỗi gói
- Tạo / Sửa gói: tên, giá, quota, thời hạn, canDownload, canFilter, canEditPhoto
- Không xóa gói đang có user active

#### 2.6.6 Cài đặt hệ thống (`/admin/settings`)
- Bật / Tắt đăng ký mới
- Upload size tối đa (MB)
- Định dạng file được phép (multi-select)
- Ngưỡng cảnh báo storage (%)
- Ngưỡng spike lỗi ảnh (số/giờ)
- Thời gian stuck job (phút)

---

## 3. KIẾN TRÚC KỸ THUẬT

### 3.1 Stack công nghệ

```
Frontend   : Vue 3 (Composition API) + Nuxt 3 + TypeScript + Tailwind CSS
Charts     : vue-chartjs + Chart.js — line, bar, doughnut, gauge
Backend    : Nuxt 3 Nitro server + Route Handlers
Database   : MySQL 8 (PlanetScale hoặc self-host)
ORM        : Drizzle ORM
Storage    : Cloudflare R2 (raw-private + serve-public buckets)
CDN        : Cloudflare (trước serve-public)
Cache      : Redis Upstash — session, quota, feed, visit counter
Queue      : BullMQ + Redis — image processing, expiry, monitor
Socket     : Socket.io server (Railway, tách riêng)
Upload     : S3 Multipart Upload (presigned parts) — resumable chunked, không cần tus server
Image proc : dcraw (subprocess) → Sharp.js — RAW decode → 3 phiên bản webp
Deploy     : Vercel (Nuxt) + Railway (Socket.io + Workers)
```

### 3.2 Cloudflare R2 — 2 bucket

```
raw-private/                        ← KHÔNG public
  {userId}/{imageId}/original.cr2

serve-public/                       ← CDN public
  {userId}/{imageId}/thumb.webp     ← 400px
  {userId}/{imageId}/preview.webp   ← 1920px
```

**Luồng Upload (S3 Multipart — thay thế tus.io):**
```
Client → POST /api/images/upload-url   → API trả về { imageId, uploadId, parts[] }
Client → PUT  (presigned part URLs)    → R2 trực tiếp, từng chunk 10MB
Client → POST /api/images/complete     → API gọi CompleteMultipartUpload → enqueue job
Worker → stream RAW từ R2 → dcraw subprocess → Sharp → upload WebP → emit ready
```

**Luồng Download:**
```
API check quyền → presigned URL TTL 15 phút → client stream từ R2
```

**Luồng View:**
```
Browser → CDN HIT 0ms / MISS → R2 → cache + return
```

### 3.3 Redis schema

```
session:{userId}              → refresh token hash
quota:used:{userId}           → bigint bytes đã dùng (INCRBY) — TTL không set (persistent)
quota:limit:{userId}          → bigint bytes giới hạn
feed:album:{albumId}          → JSON danh sách ảnh full page (TTL 5 phút, không embed cursor vào key)
rate:upload:{userId}          → counter 1 phút
notify:pending:{userId}       → list offline notifications
visit:day:{YYYY-MM-DD}        → INCR mỗi API request authenticated (TTL 35 ngày)
webhook:lock:{referenceCode}  → SET NX EX 30 — idempotency lock cho payment webhook/confirm
```

> **Lưu ý quan trọng:**
> - `feed:album:{albumId}` dùng 1 key duy nhất per album, không embed cursor. Pagination thực hiện trong JS sau khi lấy cache.
> - `visit:day` chỉ INCR với request authenticated user để tránh đếm bot/health-check.
> - `quota:used` cần cron reconcile hàng ngày đối chiếu với DB để tránh drift khi worker crash.

### 3.4 Socket.io

```
Vue 3 client (socket.io-client)
    ↕ WebSocket namespace /notify
Socket.io server (Railway)
    ↕ Redis pub/sub adapter (scale multi-instance)
Workers/API → redis.publish → Socket.io → room user:{id} | room admin
```

---

## 4. CẤU TRÚC THƯ MỤC

```
photo-storage/
├── .env.example
├── drizzle.config.ts
├── nuxt.config.ts
├── tailwind.config.ts
├── tsconfig.json
│
├── database/
│   ├── schema.ts
│   ├── migrations/
│   └── seed.ts
│
├── server/
│   ├── plugins/
│   │   ├── socket.ts                 ← Socket.io Nitro plugin
│   │   └── bullmq.ts                 ← Khởi tạo workers
│   │
│   ├── middleware/
│   │   ├── auth.ts                   ← Verify JWT, incrVisit (authenticated only)
│   │   ├── admin.ts                  ← Guard /api/admin/*
│   │   └── rateLimit.ts
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register.post.ts
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   └── refresh.post.ts
│   │   │
│   │   ├── users/
│   │   │   ├── me.get.ts             ← profile + planCode + expiresAt
│   │   │   ├── me.patch.ts           ← update profile / password
│   │   │   ├── me/storage.get.ts     ← used / limit bytes
│   │   │   ├── me/albums.get.ts      ← albums + imageCount + totalBytes + expiresAt
│   │   │   ├── me/stats.get.ts       ← totalImages/likes/comments received
│   │   │   └── me/payments.get.ts    ← payment history
│   │   │
│   │   ├── albums/
│   │   │   ├── index.get.ts          ← public feed
│   │   │   ├── index.post.ts
│   │   │   ├── [id].get.ts
│   │   │   ├── [id].patch.ts
│   │   │   └── [id].delete.ts
│   │   │
│   │   ├── images/
│   │   │   ├── upload-url.post.ts    ← trả về uploadId + presigned part URLs
│   │   │   ├── complete.post.ts      ← CompleteMultipartUpload + enqueue job
│   │   │   ├── index.get.ts          ← ?liked&status&sortBy&dateFrom&dateTo&search&cursor
│   │   │   ├── [id]/like.post.ts
│   │   │   ├── [id]/like.delete.ts
│   │   │   ├── [id]/comments.get.ts
│   │   │   ├── [id]/comments.post.ts
│   │   │   └── [id]/download-url.get.ts
│   │   │
│   │   ├── payments/
│   │   │   ├── create.post.ts
│   │   │   ├── [id]/confirm.post.ts  ← KH bấm "Tôi đã chuyển"
│   │   │   └── [id]/cancel.post.ts
│   │   │
│   │   ├── cron/
│   │   │   ├── expire-images.get.ts  ← Vercel Cron 2h sáng (loop đến hết)
│   │   │   ├── reconcile-quota.get.ts ← Cron 3h sáng: đối chiếu quota:used với DB
│   │   │   └── remind-payments.get.ts ← Cron mỗi giờ
│   │   │
│   │   └── admin/
│   │       ├── dashboard/
│   │       │   ├── stats.get.ts
│   │       │   ├── charts.get.ts
│   │       │   └── alerts.get.ts
│   │       ├── users/
│   │       │   ├── index.get.ts
│   │       │   ├── [id].get.ts
│   │       │   ├── [id].patch.ts
│   │       │   ├── [id].delete.ts
│   │       │   └── [id]/grant-plan.post.ts
│   │       ├── albums/
│   │       │   ├── index.get.ts
│   │       │   ├── [id].patch.ts
│   │       │   └── [id].delete.ts
│   │       ├── payments/
│   │       │   ├── index.get.ts
│   │       │   ├── export.get.ts
│   │       │   ├── [id]/approve.post.ts
│   │       │   └── [id]/reject.post.ts
│   │       ├── plans/
│   │       │   ├── index.get.ts
│   │       │   ├── index.post.ts
│   │       │   └── [id].patch.ts
│   │       ├── payment-methods/
│   │       │   ├── index.get.ts
│   │       │   ├── index.post.ts
│   │       │   ├── [id].patch.ts
│   │       │   └── [id].delete.ts
│   │       └── settings/
│   │           ├── index.get.ts
│   │           └── index.patch.ts
│   │
│   ├── utils/
│   │   ├── db.ts
│   │   ├── redis.ts
│   │   ├── r2.ts
│   │   ├── jwt.ts
│   │   ├── hash.ts
│   │   ├── quota.ts
│   │   ├── socket-emit.ts
│   │   ├── mailService.ts
│   │   └── admin-stats.ts
│   │
│   └── workers/
│       ├── imageProcessor.ts         ← dcraw → Sharp pipeline (stream, không buffer đầy đủ)
│       ├── imageExpiry.ts
│       ├── emailSender.ts
│       └── storageMonitor.ts
│
├── plugins/
│   └── socket.client.ts
│
├── composables/
│   ├── useNotify.ts
│   ├── useUpload.ts                  ← S3 Multipart với progress per-file
│   ├── useInfiniteScroll.ts
│   ├── useAlbumFilter.ts
│   ├── useImageFilter.ts
│   ├── useQuota.ts
│   └── useAdminAlerts.ts
│
├── stores/
│   ├── auth.ts
│   ├── notification.ts
│   ├── upload.ts
│   └── admin.ts
│
├── components/
│   ├── layout/
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   ├── AdminSidebar.vue
│   │   └── NotificationBell.vue
│   │
│   ├── profile/
│   │   ├── ProfileStatCards.vue
│   │   ├── ProfileAlbumGrid.vue
│   │   ├── ProfileAlbumCard.vue
│   │   ├── ProfilePlanBadge.vue
│   │   └── PaymentHistoryTable.vue
│   │
│   ├── album/
│   │   ├── AlbumGrid.vue
│   │   ├── AlbumCard.vue
│   │   └── AlbumForm.vue
│   │
│   ├── image/
│   │   ├── ImageCard.vue
│   │   ├── ImageLightbox.vue
│   │   ├── ImageUploader.vue         ← per-file progress bar (uploading/processing/ready/failed)
│   │   ├── ImageFilterBar.vue
│   │   └── CommentList.vue
│   │
│   ├── admin/
│   │   ├── StatCard.vue
│   │   ├── AlertBanner.vue
│   │   ├── StorageGauge.vue
│   │   ├── VisitLineChart.vue
│   │   ├── NewUsersLineChart.vue
│   │   ├── RevenueBarChart.vue
│   │   ├── StorageLineChart.vue
│   │   ├── PlanDonutChart.vue
│   │   ├── TopUsersTable.vue
│   │   ├── UserTable.vue
│   │   ├── UserDetailModal.vue
│   │   ├── AlbumAdminTable.vue
│   │   └── PaymentAdminTable.vue
│   │
│   ├── payment/
│   │   ├── PlanCard.vue
│   │   └── PaymentModal.vue          ← hiển thị thông tin TK + hướng dẫn CK + nút xác nhận
│   │
│   └── ui/
│       ├── BaseButton.vue
│       ├── BaseModal.vue
│       ├── BaseToast.vue
│       ├── BaseTable.vue
│       ├── BaseBadge.vue
│       ├── BaseConfirm.vue
│       └── StorageBar.vue
│
└── pages/
    ├── index.vue
    ├── login.vue
    ├── register.vue
    ├── upgrade.vue
    ├── dashboard/
    │   ├── index.vue
    │   ├── albums/
    │   │   ├── index.vue
    │   │   ├── [id].vue
    │   │   └── new.vue
    │   ├── favorites.vue
    │   ├── profile.vue
    │   └── settings.vue
    └── admin/
        ├── index.vue
        ├── users/
        │   ├── index.vue
        │   └── [id].vue
        ├── albums/
        │   └── index.vue
        ├── payments/
        │   └── index.vue
        ├── plans/
        │   └── index.vue
        ├── payment-methods/
        │   └── index.vue
        └── settings/
            └── index.vue
```

---

## 5. DATABASE SCHEMA — MySQL 8 (Drizzle ORM)

```typescript
// database/schema.ts
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
  maxAlbums:    int('max_albums'),                        // null = unlimited
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
  // bank_transfer: { bankId, bankName, accountNo, accountName, branch, qrImageKey }
  // momo:          { phone, accountName, qrImageKey }
  // zalopay:       { phone, accountName, qrImageKey }
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
  coverKey:    varchar('cover_key', { length: 500 }),
  isPublic:    boolean('is_public').default(true).notNull(),
  isActive:    boolean('is_active').default(true).notNull(),
  imageCount:  int('image_count').default(0).notNull(),
  totalBytes:  bigint('total_bytes', { mode: 'bigint' }).default(BigInt(0)).notNull(),
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
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType:     varchar('mime_type', { length: 100 }).notNull(),
  originalSize: bigint('original_size', { mode: 'bigint' }).notNull(),
  width:        int('width'),
  height:       int('height'),
  status:       mysqlEnum('status', ['uploading', 'processing', 'ready', 'failed'])
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
  userId:    varchar('user_id', { length: 26 }).notNull(),
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

// ─── SYSTEM SETTINGS ──────────────────────────────────────────────────────
export const systemSettings = mysqlTable('system_settings', {
  key:       varchar('key', { length: 100 }).primaryKey(),
  value:     text('value').notNull(),
  updatedAt: datetime('updated_at').default(sql`NOW()`).notNull(),
  updatedBy: varchar('updated_by', { length: 26 }),
})
// Seed keys mặc định:
// registration_open              = "true"
// max_upload_size_mb             = "200"
// allowed_mime_types             = '["image/x-canon-cr2","image/x-sony-arw","image/x-nikon-nef","image/x-adobe-dng","image/jpeg","image/png","image/tiff"]'
// storage_alert_threshold_percent = "80"
// image_error_spike_threshold    = "20"
// worker_stuck_minutes           = "30"

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
// storageMonitor worker chạy mỗi giờ → INSERT 1 row
// Admin chart đọc 30 rows gần nhất theo snapshotAt DESC
```

---

## 6. SERVER UTILS — HÀM DÙNG CHUNG

### 6.1 `server/utils/db.ts`
```typescript
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '~/database/schema'

const pool = mysql.createPool(process.env.DATABASE_URL!)
export const db = drizzle(pool, { schema, mode: 'default' })
export type DB = typeof db
```

### 6.2 `server/utils/redis.ts`
```typescript
import { createClient } from 'redis'

export const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

export const quotaRedis = {
  async getUsed(userId: string): Promise<bigint> {
    return BigInt((await redis.get(`quota:used:${userId}`)) ?? 0)
  },
  async addUsed(userId: string, bytes: bigint): Promise<void> {
    await redis.incrBy(`quota:used:${userId}`, bytes)
  },
  async decrUsed(userId: string, bytes: bigint): Promise<void> {
    await redis.decrBy(`quota:used:${userId}`, bytes)
  },
  async getLimit(userId: string): Promise<bigint> {
    return BigInt((await redis.get(`quota:limit:${userId}`)) ?? 5 * 1024 ** 3)
  },
  async setLimit(userId: string, bytes: bigint): Promise<void> {
    await redis.set(`quota:limit:${userId}`, bytes.toString())
  },
}

export const feedCache = {
  async get<T>(key: string): Promise<T | null> {
    const v = await redis.get(key)
    return v ? JSON.parse(v) : null
  },
  async set(key: string, data: unknown, ttlSec = 300): Promise<void> {
    await redis.set(key, JSON.stringify(data), { EX: ttlSec })
  },
  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length) await redis.del(keys)
  },
}

// Chỉ đếm request từ authenticated user, exclude /api/cron và /api/health
export async function incrVisit(userId: string): Promise<void> {
  if (!userId) return
  const key = `visit:day:${new Date().toISOString().slice(0, 10)}`
  await redis.incr(key)
  await redis.expire(key, 35 * 86400) // TTL 35 ngày, tự cleanup
}

// Idempotency lock cho payment — trả về true nếu có thể tiếp tục
export async function acquirePaymentLock(referenceCode: string): Promise<boolean> {
  const key = `webhook:lock:${referenceCode}`
  const result = await redis.set(key, '1', { NX: true, EX: 30 })
  return result === 'OK'
}
```

### 6.3 `server/utils/r2.ts`
```typescript
import {
  S3Client, GetObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Readable } from 'stream'

const cfg = {
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY!, secretAccessKey: process.env.R2_SECRET_KEY! },
}
const r2Private = new S3Client(cfg)
const r2Public  = new S3Client(cfg)

const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB per part

export const r2 = {
  // ── Multipart Upload (thay thế presigned PUT đơn) ──────────────────────
  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const res = await r2Private.send(new CreateMultipartUploadCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key, ContentType: contentType,
    }))
    return res.UploadId!
  },

  async presignPart(key: string, uploadId: string, partNumber: number, expiresIn = 3600): Promise<string> {
    return getSignedUrl(r2Private, new UploadPartCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key,
      UploadId: uploadId, PartNumber: partNumber,
    }), { expiresIn })
  },

  async completeMultipart(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]): Promise<void> {
    await r2Private.send(new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key, UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }))
  },

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    await r2Private.send(new AbortMultipartUploadCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key, UploadId: uploadId,
    }))
  },

  // ── Download presigned URL ──────────────────────────────────────────────
  async downloadUrl(key: string, filename: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(r2Private,
      new GetObjectCommand({
        Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
      }), { expiresIn })
  },

  // ── Stream (dùng trong worker để tránh buffer 80MB vào RAM) ────────────
  async getStream(key: string): Promise<Readable> {
    const res = await r2Private.send(new GetObjectCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key,
    }))
    return res.Body as Readable
  },

  // ── Upload WebP (public bucket) ────────────────────────────────────────
  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await r2Public.send(new PutObjectCommand({
      Bucket: process.env.R2_PUBLIC_BUCKET!, Key: key, Body: buffer,
      ContentType: contentType, CacheControl: 'public, max-age=2592000',
    }))
  },

  // ── Delete ─────────────────────────────────────────────────────────────
  async deletePrivate(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k =>
      r2Private.send(new DeleteObjectCommand({ Bucket: process.env.R2_PRIVATE_BUCKET!, Key: k }))
    ))
  },
  async deletePublic(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k =>
      r2Public.send(new DeleteObjectCommand({ Bucket: process.env.R2_PUBLIC_BUCKET!, Key: k }))
    ))
  },

  publicUrl(key: string): string { return `${process.env.CDN_URL}/${key}` },
}
```

### 6.4 `server/utils/jwt.ts`
```typescript
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

export interface JWTPayload {
  sub:      string
  email:    string
  role:     'user' | 'admin'
  planCode: string   // free|basic|pro — trong token để middleware check nhanh
}

export const jwtUtils = {
  async sign(payload: JWTPayload, expiresIn = '15m'): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt().setExpirationTime(expiresIn).sign(secret)
  },
  async verify(token: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, secret)
      return payload as unknown as JWTPayload
    } catch { return null }
  },
}
```

### 6.5 `server/utils/quota.ts`
```typescript
import { db } from './db'
import { quotaRedis } from './redis'
import { userPlans, plans, storageAddons } from '~/database/schema'
import { and, eq, gt } from 'drizzle-orm'

export const quotaUtils = {
  async getTotalQuota(userId: string): Promise<bigint> {
    const [activePlan] = await db
      .select({ quotaBytes: plans.quotaBytes })
      .from(userPlans).innerJoin(plans, eq(userPlans.planId, plans.id))
      .where(and(eq(userPlans.userId, userId), eq(userPlans.isActive, true)))
      .limit(1)

    const addons = await db.select({ bytes: storageAddons.bytes }).from(storageAddons)
      .where(and(eq(storageAddons.userId, userId), gt(storageAddons.expiresAt, new Date())))

    return (activePlan?.quotaBytes ?? BigInt(5 * 1024 ** 3))
      + addons.reduce((s, a) => s + a.bytes, BigInt(0))
  },

  async canUpload(userId: string, fileBytes: bigint): Promise<{ ok: boolean; reason?: string }> {
    const [used, total] = await Promise.all([quotaRedis.getUsed(userId), this.getTotalQuota(userId)])
    return used + fileBytes > total
      ? { ok: false, reason: 'Không đủ dung lượng. Vui lòng nâng cấp gói.' }
      : { ok: true }
  },

  async addUsed(userId: string, bytes: bigint)      { await quotaRedis.addUsed(userId, bytes) },
  async subtractUsed(userId: string, bytes: bigint) { await quotaRedis.decrUsed(userId, bytes) },
}
```

### 6.6 `server/utils/socket-emit.ts`
```typescript
import { createClient } from 'redis'

const pub = createClient({ url: process.env.REDIS_URL })
await pub.connect()

export type UserEvent =
  | { type: 'image:ready';     imageId: string; thumbUrl: string }
  | { type: 'image:failed';    imageId: string; reason: string }
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
  await pub.publish('socket:notify', JSON.stringify({ userId, event }))
}

export async function emitToAdmin(event: AdminEvent): Promise<void> {
  await pub.publish('socket:notify', JSON.stringify({ room: 'admin', event }))
}
```

### 6.7 `server/utils/admin-stats.ts`
```typescript
import { db } from './db'
import { redis } from './redis'
import * as schema from '~/database/schema'
import { sql, eq, gte, and, desc } from 'drizzle-orm'

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

    // Visit từ Redis — dùng mGet một lần thay vì N lần GET
    const visitKeys = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
      return `visit:day:${d}`
    }).reverse()
    const visitVals = await redis.mGet(visitKeys)
    const visits = visitKeys.map((k, i) => ({
      date: k.split(':').pop()!, count: parseInt(visitVals[i] ?? '0'),
    }))

    const revenueMonthly = await db.select({
      month: sql<string>`DATE_FORMAT(paid_at,'%Y-%m')`,
      total: sql<number>`SUM(amount_vnd)`,
    }).from(schema.payments)
      .where(and(eq(schema.payments.status, 'paid'),
        gte(schema.payments.paidAt!, new Date(Date.now() - 365 * 86400_000))))
      .groupBy(sql`DATE_FORMAT(paid_at,'%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(paid_at,'%Y-%m')`)

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
    .from(schema.images).innerJoin(schema.users, eq(schema.images.userId, schema.users.id))
    .where(eq(schema.images.status, 'ready'))
    .groupBy(schema.images.userId, schema.users.displayName, schema.users.email, schema.users.avatarKey)
    .orderBy(desc(sql`SUM(${schema.images.originalSize})`))
    .limit(limit)
  },

  async log(adminId: string, action: string, targetType?: string, targetId?: string, meta?: object) {
    const { ulid } = await import('ulid')
    await db.insert(schema.adminLogs).values({
      id: ulid(), adminId, action, targetType, targetId,
      meta: meta ? JSON.stringify(meta) : null,
    })
  },
}
```

---

## 7. MIDDLEWARE

```typescript
// server/middleware/auth.ts
import { jwtUtils } from '~/server/utils/jwt'
import { incrVisit } from '~/server/utils/redis'

// Danh sách path không đếm visit
const SKIP_VISIT_PATHS = ['/api/cron', '/api/health', '/api/_']

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'access_token')
    ?? getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (token) {
    const payload = await jwtUtils.verify(token)
    if (payload) {
      event.context.user = payload
      // Chỉ đếm visit nếu là request authenticated và không phải path hệ thống
      const isApi = event.path.startsWith('/api')
      const isSkip = SKIP_VISIT_PATHS.some(p => event.path.startsWith(p))
      if (isApi && !isSkip) await incrVisit(payload.sub)
    }
  }
})

export function requireAuth(event: H3Event) {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Chưa đăng nhập' })
  return event.context.user
}

export function requireAdmin(event: H3Event) {
  const user = requireAuth(event)
  if (user.role !== 'admin') throw createError({ statusCode: 403, message: 'Không có quyền' })
  return user
}

export function requirePlan(event: H3Event, plan: 'basic' | 'pro') {
  const user = requireAuth(event)
  const order: Record<string, number> = { free: 0, basic: 1, pro: 2, admin: 99 }
  if ((order[user.planCode] ?? 0) < order[plan])
    throw createError({ statusCode: 403, message: `Yêu cầu gói ${plan} trở lên` })
  return user
}

// server/middleware/admin.ts
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/admin')) return
  if (!event.context.user || event.context.user.role !== 'admin')
    throw createError({ statusCode: 403, message: 'Admin only' })
})
```

---

## 8. UPLOAD — S3 MULTIPART (thay thế tus.io)

> **Tại sao không dùng tus.io:** tus.io protocol yêu cầu một tus server riêng để reassemble chunk — không tương thích trực tiếp với S3/R2 presigned URL. S3 Multipart Upload là cơ chế native của R2, hỗ trợ resumable chunked upload mà không cần infra bổ sung.

### `server/api/images/upload-url.post.ts`
```typescript
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const { filename, size, albumId, mimeType } = await readBody(event)

  // Verify magic bytes phía client đã gửi kèm (4 byte đầu)
  const allowed = JSON.parse((await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'allowed_mime_types')
  }))?.value ?? '[]') as string[]
  if (!allowed.includes(mimeType))
    throw createError({ statusCode: 400, message: 'Định dạng file không được phép' })

  const quota = await quotaUtils.canUpload(user.sub, BigInt(size))
  if (!quota.ok) throw createError({ statusCode: 403, message: quota.reason })

  const imageId   = ulid()
  const key       = `${user.sub}/${imageId}/original${path.extname(filename)}`
  const uploadId  = await r2.createMultipartUpload(key, mimeType)

  // Tính số parts cần thiết (10MB mỗi part)
  const CHUNK = 10 * 1024 * 1024
  const totalParts = Math.ceil(size / CHUNK)
  const partUrls = await Promise.all(
    Array.from({ length: totalParts }, (_, i) =>
      r2.presignPart(key, uploadId, i + 1)
    )
  )

  // Tạo record ảnh với status 'uploading'
  await db.insert(images).values({
    id: imageId, albumId, userId: user.sub,
    originalKey: key, originalName: filename,
    mimeType, originalSize: BigInt(size), status: 'uploading',
    expiresAt: new Date(Date.now() + 365 * 86400_000), // tính lại sau khi biết gói
  })

  return { imageId, uploadId, key, partUrls }
})
```

### `server/api/images/complete.post.ts`
```typescript
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const { imageId, uploadId, key, parts } = await readBody(event)
  // parts: [{ ETag: string, PartNumber: number }]

  const [image] = await db.select().from(images)
    .where(and(eq(images.id, imageId), eq(images.userId, user.sub))).limit(1)
  if (!image) throw createError({ statusCode: 404 })

  await r2.completeMultipart(key, uploadId, parts)
  await db.update(images).set({ status: 'processing' }).where(eq(images.id, imageId))
  await quotaUtils.addUsed(user.sub, image.originalSize)

  // Enqueue BullMQ job
  await imageQueue.add('process', { imageId, userId: user.sub, originalKey: key })

  return { ok: true }
})
```

### `composables/useUpload.ts` — S3 Multipart với progress per-file
```typescript
import { useUploadStore } from '~/stores/upload'

export function useUpload() {
  const store = useUploadStore()

  async function uploadFiles(files: File[], albumId: string) {
    for (const file of files) {
      const localId = crypto.randomUUID()
      store.add({ id: localId, name: file.name, progress: 0, status: 'uploading' })

      try {
        // Bước 1: Lấy uploadId + presigned part URLs
        const { imageId, uploadId, key, partUrls } = await $fetch<{
          imageId: string; uploadId: string; key: string; partUrls: string[]
        }>('/api/images/upload-url', {
          method: 'POST',
          body: { filename: file.name, size: file.size, albumId, mimeType: file.type },
        })

        // Bước 2: Upload từng part lên R2 trực tiếp
        const CHUNK = 10 * 1024 * 1024
        const completedParts: { ETag: string; PartNumber: number }[] = []
        let uploadedBytes = 0

        for (let i = 0; i < partUrls.length; i++) {
          const start  = i * CHUNK
          const end    = Math.min(start + CHUNK, file.size)
          const chunk  = file.slice(start, end)

          const res = await fetch(partUrls[i], { method: 'PUT', body: chunk })
          const etag = res.headers.get('ETag')!
          completedParts.push({ ETag: etag, PartNumber: i + 1 })

          uploadedBytes += (end - start)
          store.setProgress(localId, (uploadedBytes / file.size) * 100)
        }

        // Bước 3: Complete multipart
        store.setStatus(localId, 'processing')
        await $fetch('/api/images/complete', {
          method: 'POST',
          body: { imageId, uploadId, key, parts: completedParts },
        })
      } catch {
        store.setStatus(localId, 'failed')
      }
    }
  }

  return { uploadFiles, files: computed(() => store.files) }
}
```

---

## 9. WORKERS

### `server/workers/imageProcessor.ts` — dcraw → Sharp stream pipeline
```typescript
import { Worker } from 'bullmq'
import sharp from 'sharp'
import { spawn } from 'child_process'
import { PassThrough } from 'stream'
import { db } from '~/server/utils/db'
import { r2 } from '~/server/utils/r2'
import { emitToUser } from '~/server/utils/socket-emit'
import { images } from '~/database/schema'
import { eq } from 'drizzle-orm'

// Kiểm tra mime type có phải RAW không
const RAW_MIME_TYPES = new Set([
  'image/x-canon-cr2', 'image/x-sony-arw',
  'image/x-nikon-nef', 'image/x-adobe-dng',
])

async function decodeToTiff(inputStream: NodeJS.ReadableStream): Promise<Buffer> {
  // dcraw cần file path, dùng stdin pipe qua '-' flag
  return new Promise((resolve, reject) => {
    const dcraw = spawn('dcraw', ['-c', '-w', '-T', '-'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []

    inputStream.pipe(dcraw.stdin)
    dcraw.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    dcraw.stdout.on('end', () => resolve(Buffer.concat(chunks)))
    dcraw.on('error', reject)
    dcraw.stderr.on('data', (d: Buffer) => console.error('[dcraw]', d.toString()))
    dcraw.on('exit', (code) => { if (code !== 0) reject(new Error(`dcraw exit ${code}`)) })
  })
}

export const imageWorker = new Worker('image-process', async (job) => {
  const { imageId, userId, originalKey, mimeType } = job.data
  try {
    // Lấy stream từ R2 (không buffer toàn bộ file vào RAM)
    const rawStream = await r2.getStream(originalKey)

    let sharpInput: Buffer | NodeJS.ReadableStream

    if (RAW_MIME_TYPES.has(mimeType)) {
      // RAW format: cần decode qua dcraw trước
      // dcraw không hỗ trợ pipe stdin trực tiếp → buffer TIFF output
      // TIFF output nhỏ hơn nhiều so với RAW gốc
      sharpInput = await decodeToTiff(rawStream)
    } else {
      // JPEG/PNG/TIFF: Sharp xử lý trực tiếp qua stream
      sharpInput = rawStream
    }

    const pipeline = sharp(sharpInput, { failOn: 'none' })

    const [thumbBuf, previewBuf, meta] = await Promise.all([
      pipeline.clone().resize(400).webp({ quality: 80 }).toBuffer(),
      pipeline.clone().resize(1920, 1920, { fit: 'inside' }).webp({ quality: 85 }).toBuffer(),
      pipeline.metadata(),
    ])

    const base = `${userId}/${imageId}`
    await Promise.all([
      r2.uploadBuffer(`${base}/thumb.webp`, thumbBuf, 'image/webp'),
      r2.uploadBuffer(`${base}/preview.webp`, previewBuf, 'image/webp'),
    ])

    await db.update(images).set({
      thumbKey: `${base}/thumb.webp`, previewKey: `${base}/preview.webp`,
      width: meta.width, height: meta.height, status: 'ready',
    }).where(eq(images.id, imageId))

    await emitToUser(userId, {
      type: 'image:ready', imageId,
      thumbUrl: r2.publicUrl(`${base}/thumb.webp`),
    })
  } catch (err) {
    await db.update(images).set({ status: 'failed' }).where(eq(images.id, imageId))
    await emitToUser(userId, { type: 'image:failed', imageId, reason: String(err) })
    throw err
  }
}, { connection: { url: process.env.REDIS_URL }, concurrency: 3 })

// Lưu ý: cài dcraw trên Railway worker image
// Dockerfile: RUN apt-get install -y dcraw
// Hoặc dùng libraw-tools: RUN apt-get install -y libraw-bin
```

### `server/workers/storageMonitor.ts`
```typescript
import { Worker } from 'bullmq'
import { db } from '~/server/utils/db'
import { redis } from '~/server/utils/redis'
import * as schema from '~/database/schema'
import { emitToAdmin } from '~/server/utils/socket-emit'
import { sql, eq, gte, and } from 'drizzle-orm'
import { ulid } from 'ulid'

export const storageMonitorWorker = new Worker('storage-monitor', async () => {
  const today = new Date().toISOString().slice(0, 10)

  const [[imgStats], [userCount], [albumCount], [todayRev], [todayUsers]] = await Promise.all([
    db.select({
      totalPrivate: sql<string>`COALESCE(SUM(original_size),0)`,
      count: sql<number>`COUNT(*)`,
    }).from(schema.images).where(eq(schema.images.status, 'ready')),
    db.select({ c: sql<number>`COUNT(*)` }).from(schema.users),
    db.select({ c: sql<number>`COUNT(*)` }).from(schema.albums),
    db.select({ t: sql<number>`COALESCE(SUM(amount_vnd),0)` }).from(schema.payments)
      .where(and(eq(schema.payments.status, 'paid'), gte(schema.payments.paidAt!, new Date(today)))),
    db.select({ c: sql<number>`COUNT(*)` }).from(schema.users)
      .where(gte(schema.users.createdAt, new Date(today))),
  ])

  const visitCount = parseInt((await redis.get(`visit:day:${today}`)) ?? '0')

  await db.insert(schema.storageSnapshots).values({
    id: ulid(),
    totalBytesPrivate: BigInt(imgStats.totalPrivate),
    totalBytesPublic:  BigInt(imgStats.totalPrivate) / BigInt(10), // ước tính WebP ~10%
    totalUsers: userCount.c, totalImages: imgStats.count,
    totalAlbums: albumCount.c, newUsersToday: todayUsers.c,
    revenueToday: todayRev.t, visitCount,
  })

  // Ngưỡng cảnh báo storage
  const [threshRow] = await db.select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, 'storage_alert_threshold_percent'))
  const threshold = parseInt(threshRow?.value ?? '80')
  const r2LimitBytes = BigInt(parseInt(process.env.R2_LIMIT_GB ?? '10') * 1024 ** 3)
  const usedPct = Number(BigInt(imgStats.totalPrivate) * BigInt(100) / r2LimitBytes)
  if (usedPct >= threshold)
    await emitToAdmin({ type: 'admin:storage:alert', message: `R2 dùng ${usedPct}%`, usedPercent: usedPct })

  // Spike ảnh lỗi trong 1 giờ qua
  const [spikeRow] = await db.select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, 'image_error_spike_threshold'))
  const spikeN = parseInt(spikeRow?.value ?? '20')
  const [errRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(schema.images)
    .where(and(eq(schema.images.status, 'failed'),
      gte(schema.images.createdAt, new Date(Date.now() - 3600_000))))
  if (errRow.c >= spikeN)
    await emitToAdmin({ type: 'admin:image:error:spike', count: errRow.c, threshold: spikeN })
}, { connection: { url: process.env.REDIS_URL } })
```

---

## 10. HỆ THỐNG THANH TOÁN & MAIL SERVICE

### 10.1 Tổng quan — xác nhận thủ công từ Admin

```
Trạng thái đơn hàng:
  pending           → KH vừa đặt, chưa chuyển khoản
  awaiting_confirm  → KH bấm "Tôi đã chuyển", chờ admin duyệt
  paid              → Admin xác nhận, gói đã kích hoạt
  failed            → Admin từ chối hoặc đơn hết hạn (24h)
```

**Luồng email:**
| Sự kiện | Người nhận |
|---------|-----------|
| KH đặt hàng | Admin (order_new) |
| KH bấm "đã chuyển" | Admin (order_customer_confirm) |
| Admin duyệt | KH (order_paid — kèm thông tin tài khoản) |
| Admin từ chối | KH (order_failed — kèm lý do) |
| Đơn pending > 12h | KH (order_reminder — cron mỗi giờ) |

### 10.2 `server/utils/mailService.ts`
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export type MailTemplate =
  | 'order_new' | 'order_customer_confirm' | 'order_paid'
  | 'order_failed' | 'order_reminder' | 'register_welcome'
  | 'reset_password' | 'storage_warning'

export interface MailPayload {
  to:       string | string[]
  template: MailTemplate
  data:     Record<string, unknown>
}

function formatVnd(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

function wrapLayout(content: string, title: string): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">
  <div style="border-bottom:3px solid #f97316;padding-bottom:16px;margin-bottom:24px">
    <strong style="font-size:20px">${process.env.APP_NAME}</strong>
  </div>
  ${content}
  <div style="border-top:1px solid #e5e7eb;margin-top:32px;padding-top:16px;color:#9ca3af;font-size:12px">
    <p>${process.env.APP_NAME} · ${process.env.APP_ADDRESS ?? ''}</p>
    <p>Zalo: ${process.env.SUPPORT_PHONE} · Email: ${process.env.SUPPORT_EMAIL}</p>
  </div>
</body></html>`
}

const templates: Record<MailTemplate, (d: Record<string, unknown>) => { subject: string; html: string }> = {
  order_new: (d) => ({
    subject: `[Đơn mới] #${d.orderId} — ${formatVnd(d.amountVnd as number)}`,
    html: `<h2>Có đơn hàng mới</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px 6px 0"><b>Mã đơn</b></td><td>#${d.orderId}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Khách hàng</b></td><td>${d.customerName} — ${d.customerEmail}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Sản phẩm</b></td><td>${d.planName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Số tiền</b></td><td>${formatVnd(d.amountVnd as number)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Nội dung CK</b></td><td>${d.referenceCode}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Phương thức</b></td><td>${d.methodName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Thời gian</b></td><td>${d.createdAt}</td></tr>
      </table>
      <p style="margin-top:20px"><a href="${process.env.APP_URL}/admin/payments/${d.paymentId}"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Xem đơn hàng
      </a></p>`,
  }),

  order_customer_confirm: (d) => ({
    subject: `[Xác nhận CK] #${d.orderId} — ${d.customerName} báo đã chuyển`,
    html: `<h2>Khách hàng xác nhận đã chuyển khoản</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px 6px 0"><b>Mã đơn</b></td><td>#${d.orderId}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Khách hàng</b></td><td>${d.customerName} — ${d.customerEmail}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Số tiền</b></td><td>${formatVnd(d.amountVnd as number)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Nội dung CK</b></td><td>${d.referenceCode}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Ghi chú KH</b></td><td>${d.customerNote || '(không có)'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Thời gian XN</b></td><td>${d.confirmedAt}</td></tr>
      </table>
      <p style="margin-top:20px">
        <a href="${process.env.APP_URL}/admin/payments/${d.paymentId}?action=approve"
          style="background:#16a34a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
          Duyệt thanh toán
        </a>
        <a href="${process.env.APP_URL}/admin/payments/${d.paymentId}?action=reject"
          style="background:#dc2626;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px;margin-left:12px">
          Từ chối
        </a>
      </p>`,
  }),

  order_paid: (d) => ({
    subject: `Thanh toán thành công — Đơn hàng #${d.orderId}`,
    html: `<h2>Cảm ơn bạn đã mua hàng!</h2>
      <p>Đơn hàng <b>#${d.orderId}</b> đã được xác nhận thanh toán.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px 6px 0"><b>Sản phẩm</b></td><td>${d.planName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Hiệu lực từ</b></td><td>${d.startedAt}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Hết hạn</b></td><td>${d.expiresAt}</td></tr>
      </table>
      ${d.deliveryInfo ? `<h3>Thông tin tài khoản</h3>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;font-family:monospace;font-size:14px;white-space:pre-line">
        ${d.deliveryInfo}
      </div>` : ''}
      <p style="color:#6b7280;font-size:13px;margin-top:24px">
        Cần hỗ trợ? Liên hệ Zalo: ${process.env.SUPPORT_PHONE}
      </p>`,
  }),

  order_failed: (d) => ({
    subject: `Đơn hàng #${d.orderId} không thành công`,
    html: `<h2>Đơn hàng không được xác nhận</h2>
      <p>Rất tiếc, đơn hàng <b>#${d.orderId}</b> của bạn không thể xử lý.</p>
      ${d.adminNote ? `<p><b>Lý do:</b> ${d.adminNote}</p>` : ''}
      <p>Liên hệ để được hỗ trợ:</p>
      <ul style="font-size:14px"><li>Zalo: ${process.env.SUPPORT_PHONE}</li><li>Email: ${process.env.SUPPORT_EMAIL}</li></ul>
      <a href="${process.env.APP_URL}/upgrade"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Thử lại
      </a>`,
  }),

  order_reminder: (d) => ({
    subject: `Nhắc nhở: Đơn #${d.orderId} chưa thanh toán — còn ${d.hoursLeft}h`,
    html: `<h2>Đơn hàng của bạn đang chờ thanh toán</h2>
      <p>Đơn <b>#${d.orderId}</b> — <b>${formatVnd(d.amountVnd as number)}</b> sẽ hết hạn sau <b>${d.hoursLeft} giờ</b>.</p>
      <p>Chuyển khoản với nội dung: <b>${d.referenceCode}</b></p>
      <a href="${process.env.APP_URL}/orders/${d.paymentId}"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Xem chi tiết đơn hàng
      </a>`,
  }),

  register_welcome: (d) => ({
    subject: `Chào mừng ${d.displayName} đến với ${process.env.APP_NAME}!`,
    html: `<h2>Xin chào ${d.displayName}!</h2>
      <p>Tài khoản của bạn đã được tạo thành công.</p>
      <a href="${process.env.APP_URL}/dashboard"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Bắt đầu ngay
      </a>`,
  }),

  reset_password: (d) => ({
    subject: 'Đặt lại mật khẩu',
    html: `<h2>Đặt lại mật khẩu</h2>
      <p>Link có hiệu lực trong 30 phút:</p>
      <a href="${d.resetUrl}"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Đặt lại mật khẩu
      </a>
      <p style="color:#6b7280;font-size:13px;margin-top:16px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  }),

  storage_warning: (d) => ({
    subject: `Cảnh báo: Dung lượng lưu trữ còn ${d.remainPercent}%`,
    html: `<h2>Dung lượng sắp đầy</h2>
      <p>Bạn đã dùng <b>${d.usedGB}GB / ${d.limitGB}GB</b> (${100 - (d.remainPercent as number)}%).</p>
      <a href="${process.env.APP_URL}/upgrade"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Nâng cấp dung lượng
      </a>`,
  }),
}

export const mailService = {
  async send({ to, template, data }: MailPayload): Promise<void> {
    const builder = templates[template]
    if (!builder) throw new Error(`Unknown mail template: ${template}`)
    const { subject, html } = builder(data)
    await resend.emails.send({
      from: `${process.env.APP_NAME} <${process.env.FROM_EMAIL}>`,
      to:   Array.isArray(to) ? to : [to],
      subject,
      html: wrapLayout(html, subject),
    })
  },

  async sendToAdmins(template: MailTemplate, data: Record<string, unknown>): Promise<void> {
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
    if (!adminEmails.length) return
    await this.send({ to: adminEmails, template, data })
  },
}
```

### 10.3 Payment API

```typescript
// server/api/payments/create.post.ts
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const { planCode, paymentMethodId } = await readBody(event)

  const plan = await db.query.plans.findFirst({ where: eq(plans.code, planCode) })
  if (!plan) throw createError({ statusCode: 400, message: 'Gói không tồn tại' })

  const method = await db.query.paymentMethods.findFirst({
    where: paymentMethodId
      ? and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.isActive, true))
      : and(eq(paymentMethods.isDefault, true), eq(paymentMethods.isActive, true)),
  })
  if (!method) throw createError({ statusCode: 400, message: 'Không có phương thức thanh toán' })

  const ref = `DH${ulid().slice(-6).toUpperCase()}`
  const paymentId = ulid()
  await db.insert(payments).values({
    id: paymentId, userId: user.sub, planId: plan.id,
    amountVnd: plan.priceVnd, referenceCode: ref,
    paymentMethodId: method.id, status: 'pending',
    expiresAt: new Date(Date.now() + 24 * 3600_000),
  })

  const [customer] = await db.select().from(users).where(eq(users.id, user.sub)).limit(1)
  await mailService.sendToAdmins('order_new', {
    orderId: ref, paymentId,
    customerName: customer.displayName, customerEmail: customer.email,
    planName: plan.name, amountVnd: plan.priceVnd,
    referenceCode: ref, methodName: method.name,
    createdAt: new Date().toLocaleString('vi-VN'),
  })

  return {
    paymentId, referenceCode: ref, amount: plan.priceVnd,
    method: { type: method.type, name: method.name, config: JSON.parse(method.config) },
  }
})

// server/api/payments/[id]/confirm.post.ts — KH bấm "Tôi đã chuyển"
// Dùng Redis lock để tránh double-confirm
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const { id } = getRouterParams(event)
  const { customerNote } = await readBody(event)

  const [payment] = await db.select().from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, user.sub), eq(payments.status, 'pending')))
    .limit(1)
  if (!payment) throw createError({ statusCode: 404 })
  if (payment.expiresAt && payment.expiresAt < new Date())
    throw createError({ statusCode: 400, message: 'Đơn hàng đã hết hạn' })

  // Idempotency: nếu đã lock thì không xử lý lại
  const locked = await acquirePaymentLock(payment.referenceCode)
  if (!locked) throw createError({ statusCode: 409, message: 'Đang xử lý, vui lòng thử lại' })

  const now = new Date()
  await db.update(payments).set({
    status: 'awaiting_confirm', confirmedByUser: true,
    confirmedAt: now, customerNote: customerNote ?? null,
  }).where(eq(payments.id, id))

  const [customer] = await db.select().from(users).where(eq(users.id, user.sub)).limit(1)
  await mailService.sendToAdmins('order_customer_confirm', {
    orderId: payment.referenceCode, paymentId: payment.id,
    customerName: customer.displayName, customerEmail: customer.email,
    amountVnd: payment.amountVnd, referenceCode: payment.referenceCode,
    customerNote, confirmedAt: now.toLocaleString('vi-VN'),
  })

  await emitToAdmin({ type: 'admin:new:payment', paymentId: payment.id, amountVnd: payment.amountVnd })
  return { ok: true }
})

// server/api/admin/payments/[id]/approve.post.ts
export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const { id } = getRouterParams(event)
  const { deliveryInfo, adminNote } = await readBody(event)

  const [payment] = await db.select().from(payments)
    .where(and(eq(payments.id, id), eq(payments.status, 'awaiting_confirm'))).limit(1)
  if (!payment) throw createError({ statusCode: 404, message: 'Đơn không hợp lệ' })

  const now = new Date()
  let planExpiresAt: Date

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: 'paid', paidAt: now, markedPaidBy: admin.sub, adminNote })
      .where(eq(payments.id, id))

    const plan = await tx.query.plans.findFirst({ where: eq(plans.id, payment.planId!) })
    planExpiresAt = new Date(now.getTime() + plan!.durationDays * 86400_000)

    // Deactivate plan cũ
    await tx.update(userPlans).set({ isActive: false })
      .where(and(eq(userPlans.userId, payment.userId), eq(userPlans.isActive, true)))

    await tx.insert(userPlans).values({
      id: ulid(), userId: payment.userId, planId: payment.planId!,
      startedAt: now, expiresAt: planExpiresAt, isActive: true,
    })

    const total = await quotaUtils.getTotalQuota(payment.userId)
    await quotaRedis.setLimit(payment.userId, total)
  })

  const [customer] = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1)
  const [plan]     = await db.select().from(plans).where(eq(plans.id, payment.planId!)).limit(1)

  await mailService.send({
    to: customer.email, template: 'order_paid',
    data: {
      orderId: payment.referenceCode, planName: plan.name,
      startedAt: now.toLocaleDateString('vi-VN'),
      expiresAt: planExpiresAt!.toLocaleDateString('vi-VN'),
      deliveryInfo: deliveryInfo ?? null,
    },
  })

  await emitToUser(payment.userId, {
    type: 'payment:success', planCode: plan.code, expiresAt: planExpiresAt!.toISOString(),
  })

  await adminStats.log(admin.sub, 'payment.approve', 'payment', id)
  return { ok: true }
})

// server/api/admin/payments/[id]/reject.post.ts
export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const { id } = getRouterParams(event)
  const { adminNote } = await readBody(event)

  const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1)
  if (!payment) throw createError({ statusCode: 404 })

  await db.update(payments).set({ status: 'failed', markedPaidBy: admin.sub, adminNote })
    .where(eq(payments.id, id))

  const [customer] = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1)
  await mailService.send({
    to: customer.email, template: 'order_failed',
    data: { orderId: payment.referenceCode, adminNote: adminNote ?? null },
  })

  await adminStats.log(admin.sub, 'payment.reject', 'payment', id, { reason: adminNote })
  return { ok: true }
})
```

---

## 11. ADMIN DASHBOARD — CHI TIẾT COMPONENT

### `pages/admin/index.vue`
```vue
<template>
  <div v-for="a in alerts" :key="a.id">
    <AlertBanner :level="a.level" :message="a.message" @dismiss="dismiss(a.id)" />
  </div>

  <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
    <StatCard label="Tổng người dùng"    :value="stats.totalUsers"           trend="+12%" />
    <StatCard label="Người dùng mới 30d" :value="stats.newUsers30d"          />
    <StatCard label="Doanh thu tháng"    :value="formatVnd(stats.revenue30d)" />
    <StatCard label="Storage dùng"       :value="formatGB(storageUsed)"       />
    <StatCard label="Ảnh lỗi"            :value="stats.failedImages"          :alert="stats.failedImages > 0" />
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <VisitLineChart    :data="chartData.visits" />
    <NewUsersLineChart :data="chartData.snapshots" />
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <RevenueBarChart  :data="chartData.revenueMonthly" />
    <StorageLineChart :data="chartData.snapshots" />
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <PlanDonutChart :data="chartData.planDistribution" />
    <StorageGauge   :usedPercent="r2UsedPercent" />
  </div>

  <TopUsersTable :users="topUsers" class="mt-6" />
</template>
```

### `components/admin/StorageGauge.vue`
```vue
<script setup lang="ts">
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
ChartJS.register(ArcElement, Tooltip)

const props = defineProps<{ usedPercent: number }>()

const color = computed(() =>
  props.usedPercent >= 80 ? '#E24B4A' : props.usedPercent >= 60 ? '#EF9F27' : '#1D9E75'
)

const chartData = computed(() => ({
  datasets: [{
    data: [props.usedPercent, 100 - props.usedPercent],
    backgroundColor: [color.value, '#E5E7EB'],
    borderWidth: 0,
  }],
}))

const options = {
  circumference: 180, rotation: -90,
  responsive: true, cutout: '70%',
  plugins: { tooltip: { enabled: false }, legend: { display: false } },
}
</script>
<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center">
    <h3 class="text-sm font-medium text-gray-500 mb-2">R2 Storage Usage</h3>
    <div class="relative">
      <Doughnut :data="chartData" :options="options" />
      <div class="absolute inset-x-0 bottom-2 text-2xl font-bold" :style="{ color }">
        {{ usedPercent }}%
      </div>
    </div>
    <p class="text-xs text-gray-400 mt-1">Giới hạn: {{ limitGB }}GB</p>
  </div>
</template>
```

### `components/admin/UserTable.vue`
```vue
<script setup lang="ts">
const props = defineProps<{ users: unknown[]; loading: boolean }>()
const emit  = defineEmits(['view', 'edit', 'toggleActive', 'delete', 'grantPlan'])
</script>
<template>
  <BaseTable :loading="loading">
    <template #head>
      <th>Người dùng</th><th>Gói</th><th>Storage</th><th>Ngày tạo</th><th>Trạng thái</th><th>Actions</th>
    </template>
    <template #body>
      <tr v-for="u in (users as any[])" :key="u.id">
        <td>
          <div class="flex items-center gap-2">
            <img :src="u.avatarUrl" class="w-8 h-8 rounded-full" />
            <div>
              <p class="font-medium text-sm">{{ u.displayName }}</p>
              <p class="text-xs text-gray-400">{{ u.email }}</p>
            </div>
          </div>
        </td>
        <td><BaseBadge :plan="u.planCode" /></td>
        <td>{{ formatGB(u.usedBytes) }} / {{ formatGB(u.limitBytes) }}</td>
        <td>{{ formatDate(u.createdAt) }}</td>
        <td>
          <span :class="u.isActive ? 'text-green-600' : 'text-red-500'" class="text-sm font-medium">
            {{ u.isActive ? 'Active' : 'Banned' }}
          </span>
        </td>
        <td>
          <div class="flex gap-1">
            <BaseButton size="xs" @click="emit('view', u)">Xem</BaseButton>
            <BaseButton size="xs" variant="warning" @click="emit('toggleActive', u)">
              {{ u.isActive ? 'Khóa' : 'Mở khóa' }}
            </BaseButton>
            <BaseButton size="xs" variant="info" @click="emit('grantPlan', u)">Tặng gói</BaseButton>
            <BaseButton size="xs" variant="danger" @click="emit('delete', u)">Xóa</BaseButton>
          </div>
        </td>
      </tr>
    </template>
  </BaseTable>
</template>
```

---

## 12. COMPOSABLES

### `composables/useAlbumFilter.ts`
```typescript
export interface ImageFilterState {
  liked:    boolean
  status:   'all' | 'ready' | 'processing' | 'failed'
  sortBy:   'newest' | 'oldest' | 'most_liked' | 'largest'
  dateFrom: string | null
  dateTo:   string | null
  search:   string
}

export function useAlbumFilter() {
  const auth = useAuthStore()
  const canFilter = computed(() => ['basic', 'pro', 'admin'].includes(auth.planCode))

  const filter = reactive<ImageFilterState>({
    liked: false, status: 'all', sortBy: 'newest', dateFrom: null, dateTo: null, search: '',
  })

  const activeCount = computed(() =>
    [filter.liked, filter.status !== 'all', !!filter.dateFrom, !!filter.search].filter(Boolean).length
  )

  const queryParams = computed(() => ({
    ...(filter.liked              && { liked: '1' }),
    ...(filter.status !== 'all'  && { status: filter.status }),
    ...(filter.sortBy             && { sortBy: filter.sortBy }),
    ...(filter.dateFrom           && { dateFrom: filter.dateFrom }),
    ...(filter.dateTo             && { dateTo: filter.dateTo }),
    ...(filter.search             && { search: filter.search }),
  }))

  function reset() {
    Object.assign(filter, { liked: false, status: 'all', sortBy: 'newest', dateFrom: null, dateTo: null, search: '' })
  }

  return { filter, canFilter, activeCount, queryParams, reset }
}
```

### `composables/useAdminAlerts.ts`
```typescript
export function useAdminAlerts() {
  const { on } = useNotify()
  const alerts = ref<{ id: string; type: string; message: string; level: 'warn' | 'error'; at: Date }[]>([])

  on('admin:storage:alert',     (d: { message: string; type: string }) => push('warn',  d.message, d.type))
  on('admin:worker:stuck',      (d: { queue: string; minutes: number; type: string }) =>
    push('error', `Worker stuck: ${d.queue} ${d.minutes}m`, d.type))
  on('admin:image:error:spike', (d: { count: number; type: string }) =>
    push('error', `${d.count} ảnh lỗi trong 1h qua`, d.type))

  function push(level: 'warn' | 'error', message: string, type: string) {
    alerts.value.unshift({ id: crypto.randomUUID(), type, message, level, at: new Date() })
  }

  const hasError = computed(() => alerts.value.some(a => a.level === 'error'))
  const dismiss  = (id: string) => { alerts.value = alerts.value.filter(a => a.id !== id) }

  return { alerts, hasError, dismiss }
}
```

### `composables/useInfiniteScroll.ts`
```typescript
export function useInfiniteScroll<T>(
  fetcher: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
) {
  const items    = ref<T[]>([])
  const cursor   = ref<string | undefined>()
  const loading  = ref(false)
  const hasMore  = ref(true)
  const sentinel = ref<HTMLElement | null>(null)

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    loading.value = true
    const res = await fetcher(cursor.value)
    items.value.push(...res.items)
    cursor.value = res.nextCursor
    hasMore.value = !!res.nextCursor
    loading.value = false
  }

  function reload() { items.value = []; cursor.value = undefined; hasMore.value = true; loadMore() }

  onMounted(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) loadMore() }, { rootMargin: '200px' })
    watch(sentinel, el => { if (el) obs.observe(el) }, { immediate: true })
    onUnmounted(() => obs.disconnect())
    loadMore()
  })

  return { items, loading, hasMore, sentinel, reload }
}
```

---

## 13. CRON JOBS

### `server/api/cron/expire-images.get.ts` — loop đến hết
```typescript
export default defineEventHandler(async (event) => {
  if (getHeader(event, 'x-cron-secret') !== process.env.CRON_SECRET)
    throw createError({ statusCode: 401 })

  let totalDeleted = 0
  const BATCH = 100

  // Loop cho đến khi không còn ảnh hết hạn
  while (true) {
    const expired = await db.select().from(images)
      .where(and(
        lt(images.expiresAt, new Date()),
        ne(images.status, 'deleted' as ImageStatus),
      ))
      .limit(BATCH)

    if (expired.length === 0) break

    const privateKeys = expired.map(i => i.originalKey).filter(Boolean)
    const publicKeys  = expired.flatMap(i => [i.thumbKey, i.previewKey].filter(Boolean) as string[])

    await Promise.all([
      privateKeys.length ? r2.deletePrivate(privateKeys) : Promise.resolve(),
      publicKeys.length  ? r2.deletePublic(publicKeys)   : Promise.resolve(),
    ])

    const ids = expired.map(i => i.id)
    await db.delete(images).where(inArray(images.id, ids))

    // Cập nhật quota cho từng user
    const byUser = new Map<string, bigint>()
    for (const img of expired) {
      byUser.set(img.userId, (byUser.get(img.userId) ?? BigInt(0)) + img.originalSize)
    }
    await Promise.all([...byUser.entries()].map(([uid, bytes]) => quotaUtils.subtractUsed(uid, bytes)))

    totalDeleted += expired.length
  }

  return { deleted: totalDeleted }
})
```

### `server/api/cron/reconcile-quota.get.ts` — đối chiếu quota Redis với DB
```typescript
export default defineEventHandler(async (event) => {
  if (getHeader(event, 'x-cron-secret') !== process.env.CRON_SECRET)
    throw createError({ statusCode: 401 })

  // Tính actual used bytes từ DB cho mọi user
  const actualByUser = await db.select({
    userId: images.userId,
    total:  sql<string>`COALESCE(SUM(original_size), 0)`,
  }).from(images)
    .where(eq(images.status, 'ready'))
    .groupBy(images.userId)

  let fixed = 0
  for (const { userId, total } of actualByUser) {
    const actualBytes = BigInt(total)
    const cachedBytes = await quotaRedis.getUsed(userId)
    if (cachedBytes !== actualBytes) {
      await redis.set(`quota:used:${userId}`, actualBytes.toString())
      fixed++
    }
  }

  return { checked: actualByUser.length, fixed }
})
```

### `server/api/cron/remind-payments.get.ts`
```typescript
export default defineEventHandler(async (event) => {
  if (getHeader(event, 'x-cron-secret') !== process.env.CRON_SECRET)
    throw createError({ statusCode: 401 })

  const pendingOrders = await db
    .select({ p: payments, u: users })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .where(and(
      eq(payments.status, 'pending'),
      lt(payments.createdAt, new Date(Date.now() - 12 * 3600_000)),
      gt(payments.expiresAt!, new Date()),
    ))

  for (const { p, u } of pendingOrders) {
    const hoursLeft = Math.max(0, Math.floor((p.expiresAt!.getTime() - Date.now()) / 3600_000))
    await mailService.send({
      to: u.email, template: 'order_reminder',
      data: {
        orderId: p.referenceCode, paymentId: p.id,
        amountVnd: p.amountVnd, referenceCode: p.referenceCode, hoursLeft,
      },
    })
  }
  return { reminded: pendingOrders.length }
})
```

---

## 14. UI ADMIN — PAYMENT METHODS & QUẢN LÝ ĐƠN HÀNG

```
pages/admin/payment-methods/index.vue
  ├── Danh sách card: type badge, tên, STK/SĐT, badge Default, toggle Active
  ├── Drag & drop sắp xếp thứ tự (sortOrder)
  └── Nút Thêm mới → PaymentMethodModal

components/admin/PaymentMethodModal.vue
  ├── Select type: Chuyển khoản | MoMo | ZaloPay | Tiền mặt
  ├── Fields tuỳ type:
  │   bank_transfer: bankName, accountNo, accountName, branch + Upload ảnh QR
  │   momo / zalopay: phone, accountName + Upload ảnh QR
  ├── Toggle isActive / isDefault
  └── Preview QR real-time (bank_transfer dùng VietQR URL)

pages/admin/payments/index.vue
  ├── Tab filter: Tất cả | Chờ CK (pending) | Chờ duyệt (awaiting_confirm) | Đã duyệt | Từ chối
  ├── Badge đếm "awaiting_confirm" màu cam — ưu tiên xử lý ngay
  ├── Row action inline: nút Duyệt + Từ chối (không cần vào trang chi tiết)
  ├── Modal Duyệt:
  │   ├── Textarea deliveryInfo (thông tin TK giao cho KH)
  │   ├── Textarea adminNote (ghi chú nội bộ)
  │   └── Nút Xác nhận → POST /api/admin/payments/:id/approve
  └── Modal Từ chối:
      ├── Textarea adminNote (lý do — KH sẽ nhận qua email)
      └── Nút Xác nhận → POST /api/admin/payments/:id/reject
```

---

## 15. BIẾN MÔI TRƯỜNG `.env.example`

```bash
# App
APP_URL=http://localhost:3000
APP_NAME=Photo Storage
APP_ADDRESS=Hà Nội, Việt Nam
NODE_ENV=development
CRON_SECRET=your-cron-secret-here

# Database
DATABASE_URL=mysql://user:pass@host:3306/photo_storage

# JWT
JWT_SECRET=your-256-bit-secret-here

# Redis (Upstash free tier)
REDIS_URL=rediss://default:token@host.upstash.io:6379

# Cloudflare R2
R2_ENDPOINT=https://accountid.r2.cloudflarestorage.com
R2_ACCESS_KEY=your-r2-access-key
R2_SECRET_KEY=your-r2-secret-key
R2_PRIVATE_BUCKET=photo-raw-private
R2_PUBLIC_BUCKET=photo-serve-public
CDN_URL=https://cdn.yourdomain.com
R2_LIMIT_GB=10                        # Giới hạn free tier R2 để tính % gauge

# Mail — Resend (free 100 emails/ngày)
RESEND_API_KEY=re_xxx
FROM_EMAIL=noreply@yourdomain.com

# Hỗ trợ khách hàng (hiển thị trong email)
SUPPORT_EMAIL=support@yourdomain.com
SUPPORT_PHONE=0982975372

# Admin (nhận mail thông báo đơn hàng — cách nhau bởi dấu phẩy)
ADMIN_EMAILS=admin@yourdomain.com,admin2@yourdomain.com

# Socket.io server (Railway)
SOCKET_URL=https://socket.yourdomain.com
```

---

## 16. BEST PRACTICES

### Code style
- TypeScript strict — không dùng `any`
- `ulid()` làm primary key — sortable, cluster-friendly
- API response `camelCase`, DB column `snake_case`
- Mutation nhiều bảng phải trong `transaction`

### Performance
- Cursor-based pagination — không dùng `OFFSET`
- Cache feed Redis TTL 5 phút, invalidate khi album thay đổi (`feed:album:{albumId}` — 1 key/album)
- Admin chart data cache Redis 5 phút
- `<img loading="lazy">` + `srcset`, thumb CDN 30 ngày
- Worker dùng stream (không buffer file 80MB vào RAM)

### Security
- Presigned URL cho mọi file — không expose raw bucket
- Verify magic bytes (không chỉ extension)
- Rate limit: 10 files/phút/user (Redis)
- Idempotency lock cho payment confirm (Redis SET NX)
- Cookie: `HttpOnly, Secure, SameSite=Strict`
- Admin: double-check role ở middleware VÀ trong handler

### Image processing
- Sharp.js **không** decode được RAW natively — cần `dcraw` (hoặc `libraw-tools`) làm bước trung gian
- Pipeline: R2 stream → dcraw subprocess → TIFF buffer → Sharp → WebP
- Cài `dcraw` trong Dockerfile Railway: `RUN apt-get install -y dcraw`
- Với JPEG/PNG/TIFF thông thường: bỏ qua bước dcraw, dùng Sharp trực tiếp

### Admin charts (vue-chartjs)
```
npm install vue-chartjs chart.js
```
- Mỗi loại chart là 1 component riêng nhận `data` prop
- Gauge = Doughnut với `circumference:180, rotation:-90, cutout:'70%'`
- Màu gauge: xanh < 60% / vàng 60–80% / đỏ > 80%
- Dùng `computed` để reactive khi data thay đổi

### Cron jobs
```
0 2 * * *   → GET /api/cron/expire-images      (loop batch 100 đến hết)
0 3 * * *   → GET /api/cron/reconcile-quota    (đối chiếu Redis với DB)
0 * * * *   → GET /api/cron/remind-payments    (nhắc đơn pending > 12h)
```
Tất cả cần header `x-cron-secret` khớp với `CRON_SECRET` trong env.

---

## 17. THỨ TỰ TRIỂN KHAI

```
Bước 1:  Nuxt 3 + TypeScript + Tailwind + Drizzle + vue-chartjs
Bước 2:  DB schema (13 bảng) + migrations + seed (plans, system_settings)
Bước 3:  Server utils: db, redis, r2 (multipart), jwt, quota, socket-emit, mailService, admin-stats
Bước 4:  Auth API + middleware auth + middleware admin
Bước 5:  Album CRUD + Image list API với filter params
Bước 6:  Image upload: S3 Multipart (upload-url → complete) + useUpload composable
Bước 7:  imageProcessor worker: dcraw → Sharp pipeline (Railway Dockerfile bổ sung dcraw)
Bước 8:  Socket.io server + plugins/socket.client.ts + Pinia stores
Bước 9:  Like / Comment + real-time emit
Bước 10: Trang Profile: ProfileStatCards + ProfileAlbumGrid + PaymentHistoryTable
Bước 11: ImageFilterBar + useAlbumFilter (Basic+) + ImageUploader progress UI
Bước 12: Payment flow: create → KH confirm (idempotency lock) → Admin approve/reject + mailService
Bước 13: Admin payment-methods CRUD + PaymentMethodModal (bank/momo/zalopay)
Bước 14: Admin dashboard: StatCard + 5 charts + StorageGauge + AlertBanner
Bước 15: Admin users/albums/payments manage + plans CRUD
Bước 16: Admin settings + storageMonitor worker + useAdminAlerts
Bước 17: Cron: expire-images (loop) + reconcile-quota + remind-payments + storage-snapshot
Bước 18: Deploy: Vercel + Railway (với Dockerfile cài dcraw) + PlanetScale + Upstash + R2 + Resend
```

### Format yêu cầu Claude Code

```
Thực hiện Bước 7: imageProcessor worker.
Tạo file:
- server/workers/imageProcessor.ts

Yêu cầu:
- Dùng BullMQ Worker, concurrency 3
- Với file RAW (CR2/ARW/NEF/DNG): spawn dcraw subprocess, pipe stdin từ R2 stream, lấy TIFF output
- Với file JPEG/PNG/TIFF: dùng Sharp stream trực tiếp (không qua dcraw)
- Tạo 2 WebP: thumb 400px + preview 1920px
- Upload lên R2 public bucket
- Update DB status 'ready' + width/height
- Emit socket image:ready (success) hoặc image:failed (error)
- Railway Dockerfile cần: RUN apt-get install -y dcraw
```

---

*Prompt v2 — cải thiện: upload S3 Multipart (bỏ tus.io), RAW decode pipeline dcraw→Sharp, stream worker (không buffer 80MB), Redis idempotency lock cho payment, feed cache key thống nhất, visit counter authenticated-only, quota reconcile cron, expire-images loop, thêm R2_LIMIT_GB env.*
