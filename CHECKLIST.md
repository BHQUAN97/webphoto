# PHOTO STORAGE — CHECKLIST TRIỂN KHAI BACKEND

> Cập nhật sau mỗi task hoàn thành

---

## Bước 1: Frontend (Vue 3 + Vite + Tailwind) — DONE
- [x] 22 pages (public, dashboard, admin)
- [x] 21 components (layout, album, image, admin, ui)
- [x] 4 Pinia stores (auth, upload, notification, admin)
- [x] Vue Router with guards
- [x] TypeScript types
- [x] Axios API utilities with token refresh

## Bước 2: Database Schema + Migrations + Seed — DONE
- [x] schema.ts — 14 tables (users, plans, userPlans, storageAddons, paymentMethods, payments, albums, images, likes, comments, refreshTokens, systemSettings, adminLogs, storageSnapshots)
- [x] seed.ts — plans (free, basic, pro) + system_settings defaults + admin user
- [ ] drizzle migrations generated (cần chạy `npm run db:generate` khi có DB)

## Bước 3: Server Utils — DONE
- [x] db.ts — Drizzle + MySQL2 pool
- [x] redis.ts — Redis client + quotaRedis + feedCache + incrVisit + acquirePaymentLock
- [x] r2.ts — S3 client (multipart upload, presign, download, stream, delete)
- [x] jwt.ts — jose sign/verify
- [x] hash.ts — bcryptjs hash/compare
- [x] quota.ts — getTotalQuota, canUpload, addUsed, subtractUsed
- [x] socket-emit.ts — Redis pub/sub emitToUser, emitToAdmin
- [x] mailService.ts — Resend + 8 email templates
- [x] admin-stats.ts — getOverview, getChartData, getTopStorageUsers, log

## Bước 4: Auth API + Middleware — DONE
- [x] middleware/auth.ts — JWT verify + incrVisit + requireAuth/requireAdmin/requirePlan
- [x] middleware/admin.ts — Admin guard
- [x] middleware/rateLimit.ts — Redis rate limiter
- [x] routes/auth/register.ts — đăng ký + assign free plan + welcome email
- [x] routes/auth/login.ts — đăng nhập + JWT + refresh token
- [x] routes/auth/logout.ts — xóa tokens
- [x] routes/auth/refresh.ts — rotate refresh token
- [x] index.ts — Express server entry point (cors, cookies, all routes mounted)

## Bước 5: Album CRUD + Image List API — DONE
- [x] routes/albums/ GET / — public feed (cursor-based, cached)
- [x] routes/albums/ POST / — create album (check plan limit)
- [x] routes/albums/ GET /:id — album detail (access control)
- [x] routes/albums/ PATCH /:id — update album
- [x] routes/albums/ DELETE /:id — delete album + cascade images + R2 cleanup
- [x] routes/images/ GET / — list with filters (status, liked, sortBy, dateRange, search, cursor)

## Bước 6: Image Upload — S3 Multipart — DONE
- [x] routes/images/ POST /upload-url — mime check, quota check, presigned parts
- [x] routes/images/ POST /complete — complete multipart + update album stats

## Bước 7-8: Workers + Socket.io — DONE
- [x] workers/imageProcessor.ts — dcraw + Sharp pipeline (RAW decode → WebP thumb + preview)
- [x] workers/imageExpiry.ts — batch delete expired images
- [x] workers/emailSender.ts — BullMQ email worker
- [x] workers/storageMonitor.ts — hourly snapshot + alerts
- [x] plugins/socket.ts — Socket.io server with Redis adapter + auth
- [x] plugins/bullmq.ts — Queue setup + recurring jobs

## Bước 9-10: Like/Comment + User APIs — DONE
- [x] routes/images/ POST /:id/like — like + notify owner
- [x] routes/images/ DELETE /:id/like — unlike
- [x] routes/images/ GET /:id/comments — list comments
- [x] routes/images/ POST /:id/comments — add comment + notify owner
- [x] routes/images/ GET /:id/download-url — presigned download (Basic+ only)
- [x] routes/users/ GET /me — profile + plan info
- [x] routes/users/ PATCH /me — update profile / password
- [x] routes/users/ GET /me/storage — used/limit bytes
- [x] routes/users/ GET /me/albums — user's albums
- [x] routes/users/ GET /me/stats — totalImages/likes/comments
- [x] routes/users/ GET /me/payments — payment history

## Bước 12-13: Payment Flow — DONE
- [x] routes/payments/ POST /create — create order + notify admin
- [x] routes/payments/ POST /:id/confirm — customer confirms transfer (idempotency lock)
- [x] routes/payments/ POST /:id/cancel — customer cancels
- [x] routes/admin/payments/ POST /:id/approve — activate plan + email + socket
- [x] routes/admin/payments/ POST /:id/reject — mark failed + email
- [x] routes/admin/payment-methods/ CRUD (GET, POST, PATCH, DELETE)

