# WebPhoto (PhotoStorage) — Luong nghiep vu & Kien truc

> Tai lieu mo ta chi tiet cac luong nghiep vu chinh, workflow, giai phap ky thuat.
> Cap nhat: 2026-04-16

---

## Muc luc

1. [Tong quan](#1-tong-quan)
2. [Luong Dang ky & Dang nhap](#2-luong-dang-ky--dang-nhap)
3. [Luong Upload & Xu ly anh](#3-luong-upload--xu-ly-anh)
4. [Luong Quan ly Album & Anh](#4-luong-quan-ly-album--anh)
5. [Luong Thanh toan & Nang cap goi](#5-luong-thanh-toan--nang-cap-goi)
6. [Luong Chia se Album](#6-luong-chia-se-album)
7. [Luong Admin Dashboard](#7-luong-admin-dashboard)
8. [Luong Referral & Voucher](#8-luong-referral--voucher)
9. [Cron Jobs & Background Workers](#9-cron-jobs--background-workers)
10. [E2E Test Coverage](#10-e2e-test-coverage)

---

## 1. Tong quan

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3 + TypeScript + Tailwind CSS 4 + Pinia + vue-i18n + vue-chartjs |
| Backend | Express.js 5 + TypeScript + Drizzle ORM |
| Database | MySQL 8 (16 tables, ULID primary keys) |
| Cache/Queue | Redis 7 + BullMQ (4 workers) |
| Storage | Cloudflare R2 (S3 compatible) hoac Local Filesystem (dual backend, per-image) |
| Real-time | Socket.io 4 + Redis adapter |
| Email | Resend (8 templates) |
| Deploy | Docker + Nginx + Let's Encrypt SSL |

### Ports (Dev)

| Service | Port |
|---------|------|
| Frontend (Vite) | 3000 |
| Backend API | 4000 |
| Socket.io | 4001 |
| MySQL | 3306 |
| Redis | 6379 |

### Database Schema (16 tables)

| Table | Mo ta |
|-------|-------|
| `users` | Tai khoan, role, referral code |
| `plans` | Goi dich vu (Free/Basic/Pro) |
| `user_plans` | Gan goi cho user |
| `vouchers` | Ma giam gia / kich hoat |
| `voucher_usages` | Log su dung voucher |
| `referrals` | Referral tracking |
| `storage_addons` | Dung luong bo sung |
| `payment_methods` | Phuong thuc thanh toan (bank transfer, MoMo...) |
| `payments` | Don hang + approval workflow |
| `albums` | Album anh (cover, sharing, password) |
| `images` | Anh — per-image `storage_backend` (r2/local) |
| `likes` | Like anh (composite PK) |
| `comments` | Comment anh (user hoac guest) |
| `refresh_tokens` | JWT refresh token store |
| `album_share_tokens` | Link chia se album (permissions) |
| `system_settings` | Cau hinh admin (key-value) |
| `admin_logs` | Audit log admin |
| `app_logs` | Application log |
| `storage_snapshots` | Metrics hang ngay |

---

## 2. Luong Dang ky & Dang nhap

### 2.1 Dang ky (Register)

**Workflow:**
```
/register
  ├── Form: Email + Password + Display Name
  ├── Validation: email format, password 8+ chars (upper+lower+number)
  ├── POST /api/auth/register
  │   ├── Check email chua ton tai (409 neu trung)
  │   ├── Check registration_open setting (403 neu dong)
  │   ├── Hash password (bcrypt)
  │   ├── Tao user (ULID) + assign goi Free
  │   ├── Gui welcome email (Resend)
  │   └── Tra ve { user, accessToken }
  └── Set cookies + redirect /dashboard
```

### 2.2 Dang nhap (Login)

**Workflow:**
```
/login
  ├── Form: Email + Password
  ├── POST /api/auth/login
  │   ├── Verify password (bcrypt)
  │   ├── Check isActive (403 neu bi ban)
  │   ├── Tao JWT access token (15min) + refresh token (7d)
  │   ├── Luu refresh token hash vao DB
  │   └── Set HttpOnly cookies:
  │       - access_token (15min, SameSite=Strict)
  │       - refresh_token (7d, path=/api/auth/refresh)
  └── Redirect /dashboard (user) hoac /admin (admin)
```

### 2.3 Token Refresh

```
FE interceptor detect 401
  → POST /api/auth/refresh (gui cookie)
  → Verify refresh token hash trong DB
  → Rotate: xoa token cu, tao token moi
  → Return new access + refresh tokens
  → Retry request goc
```

### 2.4 Logout

```
POST /api/auth/logout
  → Xoa tat ca refresh tokens cua user trong DB
  → Clear cookies
  → Redirect /login
```

---

## 3. Luong Upload & Xu ly anh

### 3.1 Upload Flow (Server-side proxy)

**Workflow:**
```
User chon file anh (JPEG/PNG/RAW)
  │
  ├── Client validation: extension + size (max 200MB)
  │
  ├── POST /api/storage/upload-chunk (10MB/chunk)
  │   ├── Auth middleware (requireAuth)
  │   ├── Rate limit (10 uploads/min, Redis)
  │   ├── Quota check (canUpload)
  │   ├── MIME type + extension whitelist
  │   ├── Sanitize filename (path traversal prevention)
  │   └── Upload chunk → R2 private bucket (hoac local storage)
  │
  ├── POST /api/images/complete
  │   ├── Complete multipart upload
  │   ├── Update album stats (imageCount, totalBytes)
  │   ├── Update quota (addUsed)
  │   └── Enqueue BullMQ job (imageProcessor)
  │
  └── Worker xu ly anh (background)
      ├── Download original tu R2
      ├── RAW? → dcraw -c -w -T → buffer
      ├── Sharp.js:
      │   ├── clone() → resize(400) → webp(q:80) → thumb.webp
      │   └── clone() → resize(1920) → webp(q:85) → preview.webp
      ├── Upload thumb + preview → R2 public bucket
      ├── Extract metadata → width, height → update DB
      ├── Update status = 'ready'
      └── Socket emit 'image:ready' → user
```

### 3.2 Image Processing Pipeline

```
R2 Private (original.cr2)
  │ stream
  ▼
RAW? → dcraw -c -w -T → buffer
No  → pass through
  │
  ▼
Sharp.js
  ├── thumb.webp (400px, q:80)  → R2 Public
  ├── preview.webp (1920px, q:85) → R2 Public
  └── metadata() → width, height → DB
```

### 3.3 Download anh goc

```
GET /api/images/:id/download-url (auth, Basic+ plan)
  → Tao presigned download URL (15min TTL)
  → Tra ve original file 100% nguyen ven
```

---

## 4. Luong Quan ly Album & Anh

### 4.1 Album CRUD

**Workflow:**
```
/dashboard/albums
  ├── Danh sach album cua user
  ├── "+ Tao album moi" → /dashboard/albums/new
  │   ├── Form: Title, Description, isPublic
  │   ├── POST /api/albums (check plan album limit)
  │   └── Redirect → /dashboard/albums/:id
  │
  ├── Album detail → /dashboard/albums/:id
  │   ├── Grid anh (thumb preview)
  │   ├── Upload anh moi (drag-drop, multi-file)
  │   ├── Like / Comment tung anh
  │   ├── Download anh goc (Basic+ plan)
  │   ├── PATCH /api/albums/:id (sua title, visibility)
  │   └── DELETE /api/albums/:id (cascade: xoa anh + R2 files)
  │
  └── Favorites → /dashboard/favorites
      └── GET /api/images?liked=true
```

### 4.2 Public Feed

```
/ (Homepage)
  ├── Public albums feed (cursor-based pagination)
  │   GET /api/albums?cursor=&limit=20
  └── Click album → xem anh (neu isPublic=true)
```

### 4.3 Anh — Filter & Sort

| Param | Mo ta |
|-------|-------|
| `albumId` | Filter theo album |
| `liked` | Chi anh da like |
| `status` | ready / processing / failed |
| `sortBy` | newest / oldest / most_liked / largest |
| `dateFrom`, `dateTo` | Khoang thoi gian |
| `search` | Tim theo ten file |
| `cursor`, `limit` | Cursor-based pagination (max 50) |

---

## 5. Luong Thanh toan & Nang cap goi

### 5.1 Goi dich vu

| Goi | Gia | Luu tru | Albums | Download |
|-----|-----|---------|--------|----------|
| Free | 0 | 5 GB | 5 | Khong |
| Basic | 49,000 VND/thang | 50 GB | Unlimited | Co |
| Pro | 499,000 VND/nam | 200 GB | Unlimited | Co |

### 5.2 Payment Flow (Manual bank transfer)

**Workflow:**
```
/upgrade
  ├── Hien 3 plans (GET /api/plans)
  ├── Chon plan → Chon phuong thuc thanh toan (GET /api/payment-methods)
  ├── POST /api/payments/create
  │   ├── Tao don hang (status: pending)
  │   ├── Tao referenceCode (DHXYZ123)
  │   └── Email admin: order_new
  │
  ├── User chuyen khoan (ngoai he thong)
  │   └── Noi dung CK: referenceCode
  │
  ├── POST /api/payments/:id/confirm
  │   ├── Status: pending → awaiting_confirm
  │   ├── Redis lock (idempotency)
  │   └── Email admin: order_customer_confirm
  │
  ├── Admin duyet:
  │   ├── POST /api/admin/payments/:id/approve
  │   │   ├── Status → paid
  │   │   ├── Kich hoat userPlan + update quota
  │   │   ├── Email user: order_paid
  │   │   └── Socket: payment:success
  │   │
  │   └── POST /api/admin/payments/:id/reject
  │       ├── Status → failed
  │       └── Email user: order_failed
  │
  └── User co the huy:
      └── POST /api/payments/:id/cancel
```

**Payment Status Machine:**
```
pending → awaiting_confirm → paid
                           → failed
pending → cancelled (user huy)
```

---

## 6. Luong Chia se Album

### 6.1 Share via Link

**Workflow:**
```
Album detail → "Chia se" button
  ├── Tao share token voi permissions
  │   ├── allowLike: boolean
  │   ├── allowComment: boolean
  │   ├── allowDownload: boolean
  │   └── password: optional
  ├── Generate link: /share/:token
  └── Nguoi nhan:
      ├── Truy cap /share/:token
      ├── Nhap password (neu co)
      └── Xem anh + thao tac theo permissions
```

---

## 7. Luong Admin Dashboard

### 7.1 Admin Layout

```
/admin (sau khi login voi role=admin)
  ├── Sidebar menu:
  │   ├── Dashboard (KPI + charts)
  │   ├── Users (quan ly user)
  │   ├── Albums (quan ly album)
  │   ├── Payments (quan ly don hang)
  │   ├── Plans (quan ly goi)
  │   ├── Payment Methods (phuong thuc TT)
  │   ├── Vouchers (ma giam gia)
  │   ├── Settings (cau hinh he thong)
  │   └── Logs (nhat ky)
  └── Topbar (thong bao real-time, avatar)
```

### 7.2 Dashboard Stats & Charts

```
/admin (Dashboard)
  ├── GET /api/admin/dashboard/stats
  │   ├── Total users, images, revenue, storage
  │   └── Today/month metrics
  ├── GET /api/admin/dashboard/charts
  │   ├── 30-day charts: visits, users, revenue, storage
  │   └── Plan distribution
  ├── GET /api/admin/dashboard/alerts
  │   └── R2 usage + canh bao
  └── GET /api/admin/dashboard/top-users
      └── Top 10 users theo storage
```

### 7.3 User Management

```
/admin/users
  ├── List users (search, filter status, sortBy, cursor pagination)
  ├── User detail (/admin/users/:id)
  │   └── Profile + plan + albums + payments + storage
  ├── PATCH: Update user (name, email, role, isActive, quotaOverride)
  ├── DELETE: Cascade delete user + all data
  └── Grant plan: POST /admin/users/:id/grant-plan
```

### 7.4 Payment Management

```
/admin/payments
  ├── List (search, filter status, dateRange, cursor)
  ├── Total revenue
  ├── Approve: kich hoat plan + email + socket notification
  ├── Reject: mark failed + email
  └── Export CSV
```

### 7.5 System Settings

| Key | Default | Mo ta |
|-----|---------|-------|
| `registration_open` | true | Bat/tat dang ky |
| `max_upload_size_mb` | 200 | Gioi han upload (MB) |
| `allowed_mime_types` | [...] | Danh sach MIME types |
| `storage_alert_threshold_percent` | 80 | Nguong canh bao R2 (%) |
| `image_error_spike_threshold` | 20 | Nguong spike anh loi/gio |
| `worker_stuck_minutes` | 30 | Nguong worker bi treo (phut) |

---

## 8. Luong Referral & Voucher

### 8.1 Referral Program

```
User A chia se referral code
  → User B dang ky voi code
  → User A duoc +7 ngay VIP
  → Tracking: referrals table (referrer → referee)
```

### 8.2 Voucher System

```
Admin tao voucher (ma giam gia / kich hoat)
  → User nhap voucher code
  → Validate: chua het han, con luot su dung
  → Ap dung: giam gia don hang hoac kich hoat goi
  → Log: voucher_usages table
```

---

## 9. Cron Jobs & Background Workers

### 9.1 BullMQ Workers (4 workers)

| Worker | Mo ta |
|--------|-------|
| `imageProcessor` | RAW decode (dcraw) + Sharp pipeline → thumb + preview |
| `imageExpiry` | Batch xoa anh het han |
| `emailSender` | Gui email qua Resend |
| `storageMonitor` | Hourly snapshot metrics + alerts |

### 9.2 Cron Schedule

| Thoi gian (UTC+7) | Endpoint | Mo ta |
|--------------------|----------|-------|
| 02:00 daily | `/api/cron/expire-images` | Batch xoa anh het han + R2 cleanup + quota update |
| 03:00 daily | `/api/cron/reconcile-quota` | Dong bo Redis quota voi DB |
| Every hour | `/api/cron/remind-payments` | Nhac don pending > 12h |
| Every hour | (storageMonitor worker) | Snapshot metrics + alert check |

### 9.3 Real-time Notifications (Socket.io)

**User Events:**

| Event | Data | Mo ta |
|-------|------|-------|
| `image:ready` | `{ imageId, thumbUrl }` | Anh xu ly xong |
| `image:failed` | `{ imageId, reason }` | Anh xu ly loi |
| `payment:success` | `{ planCode, expiresAt }` | Goi duoc kich hoat |
| `photo:liked` | `{ imageId, likedBy }` | Co nguoi like anh |
| `photo:commented` | `{ imageId, comment, by }` | Co comment moi |
| `storage:warning` | `{ usedPercent }` | Dung luong < 10% |

**Admin Events (room: admin):**

| Event | Data | Mo ta |
|-------|------|-------|
| `admin:storage:alert` | `{ message, usedPercent }` | R2 vuot nguong |
| `admin:worker:stuck` | `{ jobId, queue, minutes }` | Worker bi treo |
| `admin:image:error:spike` | `{ count, threshold }` | Spike anh loi |
| `admin:new:payment` | `{ paymentId, amountVnd }` | Don hang moi |
| `admin:user:registered` | `{ userId, email }` | User moi dang ky |

### 9.4 Email Templates (8 templates)

| Template | Trigger | Nguoi nhan |
|----------|---------|------------|
| `register_welcome` | User dang ky | User |
| `order_new` | Tao don hang | Admin |
| `order_customer_confirm` | KH bam "da chuyen" | Admin |
| `order_paid` | Admin duyet | User |
| `order_failed` | Admin tu choi | User |
| `order_reminder` | Don pending > 12h | User |
| `reset_password` | Quen mat khau | User |
| `storage_warning` | Dung luong < 10% | User |

---

## 10. E2E Test Coverage

### 10.1 Test Files

| File | Tests | Pham vi |
|------|-------|---------|
| `01-public-pages.spec.ts` | 7 | Homepage, login, register, 404, health check, plans API |
| `02-admin-login.spec.ts` | 6 | Login API + UI, sai credentials, logout |
| `03-admin-api.spec.ts` | 11 | Admin API: stats, users, albums, payments, plans, settings, logs |
| `04-admin-ui.spec.ts` | 3 | Admin UI: dashboard, sidebar, tat ca trang admin |
| `05-user-dashboard.spec.ts` | 5 | User dashboard, profile, storage, upgrade |
| `06-security.spec.ts` | 10 | Auth protection, headers, XSS, SQL injection, upload, cron |
| `07-api-crud.spec.ts` | 8 | Public + auth CRUD: albums, images, plans, referrals |
| **Tong** | **50** | |

### 10.2 Coverage theo luong nghiep vu

| Luong | Covered | Chi tiet |
|-------|---------|----------|
| Public pages | Y | Homepage, login form, register form, 404 |
| Auth API | Y | Login (thanh cong + sai), logout, refresh |
| Admin API | Y | 11 endpoints: stats, users, albums, payments, plans, methods, vouchers, settings, logs, charts |
| Admin UI | Y | Dashboard load, sidebar menu, 9 trang admin |
| User dashboard | Y | 6 trang: home, albums, favorites, profile, settings, referral |
| Security | Y | 9 admin endpoints block, 2 user endpoints block, redirect, headers, XSS, SQLi, upload, cron |
| CRUD operations | Y | Albums list/create, images list, plans, payment methods, referrals, user data |
| Upload flow | Chua | Can backend + R2 running |
| Payment flow | Chua | Can tao don + admin duyet |
| Share flow | Chua | Can album voi share token |
| Real-time (Socket) | Chua | Can Socket.io test |
