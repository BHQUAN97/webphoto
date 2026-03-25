# PHOTO STORAGE — DEPLOYMENT GUIDE
# Domain: bhquan.site

## Tổng quan kiến trúc

```
                  ┌────────────────────┐
                  │    Cloudflare      │
                  │  DNS + R2 Storage  │
                  └────────┬───────────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
  bhquan.site        api.bhquan.site      cdn.bhquan.site
      │                    │                    │
      └────────┬───────────┘                    │
               │                          ┌─────┴─────┐
         ┌─────┴─────┐                    │ R2 Public │
         │   Nginx   │                    │  Bucket   │
         │  (Docker) │                    └───────────┘
         └─────┬─────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───┴───┐ ┌───┴───┐ ┌────┴───┐
│  API  │ │Worker │ │Socket  │
│ :4000 │ │ (bg)  │ │ :4001  │
└───┬───┘ └───┬───┘ └────────┘
    │         │
┌───┴───┐ ┌───┴───┐
│ MySQL │ │ Redis │
│ :3306 │ │ :6379 │
└───────┘ └───────┘
   Tất cả chạy trên Docker
```

---

## Bước 1: Setup dịch vụ bên ngoài

### 1.1 MySQL + Redis — Docker (đã có trong docker-compose.prod.yml)
```
Không cần đăng ký dịch vụ bên ngoài.
MySQL 8 và Redis 7 chạy trong Docker container.
Đã cấu hình sẵn trong docker-compose.prod.yml
```

### 1.2 Cloudflare R2 (free: 10GB storage, 1M requests/tháng)
```
1. Vào https://dash.cloudflare.com → R2
2. Create bucket: "photo-raw-private"
   - Không bật public access
3. Create bucket: "photo-serve-public"
   - Settings → Public Access → Enable
   - Custom domain: cdn.bhquan.site
4. R2 → Manage R2 API Tokens → Create API Token
   - Permissions: Object Read & Write
   - Specify buckets: cả 2 buckets
5. Copy: Account ID, Access Key, Secret Key → .env
```

### 1.3 Resend (free: 100 emails/ngày)
```
1. Vào https://resend.com → Sign up
2. Domains → Add domain: bhquan.site → Verify DNS records
3. API Keys → Create API Key
4. Copy: RESEND_API_KEY
```

---

## Bước 2: Chuẩn bị code

### 2.1 Tạo .env cho server
```bash
cd photo-storage/server
cp .env.production.example .env
# Sửa .env với thông tin thật từ Bước 1
```

### 2.2 Build backend
```bash
cd photo-storage/server
npm ci
npm run build
```

### 2.3 Setup database
```bash
# Push schema lên MySQL
npm run db:push

# Seed data mặc định
npm run db:seed
```

### 2.4 Test local
```bash
# Terminal 1: Start API
npm run dev

# Terminal 2: Start Worker
npx tsx src/workers/start.ts

# Terminal 3: Run tests
bash scripts/test-local.sh
```

---

## Bước 3: Deploy lên server (Docker)

### 3.1 Chuẩn bị VPS
```bash
# SSH vào server
ssh user@your-server-ip

# Cài Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Cài Node.js 20 (cho build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone code
git clone https://github.com/YOUR_USER/photo-storage.git /opt/photo-storage
cd /opt/photo-storage
```

### 3.2 Cấu hình .env
```bash
# Sửa .env với thông tin thật
cp .env.example .env
nano .env
# Điền: JWT_SECRET, R2_*, RESEND_API_KEY, CRON_SECRET
# Lưu ý: MYSQL_PASSWORD và JWT_SECRET dùng random mạnh
```

### 3.3 Deploy 1 lệnh
```bash
bash scripts/deploy.sh
```

### 3.4 SSL Certificate
```bash
# Lần đầu — lấy cert từ Let's Encrypt
bash scripts/ssl-init.sh admin@bhquan.site

# Sau đó đổi nginx config:
#   Xóa: nginx/conf.d/bhquan.site.init.conf
#   Giữ: nginx/conf.d/bhquan.site.conf (đã có SSL)
rm nginx/conf.d/bhquan.site.init.conf
docker-compose -f docker-compose.prod.yml restart nginx
```

### 3.5 Verify
```bash
curl https://bhquan.site/api/health
# → {"status":"ok","timestamp":"..."}
```

---

## Bước 4: Cron Jobs (trên server)