## Bước 14-16: Admin APIs — DONE
- [x] routes/admin/dashboard/ GET /stats — overview stats
- [x] routes/admin/dashboard/ GET /charts — chart data (visits, revenue, storage, plan distribution)
- [x] routes/admin/dashboard/ GET /alerts — R2 usage + top users
- [x] routes/admin/users/ GET / — list with search/filter/pagination
- [x] routes/admin/users/ GET /:id — user detail + plan + albums + payments
- [x] routes/admin/users/ PATCH /:id — update user + quota override
- [x] routes/admin/users/ DELETE /:id — cascade delete
- [x] routes/admin/users/ POST /:id/grant-plan — grant plan manually
- [x] routes/admin/albums/ GET / — list with search/filter
- [x] routes/admin/albums/ PATCH /:id — toggle visibility
- [x] routes/admin/albums/ DELETE /:id — cascade delete
- [x] routes/admin/plans/ GET / — list with user count
- [x] routes/admin/plans/ POST / — create plan
- [x] routes/admin/plans/ PATCH /:id — update plan
- [x] routes/admin/settings/ GET / — all settings
- [x] routes/admin/settings/ PATCH / — update settings
- [x] routes/admin/payments/ GET / — list with filters + total revenue
- [x] routes/admin/payments/ GET /export — CSV export

## Bước 17: Cron Jobs — DONE
- [x] routes/cron/ GET /expire-images — loop batch delete expired
- [x] routes/cron/ GET /reconcile-quota — sync Redis with DB
- [x] routes/cron/ GET /remind-payments — remind pending > 12h

## Security Audit & Fixes — DONE
### Backend
- [x] validate.ts — Input validation & sanitization utilities
- [x] Path traversal fix: sanitizeFilename() strip ../ and slashes in upload
- [x] File extension whitelist: isAllowedExtension() double-check beyond mime type
- [x] File size validation: isValidFileSize() absolute 500MB limit
- [x] SQL LIKE injection: sanitizeSearch() escape % and _ wildcards
- [x] Enum validation: isValidImageStatus(), isValidSortBy() prevent arbitrary values
- [x] ULID format validation: isValidUlid() for all ID params
- [x] Comment/bio XSS: sanitizeText() strip HTML tags + control chars
- [x] Email validation: isValidEmail() format check
- [x] Password strength: isValidPassword() min 8 chars, upper+lower+number
- [x] Security headers: X-Content-Type-Options, X-Frame-Options, CSP, HSTS, Referrer-Policy
- [x] Error handler: hide 500 stack traces from client, only show safe messages
- [x] Date string validation for filter params

### Frontend
- [x] Open redirect fix: getSafeRedirect() in login.vue — only allow internal paths
- [x] JSON.parse safety: try-catch in payment-methods config editing
- [x] Console.log removal: conditional on import.meta.env.DEV in socket plugin
- [x] Password validation: updated to match backend (8+ chars, upper+lower+number)
- [x] CSP meta tag: added to index.html
- [x] Comment input: maxlength="2000" attribute
- [x] File upload validation: client-side extension + size check before upload
- [x] XSS safe: confirmed no v-html usage, Vue {{ }} auto-escapes

## FE-BE API Audit & Fixes — DONE
### Missing endpoints added
- [x] GET /api/plans — public endpoint for upgrade page (was behind adminGuard)
- [x] GET /api/payment-methods — public endpoint for checkout (was behind adminGuard)
- [x] GET /api/admin/dashboard/top-users — FE gọi riêng, BE trước đó gộp vào /alerts
- [x] GET /api/images/:id — single image detail (spec yêu cầu, FE cần)
- [x] DELETE /api/images/:id — delete single image + R2 cleanup + quota update

### Param/response mismatches fixed
- [x] GET /users/me/albums — thêm hỗ trợ ?limit=N param (FE gửi limit=8)
- [x] GET /images?liked=true — accept cả `'1'` và `'true'` (FE gửi true)
- [x] POST /admin/users/:id/grant-plan — accept cả `days` và `durationDays` field
- [x] BullMQ job enqueue — kết nối imageQueue.add() trong /complete endpoint

### FE response format fixes (9 files)
- [x] upgrade.vue — đổi từ /admin/plans → /plans, /admin/payment-methods → /payment-methods
- [x] upgrade.vue — fix confirmTransfer dùng paymentId thay vì referenceCode
- [x] All FE list pages — thêm correct key (`.items`, `.albums`, `.comments`, `.methods`, `.plans`) trước fallback `.data`
  - admin/albums, admin/users, admin/payments, admin/plans, admin/payment-methods
  - dashboard/albums, dashboard/albums/[id], dashboard/favorites
  - CommentList.vue

