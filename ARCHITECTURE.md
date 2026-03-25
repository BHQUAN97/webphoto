# ARCHITECTURE — Kiến trúc hệ thống PhotoStorage

## Tổng quan

```
┌─────────────────────────────────────────────────────────┐
│                      Client (Browser)                    │
│  Vue 3 + Pinia + Vue Router + Tailwind + vue-chartjs    │
└──────────┬──────────────────────────────────┬────────────┘
           │ HTTP (REST API)                  │ WebSocket
           ▼                                  ▼
┌──────────────────────┐        ┌──────────────────────┐
│   Nginx (port 80/443)│        │  Socket.io (port 4001)│
│   - SSL termination  │        │  - Redis pub/sub      │
│   - Static files     │        │  - JWT auth           │
│   - /api → proxy     │        │  - Rooms: user:{id}   │
│   - /socket.io → ws  │        │           admin       │
└──────────┬───────────┘        └──────────┬───────────┘
           ▼                               │
┌──────────────────────────────────────────┤
│          Express API (port 4000)         │
│  - Auth middleware (JWT)                 │
│  - Admin guard                           │
│  - Rate limiter (Redis)                  │
│  - Security headers                      │
│  - 44 REST endpoints                     │
└────┬──────────┬──────────┬───────────────┘
     │          │          │
     ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────────────┐
│ MySQL 8│ │ Redis 7│ │ BullMQ Workers │
│        │ │        │ │ - imageProcess │
│ 14 tbl │ │ Cache  │ │ - imageExpiry  │
│ Drizzle│ │ Queue  │ │ - storageMon   │
│        │ │ Session│ │ - emailSender  │
└────────┘ └────────┘ └───────┬────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Cloudflare R2    │
                    │  webphoto (private)│
                    │  webphoto-public   │
                    │  + CDN             │
                    └───────────────────┘
```

---

## Database Schema (14 tables)

```
┌─────────┐     ┌──────────┐     ┌─────────┐
│  users  │────▶│userPlans │────▶│  plans  │
│         │     └──────────┘     └─────────┘
│         │     ┌──────────────┐
│         │────▶│storageAddons │
│         │     └──────────────┘
│         │     ┌──────────┐     ┌────────┐
│         │────▶│ albums   │────▶│ images │
│         │     └──────────┘     │        │
│         │                      │        │──▶ likes
│         │                      │        │──▶ comments
│         │     ┌──────────┐     └────────┘
│         │────▶│ payments │
└─────────┘     └─────┬────┘
                      │
                ┌─────┴──────────┐
                │paymentMethods  │
                └────────────────┘

Standalone:
  refreshTokens    — JWT refresh token hashes
  systemSettings   — Key-value system config
  adminLogs        — Admin action audit trail
  storageSnapshots — Hourly storage metrics
```

### Table sizes & indexes:

| Table | Key | Important Indexes |
|-------|-----|-------------------|
| users | ULID | email (unique), role+isActive+createdAt |
| plans | ULID | code (unique) |
| userPlans | ULID | userId+isActive, expiresAt+isActive |
| albums | ULID | userId+createdAt, isPublic+isActive+createdAt |
| images | ULID | albumId+createdAt, userId+createdAt, expiresAt+status, albumId+likeCount |
| likes | PK(userId, imageId) | imageId, userId+createdAt |
| payments | ULID | referenceCode (unique), userId+createdAt, status+createdAt |

---

## Authentication Flow

```
Register/Login
     │
     ▼
  API tạo JWT access token (15 min)
  + refresh token hash (7 days) lưu DB
     │
     ▼
  Set HttpOnly cookies:
  - access_token (15min, SameSite=Strict)
  - refresh_token (7d, path=/api/auth/refresh)
     │
     ▼
  FE request → auth middleware:
  1. Đọc cookie hoặc Authorization header
  2. Verify JWT → set req.user
  3. incrVisit (Redis counter cho admin chart)
     │
     ▼
  Token expired → FE interceptor auto refresh:
  1. POST /api/auth/refresh (gửi cookie)
  2. Verify refresh token hash
  3. Rotate: xóa token cũ, tạo token mới
  4. Return new access + refresh
```

---

## Upload Flow (S3 Multipart)

```
Client                          API                         R2 (S3)
  │                              │                            │
  │ POST /images/upload-url      │                            │
  │ {filename, size, albumId}    │                            │
  │─────────────────────────────▶│                            │
  │                              │ createMultipartUpload()    │
  │                              │───────────────────────────▶│
  │                              │◀───────────────────────────│
  │                              │ presignPart() × N          │
  │                              │───────────────────────────▶│
  │ {imageId, partUrls[]}        │                            │
  │◀─────────────────────────────│                            │
  │                              │                            │
  │ PUT partUrls[0] (chunk 10MB) │                            │
  │──────────────────────────────────────────────────────────▶│
  │ PUT partUrls[1] (chunk 10MB) │                            │
  │──────────────────────────────────────────────────────────▶│
  │ ... (progress per chunk)     │                            │
  │                              │                            │
  │ POST /images/complete        │                            │
  │ {imageId, parts[{ETag}]}     │                            │
  │─────────────────────────────▶│ completeMultipart()        │
  │                              │───────────────────────────▶│
  │                              │ enqueue BullMQ job         │
  │ {ok: true}                   │                            │
  │◀─────────────────────────────│                            │
  │                              │                            │
  │              Worker picks up job                          │
  │              │                                            │
  │              │ getStream(originalKey)                      │
  │              │───────────────────────────────────────────▶│
  │              │◀──────────────────────────────────────────│
  │              │ dcraw (if RAW) → Sharp → WebP             │
  │              │ uploadBuffer(thumb.webp)                   │
  │              │ uploadBuffer(preview.webp)                 │
  │              │───────────────────────────────────────────▶│
  │              │ update DB status='ready'                   │
  │              │ emit socket 'image:ready'                  │
  │              │                                            │
  │ socket: image:ready          │                            │
  │◀─────────────────────────────│                            │
```

