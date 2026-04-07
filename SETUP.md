# SETUP — Hướng dẫn cài đặt

## Yêu cầu hệ thống

| Software | Version | Mục đích |
|----------|---------|----------|
| Node.js | 20+ | Build + chạy dev |
| Docker | 24+ | MySQL, Redis, production |
| npm | 10+ | Package manager |
| Git | 2.40+ | Version control |

## 1. Clone project

```bash
git clone <repo-url>
cd WebPhoto
```

## 2. Start MySQL + Redis (Docker)

```bash
docker-compose up -d
```

Kiểm tra:
```bash
docker ps
# shared-mysql   Up   0.0.0.0:3306->3306
# shared-redis   Up   0.0.0.0:6379->6379
```

## 3. Setup Backend

```bash
cd photo-storage/server

# Cài dependencies
npm ci

# Tạo file .env
cp .env.example .env
```

### Sửa `.env`:

```env
# Bắt buộc
DATABASE_URL=mysql://root:root123@localhost:3306/photo_storage
REDIS_URL=redis://localhost:6379
JWT_SECRET=<random-64-hex>          # openssl rand -hex 32

# Cloudflare R2 (cần đăng ký)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY=<access-key>
R2_SECRET_KEY=<secret-key>
R2_PRIVATE_BUCKET=webphoto
R2_PUBLIC_BUCKET=webphoto-public
CDN_URL=https://pub-xxx.r2.dev

# Resend (cần đăng ký)
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=noreply@yourdomain.com

# App
APP_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
CRON_SECRET=<random-32-hex>         # openssl rand -hex 16
```

### Push schema + Seed:

```bash
# Tạo tables trong MySQL
npm run db:push

# Seed dữ liệu mặc định
npm run db:seed
```

Output:
```
Seeding plans...
Seeding system settings...
Seeding admin user...
Seed completed!
```

### Dữ liệu seed:

| Table | Data |
|-------|------|
| plans | Free (5GB, 5 albums) / Cơ bản (50GB, unlimited) / Pro (200GB, unlimited) |
| system_settings | registration_open, max_upload_size_mb, allowed_mime_types, thresholds |
| users | admin@photostorage.com / admin123 (role: admin, plan: Pro) |

## 4. Start Backend

```bash
# Development (auto-reload)
npm run dev
# → API server running on port 4000
# → Socket.io server running on port 4001
```

Kiểm tra: http://localhost:4000/api/health → `{"status":"ok"}`

## 5. Setup Frontend

```bash
cd photo-storage     # (từ root)

# Cài dependencies
npm ci
```

File `.env` (tự động dùng proxy qua Vite):
```env
# Không cần sửa cho local dev — Vite proxy /api → localhost:4000
```

## 6. Start Frontend

```bash
npm run dev
# → http://localhost:3000
```

## 7. Verify

| URL | Expected |
|-----|----------|
| http://localhost:3000 | Trang chủ PhotoStorage |
| http://localhost:3000/login | Form đăng nhập |
| http://localhost:3000/admin | Admin dashboard (sau khi login admin) |
| http://localhost:4000/api/health | `{"status":"ok"}` |
| http://localhost:4000/api/plans | 3 plans (Free/Basic/Pro) |

### Login admin:
- Email: `admin@photostorage.com`
- Password: `admin123`
- **Đổi password ngay sau khi đăng nhập!**

## 8. Start Worker (optional)

Worker xử lý ảnh RAW chạy riêng:

```bash
cd photo-storage/server
npx tsx src/workers/start.ts
```

> Worker cần `dcraw` để decode RAW. Trên Windows, cài dcraw hoặc chỉ test với JPEG/PNG.

## Quick Start (1 lệnh)

### Windows:
```bash
scripts\dev.bat
```

### Linux/Mac:
```bash
bash scripts/dev.sh
```

## Troubleshooting

### MySQL connection refused
```bash
# Kiểm tra container
docker ps | grep shared-mysql
docker logs shared-mysql

# Đợi MySQL ready (30s sau khi start)
docker exec shared-mysql mysqladmin ping -h localhost -u root -proot123
```

### Port already in use
```bash
# Tìm process đang dùng port
netstat -ano | grep :4000
# Kill process (Windows)
taskkill /PID <pid> /F
```

### drizzle-kit push lỗi BigInt
```
TypeError: Do not know how to serialize a BigInt
```
→ Đã fix: dùng `sql\`0\`` thay cho `BigInt(0)` trong schema default

### Redis connection error
```bash
# Kiểm tra Redis
docker exec shared-redis redis-cli ping
# → PONG
```