## Performance Audit & Fixes — DONE

### Backend (8 fixes)
- [x] **N+1 admin users**: Replaced loop queries with single LEFT JOIN (users + userPlans + plans) + batch Redis
- [x] **N+1 admin plans**: Replaced loop COUNT with single GROUP BY query
- [x] **6 stats queries → 2**: Combined user stats into single CASE WHEN query (6→2 queries)
- [x] **Liked filter full scan → JOIN**: Replaced in-memory filter with INNER JOIN likes table
- [x] **System settings caching**: New settings-cache.ts with 60s TTL, invalidate on admin update
- [x] **redis.keys() → SCAN**: Non-blocking cursor-based scan for cache invalidation
- [x] **DB pool config**: Added connectionLimit=20, maxIdle=10, keepAlive, idleTimeout
- [x] **Static import BullMQ**: Replaced dynamic import() with top-level import

### Frontend (4 fixes)
- [x] **Debounce search inputs**: 300ms debounce on admin users/albums/payments search (debounce.ts utility)
- [x] **Debounce filter bar**: 400ms debounce on ImageFilterBar search input
- [x] **Socket listener leak**: Added socket.off('notification') before re-attaching in useNotify
- [x] **Images already optimized**: Confirmed lazy loading on ImageCard + AlbumCard

---

# CÁC BƯỚC TIẾP THEO

## Bước 18: Docker & Local Dev Environment — DONE
- [x] Dockerfile cho BE server (Node.js + dcraw + sharp)
- [x] Dockerfile.worker cho Worker (Node.js + dcraw + libvips + sharp)
- [x] workers/start.ts — Worker entry point (graceful shutdown)
- [x] docker-compose.yml cho local dev (MySQL 8 + Redis + API + Worker)
- [x] docker-compose volumes cho data persistence
- [x] .env.example + .env.production.example hoàn chỉnh
- [x] Build & test — FE (vite build OK, 3.37s) + BE (tsc OK, 0 errors)
- [x] vercel.json — FE deploy config (rewrites, cache headers, security headers)
- [x] railway.json — BE deploy config (healthcheck, restart policy)
- [x] Procfile — web + worker processes
- [x] .dockerignore, .gitignore
- [x] scripts/setup.sh — one-command server setup
- [x] scripts/test-local.sh — automated API test (17 test cases)
- [x] scripts/dev.sh + dev.bat — start all services locally
- [x] .github/workflows/ci.yml — CI pipeline (typecheck + build FE & BE)
- [x] .github/workflows/cron.yml — scheduled tasks (expire, reconcile, remind)
- [x] DEPLOY.md — complete deployment guide (8 steps)

## Bước 19: Database Setup & Migrations
- [ ] Cài MySQL 8 local (hoặc dùng Docker)
- [ ] Tạo database `photo_storage`
- [ ] Chạy `npm run db:push` — push schema lên MySQL
- [ ] Chạy `npm run db:generate` — generate migration files
- [ ] Chạy `npm run db:seed` — seed plans + settings + admin user
- [ ] Verify: đăng nhập admin@photostorage.com / admin123

## Bước 20: Cloudflare R2 Setup
- [ ] Tạo Cloudflare account (nếu chưa có)
- [ ] Tạo R2 bucket `photo-raw-private` (private — lưu ảnh gốc)
- [ ] Tạo R2 bucket `photo-serve-public` (public — lưu thumb/preview)
- [ ] Tạo R2 API token (read/write cả 2 buckets)
- [ ] Cấu hình Custom Domain cho public bucket (CDN)
- [ ] Set CORS policy cho public bucket (allow frontend origin)
- [ ] Cập nhật .env: R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, CDN_URL

## Bước 21: Redis Setup
- [ ] Option A: Upstash Redis (free tier, serverless) — khuyên dùng
- [ ] Option B: Redis local/Docker cho dev
- [ ] Cập nhật .env: REDIS_URL
- [ ] Verify kết nối: `npm run dev` không lỗi Redis

## Bước 22: Email Service (Resend)
- [ ] Đăng ký Resend (free 100 emails/ngày)
- [ ] Verify domain gửi email
- [ ] Tạo API key
- [ ] Cập nhật .env: RESEND_API_KEY, FROM_EMAIL
- [ ] Test gửi email: đăng ký user mới → nhận welcome email