---

## Image Processing Pipeline

```
                ┌─────────────────┐
                │ R2 Private      │
                │ original.cr2    │
                └────────┬────────┘
                         │ stream
                         ▼
              ┌─────────────────────┐
              │ RAW?                │
              │ Yes → dcraw -c -w -T│
              │ No  → pass through  │
              └────────┬────────────┘
                       │ Buffer
                       ▼
              ┌─────────────────────┐
              │     Sharp.js        │
              │                     │
              │  ┌─── clone() ──┐   │
              │  │ resize(400)  │   │
              │  │ webp(q:80)   │   │  → thumb.webp (R2 Public)
              │  └──────────────┘   │
              │                     │
              │  ┌─── clone() ──┐   │
              │  │ resize(1920) │   │
              │  │ webp(q:85)   │   │  → preview.webp (R2 Public)
              │  └──────────────┘   │
              │                     │
              │  metadata()         │  → width, height → DB
              └─────────────────────┘
```

---

## Redis Usage

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `quota:used:{userId}` | Persistent | Bytes used (INCRBY/DECRBY) |
| `quota:limit:{userId}` | Persistent | Bytes limit |
| `feed:album:{albumId}` | 5 min | Cached album feed |
| `feed:public:*` | 5 min | Cached public feed |
| `admin:stats` | 5 min | Admin dashboard stats |
| `admin:charts` | 5 min | Admin chart data |
| `rate:upload:{userId}` | 60s | Upload rate limiter |
| `visit:day:{YYYY-MM-DD}` | 35 days | Daily visit counter |
| `webhook:lock:{refCode}` | 30s | Payment idempotency lock |
| `public:plans` | 10 min | Cached plans list |
| `public:payment-methods` | 10 min | Cached payment methods |

---

## Payment Flow

```
Status: pending → awaiting_confirm → paid
                                   → failed

1. Customer: POST /payments/create
   → status: pending
   → email admin: order_new

2. Customer: chuyển khoản (ngoài hệ thống)

3. Customer: POST /payments/:id/confirm
   → status: awaiting_confirm (Redis lock)
   → email admin: order_customer_confirm

4a. Admin: POST /admin/payments/:id/approve
    → status: paid
    → activate userPlan
    → update quota
    → email customer: order_paid
    → socket: payment:success

4b. Admin: POST /admin/payments/:id/reject
    → status: failed
    → email customer: order_failed
```

---

## Security Measures

| Layer | Protection |
|-------|-----------|
| **Input** | validate.ts: email, password, ULID, filename, search sanitize, enum whitelist |
| **Auth** | JWT HttpOnly + SameSite=Strict, refresh token rotation, bcrypt hash |
| **Upload** | File extension whitelist, MIME type check, max size limit, path traversal prevention |
| **SQL** | Drizzle ORM (parameterized), LIKE wildcards escaped |
| **XSS** | Vue auto-escape, HTML strip in comments/bio, CSP headers |
| **CSRF** | SameSite=Strict cookies, CORS origin check |
| **Headers** | X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, CSP |
| **Errors** | 500 errors hide stack trace, only safe messages to client |
| **Rate limit** | Redis-based per-user rate limiter on upload (10/min) |
| **Payment** | Redis NX lock for idempotency, double-check admin role |

---

## Performance Optimizations

| Area | Optimization |
|------|-------------|
| **DB Queries** | N+1 eliminated: LEFT JOIN for users+plans, GROUP BY for plan counts |
| **Stats** | Single CASE WHEN query replaces 6 separate COUNT queries |
| **Filter** | Liked images use INNER JOIN instead of in-memory filter |
| **Settings** | In-memory cache (60s TTL) avoids DB hit per upload |
| **Redis** | SCAN replaces blocking KEYS command |
| **Pool** | MySQL connection pool: 20 connections, keepAlive, idle timeout |
| **Search** | 300-400ms debounce on all search inputs |
| **Images** | lazy loading, code-split chunks, immutable cache headers |
| **Pagination** | Cursor-based (no OFFSET), limit enforced |
| **Cache** | Redis TTL on feeds, stats, plans (5-10 min) |

---

## Email Templates

| Template | Trigger | Recipient |
|----------|---------|-----------|
| register_welcome | User đăng ký | User |
| order_new | Tạo đơn hàng | Admin |
| order_customer_confirm | KH bấm "đã chuyển" | Admin |
| order_paid | Admin duyệt | User |
| order_failed | Admin từ chối | User |
| order_reminder | Đơn pending > 12h | User |
| reset_password | Quên mật khẩu | User |
| storage_warning | Dung lượng < 10% | User |

---

## Cron Schedule

| Time (UTC+7) | Job | Description |
|--------------|-----|-------------|
| 02:00 daily | expire-images | Batch xóa ảnh hết hạn + R2 + quota |
| 03:00 daily | reconcile-quota | Đồng bộ Redis quota ↔ DB |
| Every hour | remind-payments | Nhắc đơn pending > 12h |
| Every hour | storage-monitor | Snapshot metrics + alert check |