Thêm vào crontab server:
```bash
# Mở crontab
crontab -e

# Thêm 3 dòng (thay YOUR_CRON_SECRET):
0 19 * * * curl -sf -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:4000/api/cron/expire-images >> /var/log/cron-photo.log 2>&1
0 20 * * * curl -sf -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:4000/api/cron/reconcile-quota >> /var/log/cron-photo.log 2>&1
0 * * * *  curl -sf -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:4000/api/cron/remind-payments >> /var/log/cron-photo.log 2>&1
```

Hoặc dùng GitHub Actions (đã có `.github/workflows/cron.yml`).

---

## Bước 5: DNS — Cloudflare

Vào Cloudflare Dashboard → DNS cho domain `bhquan.site`:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | @ | `YOUR_SERVER_IP` | Off (DNS only) |
| A | api | `YOUR_SERVER_IP` | Off |
| A | ws | `YOUR_SERVER_IP` | Off |
| CNAME | cdn | `your-r2-bucket.r2.dev` | On (Cloudflare proxy) |

> Dùng DNS only (grey cloud) cho A records để Let's Encrypt hoạt động.
> Sau khi có SSL, có thể bật Proxy (orange cloud) nếu muốn.

---

## Bước 7: Monitoring

### UptimeRobot (free 50 monitors)
```
1. https://uptimerobot.com → Sign up
2. Add Monitor:
   - API Health: GET https://bhquan.site/api/health (every 5 min)
   - Frontend:   GET https://bhquan.site (every 5 min)
3. Alert contacts: email/Telegram
```

### Sentry (error tracking, free tier)
```bash
# Install Sentry SDK (optional)
cd photo-storage/server
npm install @sentry/node

# Thêm vào index.ts (đầu file):
# import * as Sentry from '@sentry/node'
# Sentry.init({ dsn: process.env.SENTRY_DSN })
```

---

## Bước 8: Go Live Checklist

```
□ .env đã điền: JWT_SECRET, R2_*, RESEND_API_KEY, CRON_SECRET
□ Database đã seed (plans + settings + admin)
□ curl https://bhquan.site/api/health → OK
□ https://bhquan.site → frontend hiển thị
□ Đăng ký user mới → nhận welcome email
□ Upload ảnh JPEG → worker xử lý → hiện thumbnail
□ https://bhquan.site/admin → dashboard hoạt động
□ Đổi admin password mặc định (admin123 → mật khẩu mạnh)
□ SSL/HTTPS trên bhquan.site, api.bhquan.site
□ Cron jobs đã cấu hình (crontab hoặc GitHub Actions)
□ UptimeRobot monitoring đã setup
□ bash scripts/backup.sh → backup lần đầu OK
```

---

## Quick Commands Reference

```bash
# === LOCAL DEV (Windows) ===
docker-compose up -d                                # Start MySQL + Redis
cd photo-storage/server && npm run dev              # Start API (:4000)
npx tsx src/workers/start.ts                        # Start Workers
cd photo-storage && npm run dev                     # Start FE (:3000)
# Hoặc: scripts/dev.bat                            # Start tất cả

# === PRODUCTION (Linux server) ===
bash scripts/deploy.sh                              # Deploy toàn bộ
bash scripts/ssl-init.sh admin@bhquan.site          # SSL lần đầu
bash scripts/backup.sh                              # Backup database

# === DOCKER PRODUCTION ===
docker-compose -f docker-compose.prod.yml up -d     # Start all
docker-compose -f docker-compose.prod.yml down      # Stop all
docker-compose -f docker-compose.prod.yml logs -f api     # API logs
docker-compose -f docker-compose.prod.yml logs -f worker  # Worker logs
docker-compose -f docker-compose.prod.yml logs -f nginx   # Nginx logs
docker-compose -f docker-compose.prod.yml restart api     # Restart API

# === DATABASE ===
cd photo-storage/server
npm run db:push                                     # Push schema → MySQL
npm run db:seed                                     # Seed plans + admin

# === BUILD ===
cd photo-storage && npm run build                   # Build FE → dist/
cd photo-storage/server && npm run build            # Build BE → dist/

# === UPDATE DEPLOY ===
git pull                                            # Pull latest code
cd photo-storage && npm run build                   # Rebuild FE
cd ../server && npm run build                       # Rebuild BE
cd ../..
docker-compose -f docker-compose.prod.yml build api worker  # Rebuild images
docker-compose -f docker-compose.prod.yml up -d     # Restart
```