## Bước 23: Test Local End-to-End
- [ ] Start MySQL + Redis (docker-compose up -d)
- [ ] Start BE: `cd server && npm run dev`
- [ ] Start FE: `cd photo-storage && npm run dev`
- [ ] Test flow đăng ký / đăng nhập
- [ ] Test tạo album / upload ảnh (JPEG trước, RAW sau)
- [ ] Test like / comment
- [ ] Test xem profile + stats
- [ ] Test admin dashboard (login admin@photostorage.com)
- [ ] Test admin quản lý users / albums / plans
- [ ] Test payment flow: tạo đơn → xác nhận → admin duyệt
- [ ] Test admin payment methods CRUD
- [ ] Test admin settings
- [ ] Test real-time notifications (Socket.io)
- [ ] Test image processing worker (dcraw + Sharp)
- [ ] Test cron endpoints (curl với x-cron-secret header)
- [ ] Test download ảnh gốc (cần plan Basic+)
- [ ] Test bộ lọc ảnh (status, liked, dateRange, search, sort)

## Bước 24: Deploy Frontend (Vercel)
- [ ] Push code lên GitHub repo
- [ ] Kết nối Vercel với GitHub repo
- [ ] Cấu hình root directory: `photo-storage`
- [ ] Cấu hình build command: `npm run build`
- [ ] Cấu hình output directory: `dist`
- [ ] Set env vars: VITE_API_URL, VITE_CDN_URL, VITE_SOCKET_URL
- [ ] Cấu hình rewrites: `/* → /index.html` (SPA fallback)
- [ ] Custom domain (nếu có)
- [ ] Verify deploy: truy cập URL → trang chủ hiển thị

## Bước 25: Deploy Backend API (Railway)
- [ ] Tạo project Railway
- [ ] Service 1 — API Server:
  - [ ] Dockerfile hoặc Nixpacks (Node.js)
  - [ ] Set env vars (DATABASE_URL, REDIS_URL, JWT_SECRET, R2_*, RESEND_*, ...)
  - [ ] Expose port 4000
  - [ ] Custom domain / Railway URL
- [ ] Service 2 — Worker (image processing):
  - [ ] Dockerfile với `apt-get install dcraw` (hoặc libraw-bin)
  - [ ] Entrypoint: `node dist/workers/start.js`
  - [ ] Set env vars (same as API)
  - [ ] Không expose port (background worker)
- [ ] Service 3 — Socket.io Server:
  - [ ] Port 4001
  - [ ] Custom domain cho WebSocket

## Bước 26: Database Production (PlanetScale / Railway MySQL)
- [ ] Option A: PlanetScale (serverless MySQL, free tier)
- [ ] Option B: Railway MySQL add-on
- [ ] Chạy migrations trên production DB
- [ ] Chạy seed trên production DB
- [ ] Verify kết nối từ API server

## Bước 27: Cron Jobs Setup
- [ ] Tạo CRON_SECRET random string
- [ ] Cấu hình Vercel Cron (vercel.json) hoặc Railway Cron:
  - [ ] `0 2 * * *` → GET /api/cron/expire-images
  - [ ] `0 3 * * *` → GET /api/cron/reconcile-quota
  - [ ] `0 * * * *` → GET /api/cron/remind-payments
- [ ] Verify: cron chạy đúng lịch + header x-cron-secret

## Bước 28: Domain & SSL
- [ ] Mua domain (nếu chưa có)
- [ ] Cấu hình DNS:
  - [ ] `app.domain.com` → Vercel (frontend)
  - [ ] `api.domain.com` → Railway API
  - [ ] `ws.domain.com` → Railway Socket.io
  - [ ] `cdn.domain.com` → Cloudflare R2 public bucket
- [ ] SSL tự động (Vercel/Cloudflare/Railway đều có)
- [ ] Cập nhật env vars với domain thật:
  - [ ] APP_URL, CORS_ORIGIN, VITE_API_URL, VITE_SOCKET_URL, CDN_URL

## Bước 29: Monitoring & Logging
- [ ] Cấu hình error logging (Sentry hoặc Railway logs)
- [ ] Set up uptime monitoring (UptimeRobot / BetterStack — free tier)
  - [ ] Monitor API: GET /api/health
  - [ ] Monitor Frontend: GET /
- [ ] Theo dõi R2 usage qua Cloudflare dashboard
- [ ] Theo dõi Redis usage qua Upstash dashboard
- [ ] Set alert khi CPU/Memory Railway vượt ngưỡng

## Bước 30: Go Live
- [ ] Kiểm tra lại toàn bộ .env production (không leak secret)
- [ ] Test end-to-end trên production URL
- [ ] Tạo tài khoản admin chính thức (đổi password mặc định)
- [ ] Xóa hoặc vô hiệu hóa admin seed account
- [ ] Backup database lần đầu
- [ ] Thông báo go live cho team / khách hàng
