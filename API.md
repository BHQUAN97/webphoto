# API Documentation — PhotoStorage

Base URL: `http://localhost:4000` (dev) | `https://bhquan.site` (prod)

Tất cả request/response dùng JSON. Authentication qua HttpOnly cookie hoặc `Authorization: Bearer <token>`.

---

## Authentication

### POST /api/auth/register
Đăng ký tài khoản mới. Tự động gán gói Free.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "Test1234",         // min 8 chars, upper+lower+number
  "displayName": "Nguyen Van A"
}
```

**Response 200:**
```json
{
  "user": { "id": "01K...", "email": "...", "displayName": "...", "role": "user", "planCode": "free" },
  "accessToken": "eyJ..."
}
```

**Errors:** 400 (validation) | 403 (registration closed) | 409 (email exists)

---

### POST /api/auth/login

**Body:**
```json
{ "email": "user@example.com", "password": "Test1234" }
```

**Response 200:**
```json
{
  "user": { "id": "...", "email": "...", "displayName": "...", "role": "user|admin", "avatarKey": null, "planCode": "free|basic|pro" },
  "accessToken": "eyJ..."
}
```

**Cookies set:** `access_token` (15min, HttpOnly) + `refresh_token` (7d, HttpOnly, path=/api/auth/refresh)

**Errors:** 400 | 401 (wrong credentials) | 403 (account banned)

---

### POST /api/auth/refresh
Rotate refresh token, trả access token mới. Không cần body — đọc cookie.

**Response 200:** Same as login

---

### POST /api/auth/logout
Xóa tất cả refresh tokens. Cần auth.

**Response 200:** `{ "ok": true }`

---

## User Profile

> Tất cả cần Authentication

### GET /api/users/me
Profile + plan info.

**Response:**
```json
{
  "id": "01K...", "email": "...", "displayName": "...",
  "avatarKey": null, "bio": null, "role": "user",
  "createdAt": "2026-03-24T...",
  "planCode": "free", "planName": "Free", "planExpiresAt": "2026-04-23T..."
}
```

### PATCH /api/users/me
Update profile hoặc đổi password.

**Body (profile):**
```json
{ "displayName": "New Name", "bio": "About me" }
```

**Body (password):**
```json
{ "currentPassword": "Old1234", "newPassword": "New12345" }
```

### GET /api/users/me/storage
```json
{ "used": "0", "limit": "5368709120" }   // bytes as string (BigInt)
```

### GET /api/users/me/stats
```json
{
  "totalImages": 0, "processingImages": 0, "failedImages": 0,
  "totalAlbums": 0, "totalLikes": "0", "totalComments": "0"
}
```

### GET /api/users/me/albums
Supports `?limit=N`.
```json
{
  "albums": [
    { "id": "...", "title": "...", "imageCount": 5, "totalBytes": "1234567", "expiresAt": "...", ... }
  ]
}
```

### GET /api/users/me/payments
```json
{
  "payments": [
    { "id": "...", "referenceCode": "DHXYZ123", "amountVnd": 49000, "status": "paid", "planName": "Cơ bản", ... }
  ]
}
```

---

## Albums

### GET /api/albums
Public feed. Cursor-based pagination.

**Params:** `?cursor=<id>&limit=20`

**Response:**
```json
{
  "items": [
    { "id": "...", "title": "...", "coverKey": "...", "imageCount": 10, "displayName": "Owner", ... }
  ],
  "nextCursor": "01K..."   // null nếu hết
}
```

### POST /api/albums *(auth)*
```json
{ "title": "Album name", "description": "...", "isPublic": true }
```
**Response:** `{ "id": "01K...", "title": "...", ... }`

**Errors:** 403 (đạt giới hạn album theo gói)

### GET /api/albums/:id
Album detail. Public album ai cũng xem được. Private album chỉ owner.

### PATCH /api/albums/:id *(auth, owner)*
```json
{ "title": "New title", "description": "...", "isPublic": false }
```

### DELETE /api/albums/:id *(auth, owner)*
Cascade xóa tất cả ảnh + files trên R2. `{ "ok": true }`

---

## Images

### GET /api/images
List ảnh với bộ lọc. Cursor-based pagination.

**Params:**
| Param | Type | Description |
|-------|------|-------------|
| albumId | ULID | Filter theo album |
| liked | `true`/`1` | Chỉ ảnh đã like (cần auth) |
| status | `ready`/`processing`/`failed` | Filter trạng thái |
| sortBy | `newest`/`oldest`/`most_liked`/`largest` | Sắp xếp |
| dateFrom | ISO date | Từ ngày |
| dateTo | ISO date | Đến ngày |
| search | string | Tìm theo tên file |
| cursor | ULID | Pagination cursor |
| limit | number | Max 50, default 20 |

**Response:**
```json
{
  "items": [
    {
      "id": "...", "albumId": "...", "originalName": "DSC_001.cr2",
      "originalSize": "45678901", "width": 6000, "height": 4000,
      "status": "ready", "likeCount": 5, "commentCount": 2,
      "thumbUrl": "https://cdn.../thumb.webp",
      "previewUrl": "https://cdn.../preview.webp",
      "liked": false,
      "createdAt": "..."
    }
  ],
  "nextCursor": "01K..."
}
```

### GET /api/images/:id
Single image detail. Owner hoặc public album.

### DELETE /api/images/:id *(auth, owner)*
Xóa ảnh + R2 files + cập nhật quota. `{ "ok": true }`

### POST /api/images/upload-url *(auth, rate: 10/min)*
Khởi tạo S3 multipart upload.

**Body:**
```json
{ "filename": "DSC_001.cr2", "size": 45678901, "albumId": "01K...", "mimeType": "image/x-canon-cr2" }
```

**Response:**
```json
{
  "imageId": "01K...",
  "uploadId": "abc123",
  "key": "userId/imageId/original.cr2",
  "partUrls": ["https://r2.../part1?sig=...", "https://r2.../part2?sig=..."]
}
```

Client upload từng part lên R2 trực tiếp (PUT presigned URL).

### POST /api/images/complete *(auth)*
Hoàn tất multipart upload → enqueue image processing job.

**Body:**
```json
{
  "imageId": "01K...", "uploadId": "abc123", "key": "userId/imageId/original.cr2",
  "parts": [{ "ETag": "\"abc\"", "PartNumber": 1 }, ...]
}
```

### POST /api/images/:id/like *(auth)*
```json
{ "ok": true, "likeCount": 6 }
```

### DELETE /api/images/:id/like *(auth)*
```json
{ "ok": true, "likeCount": 5 }
```

### GET /api/images/:id/comments
```json
{
  "comments": [
    { "id": "...", "content": "Nice shot!", "userId": "...", "displayName": "...", "avatarKey": null, "createdAt": "..." }
  ]
}
```

### POST /api/images/:id/comments *(auth)*
```json
{ "content": "Great photo!" }
```

### GET /api/images/:id/download-url *(auth, Basic+ plan)*
Presigned download URL (15 min TTL).
```json
{ "url": "https://r2.../original.cr2?sig=..." }
```

---

## Plans & Payment Methods (Public)

### GET /api/plans
Active plans cho upgrade page.
```json
{
  "plans": [
    { "id": "...", "code": "free", "name": "Free", "priceVnd": 0, "durationDays": 30, "quotaBytes": "5368709120", "maxAlbums": 5, ... }
  ]
}
```

### GET /api/payment-methods
Active payment methods cho checkout.
```json
{
  "methods": [
    { "id": "...", "type": "bank_transfer", "name": "Vietcombank", "isDefault": true, "config": { "bankName": "...", "accountNo": "...", ... } }
  ]
}
```

---

## Payments

### POST /api/payments/create *(auth)*
Tạo đơn hàng. Gửi email cho admin.

```json
{ "planCode": "basic", "paymentMethodId": "01K..." }
```

**Response:**
```json
{
  "paymentId": "01K...", "referenceCode": "DHXYZ123", "amount": 49000,
  "method": { "type": "bank_transfer", "name": "...", "config": { ... } }
}
```

### POST /api/payments/:id/confirm *(auth, owner)*
Khách hàng bấm "Tôi đã chuyển khoản". Dùng Redis lock idempotency.

```json
{ "customerNote": "Đã CK lúc 10h sáng" }
```

### POST /api/payments/:id/cancel *(auth, owner)*
Khách hàng hủy đơn.

---

## Admin APIs

> Tất cả cần role `admin`

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/dashboard/stats | Overview: users, images, revenue, storage |
| GET | /api/admin/dashboard/charts | 30-day charts: visits, users, revenue, storage, plans |
| GET | /api/admin/dashboard/alerts | R2 limit info |
| GET | /api/admin/dashboard/top-users | Top 10 users by storage |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/users | List users (`?search&status&sortBy&cursor&limit`) |
| GET | /api/admin/users/:id | User detail + plan + albums + payments + storage |
| PATCH | /api/admin/users/:id | Update user (name, email, role, isActive, quotaOverride) |
| DELETE | /api/admin/users/:id | Cascade delete user + all data |
| POST | /api/admin/users/:id/grant-plan | Grant plan: `{ "planCode": "pro", "days": 365 }` |

### Album Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/albums | List albums (`?search&visibility&cursor`) |
| PATCH | /api/admin/albums/:id | Toggle isPublic/isActive |
| DELETE | /api/admin/albums/:id | Cascade delete + R2 cleanup |

### Payment Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/payments | List (`?search&status&dateFrom&dateTo&cursor`) + totalRevenue |
| GET | /api/admin/payments/export | CSV export |
| POST | /api/admin/payments/:id/approve | Approve + activate plan + email: `{ "deliveryInfo": "...", "adminNote": "..." }` |
| POST | /api/admin/payments/:id/reject | Reject + email: `{ "adminNote": "Lý do" }` |

### Plan Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/plans | List plans + active user count |
| POST | /api/admin/plans | Create plan |
| PATCH | /api/admin/plans/:id | Update plan |

### Payment Method Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/payment-methods | List all methods |
| POST | /api/admin/payment-methods | Create method |
| PATCH | /api/admin/payment-methods/:id | Update method |
| DELETE | /api/admin/payment-methods/:id | Delete method |

### System Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/settings | All settings as key-value |
| PATCH | /api/admin/settings | Update: `{ "registration_open": "false", "max_upload_size_mb": "500" }` |

**Settings keys:**
| Key | Default | Description |
|-----|---------|-------------|
| registration_open | true | Bật/tắt đăng ký |
| max_upload_size_mb | 200 | Giới hạn upload (MB) |
| allowed_mime_types | [...] | Danh sách MIME types |
| storage_alert_threshold_percent | 80 | Ngưỡng cảnh báo R2 (%) |
| image_error_spike_threshold | 20 | Ngưỡng spike ảnh lỗi/giờ |
| worker_stuck_minutes | 30 | Ngưỡng worker bị treo (phút) |

---

## Cron Jobs

> Cần header `x-cron-secret` khớp với env `CRON_SECRET`

| Method | Endpoint | Schedule | Description |
|--------|----------|----------|-------------|
| GET | /api/cron/expire-images | 2:00 AM daily | Xóa ảnh hết hạn + R2 cleanup + quota update |
| GET | /api/cron/reconcile-quota | 3:00 AM daily | Đồng bộ Redis quota với DB |
| GET | /api/cron/remind-payments | Every hour | Nhắc đơn pending > 12h |

---

## Error Responses

Tất cả errors trả format:
```json
{ "message": "Mô tả lỗi" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Chưa đăng nhập |
| 403 | Không có quyền / cần nâng cấp gói |
| 404 | Không tìm thấy |
| 409 | Conflict (duplicate, đang xử lý) |
| 429 | Rate limit exceeded |
| 500 | Server error (message ẩn chi tiết) |

---

## WebSocket Events

Connect: `io("https://bhquan.site", { path: "/socket.io", auth: { token } })`

### User Events
| Event | Data | Description |
|-------|------|-------------|
| image:ready | `{ imageId, thumbUrl }` | Ảnh xử lý xong |
| image:failed | `{ imageId, reason }` | Ảnh xử lý lỗi |
| payment:success | `{ planCode, expiresAt }` | Gói được kích hoạt |
| photo:liked | `{ imageId, likedBy }` | Có người like ảnh |
| photo:commented | `{ imageId, comment, by }` | Có comment mới |
| storage:warning | `{ usedPercent }` | Dung lượng < 10% |

### Admin Events (room: admin)
| Event | Data | Description |
|-------|------|-------------|
| admin:storage:alert | `{ message, usedPercent }` | R2 vượt ngưỡng |
| admin:worker:stuck | `{ jobId, queue, minutes }` | Worker bị treo |
| admin:image:error:spike | `{ count, threshold }` | Spike ảnh lỗi |
| admin:new:payment | `{ paymentId, amountVnd }` | Đơn hàng mới |
| admin:user:registered | `{ userId, email }` | User mới đăng ký |
