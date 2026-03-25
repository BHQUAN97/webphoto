# PHOTO STORAGE — DEPLOYMENT GUIDE

> Domain: bhquan.site | VPS: 213.163.199.176 | Cập nhật: 2026-03-25

---

## Tổng quan kiến trúc Production

```
  Browser (https://bhquan.site)
       │
       ▼
  Cloudflare DNS (DNS only / grey cloud)
       │
       ▼
  VPS Ubuntu (213.163.199.176)
  ┌──────────────────────────────────────────────┐
  │  Nginx (BT Panel — host)                    │
  │  ├─ :80  → redirect HTTPS                   │
  │  ├─ :443 → SSL (Let's Encrypt)              │
  │  │   ├─ /              → SPA static files    │
  │  │   ├─ /api/*         → proxy :4000 (API)   │
  │  │   ├─ /socket.io/*   → proxy :4001 (WS)    │
  │  │   └─ /storage/public → proxy :4000        │
  │  │                                           │
  │  │  client_max_body_size 500m                │
  │  │                                           │
  │  └─ Frontend dist: /opt/webphoto/photo-      │
  │     storage/dist/                            │
  │                                              │
  │  Docker Containers                           │
  │  ┌─────────────────────────────────────┐     │
  │  │ photo-api    :4000 (Express.js 5)   │     │
  │  │ photo-worker       (BullMQ jobs)    │     │
  │  │ photo-mysql  :3306 (MySQL 8)        │     │
  │  │ photo-redis  :6379 (Redis 7)        │     │
  │  └─────────────────────────────────────┘     │
  └──────────────────────────────────────────────┘
       │
       ▼
  Cloudflare R2 (Object Storage)
  ├─ webphoto        (private: originals/RAW)
  └─ webphoto-public (public: thumbnails/previews/avatars)
      CDN: https://pub-5bee544ff1d1411bb92b8acd71487437.r2.dev
```

### Đặc điểm kiến trúc

- **Nginx chạy trên host** (BT Panel) — không Docker, tương thích aaPanel
- **Frontend** serve bằng Nginx static (`/opt/webphoto/photo-storage/dist/`)
- **API + Worker** chạy trong Docker, expose port `4000`, `4001` ra host
- **SSL** bằng certbot trên host (auto-renew via systemd timer)
- **Upload bảo mật**: Tất cả upload (ảnh, avatar, QR) đều qua server → R2. Client không bao giờ gọi trực tiếp R2 (không dùng presigned URL)

### Upload Flow

```
Browser ──POST /api/storage/upload-chunk──→ API Server ──→ R2 Private Bucket
Browser ──POST /api/users/me/avatar (base64)──→ API Server ──→ R2 Public Bucket
Browser ──POST /api/admin/.../upload-qr (base64)──→ API Server ──→ R2 Public Bucket
```

---

## Deploy nhanh 1 lệnh (VPS mới)

### Yêu cầu

- VPS: Ubuntu 22.04 / 24.04
- Docker + Docker Compose đã cài
- Nginx đã cài (hoặc BT Panel / aaPanel)
- SSH key đã cấu hình từ máy local

### Bước 1: Cấu hình `.env`

```bash
cp .env.example .env
# Sửa các giá trị:
#   MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD
#   JWT_SECRET          (openssl rand -hex 32)
#   R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY
#   RESEND_API_KEY
#   CRON_SECRET         (openssl rand -hex 16)
```

### Bước 2: Trỏ DNS

Vào Cloudflare Dashboard → DNS:

| Type | Name | Value        | Proxy    |
|------|------|--------------|----------|
| A    | @    | `<VPS_IP>`   | DNS only |
| A    | www  | `<VPS_IP>`   | DNS only |

### Bước 3: Deploy lần đầu

```bash
bash scripts/quick-deploy.sh <VPS_IP> <DOMAIN>

# Ví dụ:
bash scripts/quick-deploy.sh 213.163.199.176 bhquan.site
```

Script tự động thực hiện 8 bước:

| Step | Mô tả |
|------|--------|
| 0/8  | Kiểm tra SSH, .env, Docker trên VPS |
| 1/8  | Build frontend (Vite) + backend (tsc) trên máy local |
| 2/8  | Chuẩn bị VPS (thư mục, firewall, certbot) |
| 3/8  | Upload files lên VPS via SCP |
| 4/8  | Tạo docker-compose.yml tối ưu cho VPS |
| 5/8  | Build Docker images + Start MySQL, Redis, API, Worker |
| 6/8  | Push DB schema (drizzle-kit) + seed data (plans, admin user) |
| 7/8  | Cấu hình Nginx (auto-detect BT Panel/system) + SSL (Let's Encrypt) |
| 8/8  | Setup cron jobs + health check |

### Bước 4: Cập nhật code (các lần sau)

```bash
bash scripts/update-deploy.sh <VPS_IP>

# Ví dụ:
bash scripts/update-deploy.sh 213.163.199.176
```

Script thực hiện 5 bước:

| Step | Mô tả |
|------|--------|
| 1/5  | Build frontend + backend trên máy local |
| 2/5  | Upload dist files lên VPS via SCP |
| 3/5  | Update Nginx config (BT Panel path) + reload |
| 4/5  | Rebuild Docker images + restart API, Worker |
| 5/5  | Health check (API + container status) |

---

## Deploy thủ công (từng bước)

### 1. Setup dịch vụ bên ngoài

#### Cloudflare R2 (free: 10GB storage, 1M requests/tháng)

```
1. https://dash.cloudflare.com → R2
2. Create bucket: "webphoto" (private — originals/RAW)
3. Create bucket: "webphoto-public" (public — thumbnails/previews/avatars)
   → Settings → Public Access → Enable
4. R2 → Manage R2 API Tokens → Create API Token
   → Permissions: Object Read & Write → cả 2 buckets
5. Copy: R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY → .env
```

#### Resend (free: 100 emails/ngày)

```
1. https://resend.com → Sign up
2. Domains → Add domain → Verify DNS records
3. API Keys → Create API Key
4. Copy: RESEND_API_KEY → .env
```

### 2. Build trên máy local

```bash
# Backend
cd photo-storage/server
npm run build               # → dist/

# Frontend
cd photo-storage
npm run build               # → dist/
```

### 3. Upload lên VPS

```bash
# Tạo thư mục
ssh root@<VPS_IP> "mkdir -p /opt/webphoto/photo-storage/server"

# Upload
scp .env docker-compose.prod.yml root@<VPS_IP>:/opt/webphoto/
scp -r photo-storage/dist root@<VPS_IP>:/opt/webphoto/photo-storage/
scp photo-storage/server/{Dockerfile,Dockerfile.worker,package.json,package-lock.json} root@<VPS_IP>:/opt/webphoto/photo-storage/server/
scp -r photo-storage/server/dist root@<VPS_IP>:/opt/webphoto/photo-storage/server/
scp -r photo-storage/server/src root@<VPS_IP>:/opt/webphoto/photo-storage/server/
scp photo-storage/server/{drizzle.config.ts,tsconfig.json} root@<VPS_IP>:/opt/webphoto/photo-storage/server/
```

### 4. Docker Compose trên VPS

```bash
ssh root@<VPS_IP>
cd /opt/webphoto

# Build images
docker compose build

# Start tất cả
docker compose up -d

# Đợi MySQL ready
docker exec photo-mysql mysqladmin ping -h localhost --silent

# Fix MySQL auth (nếu cần — caching_sha2_password → mysql_native_password)
docker exec photo-api node -e "
  import mysql from 'mysql2/promise';
  const conn = await mysql.createConnection({host:'mysql',port:3306,user:'root',password:'<MYSQL_ROOT_PASS>'});
  await conn.query(\"ALTER USER 'photo_user'@'%' IDENTIFIED WITH mysql_native_password BY '<MYSQL_USER_PASS>'\");
  await conn.query('FLUSH PRIVILEGES');
  await conn.end();
"

# Write .env for drizzle (tránh lỗi shell escaping ký tự !)
docker exec -w /app photo-api sh -c 'echo "DATABASE_URL=mysql://root:<MYSQL_ROOT_PASS>@mysql:3306/photo_storage" > .env'

# Push schema + seed
docker exec -w /app photo-api npm install --include=dev
docker cp /opt/webphoto/photo-storage/server/src photo-api:/app/src
docker cp /opt/webphoto/photo-storage/server/drizzle.config.ts photo-api:/app/drizzle.config.ts
docker cp /opt/webphoto/photo-storage/server/tsconfig.json photo-api:/app/tsconfig.json
docker exec -w /app photo-api npx drizzle-kit push --force
docker exec -w /app photo-api npx tsx src/database/seed.ts

# Restart
docker compose restart api worker
```

### 5. Nginx + SSL

#### Đường dẫn config theo loại Nginx

| Loại | Config path | Reload command |
|------|-------------|----------------|
| **BT Panel / aaPanel** | `/www/server/panel/vhost/nginx/<domain>.conf` | `nginx -s reload` |
| **System Nginx** | `/etc/nginx/sites-enabled/<domain>.conf` | `nginx -s reload` |
| **conf.d** | `/etc/nginx/conf.d/<domain>.conf` | `nginx -s reload` |

#### Nội dung Nginx config

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name <DOMAIN> www.<DOMAIN>;

    location /.well-known/acme-challenge/ {
        root /opt/webphoto/photo-storage/dist;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name <DOMAIN> www.<DOMAIN>;

    ssl_certificate /etc/letsencrypt/live/<DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<DOMAIN>/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /opt/webphoto/photo-storage/dist;
    index index.html;

    # API proxy — tất cả upload đều qua đây
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        client_max_body_size 500m;  # Quan trọng: cho phép upload chunk lớn
    }

    # Socket.io proxy (WebSocket)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    # Local storage public files (khi dùng local storage thay R2)
    location /storage/public/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets (Vite hashed filenames)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
```

#### SSL Certificate

```bash
# Lấy cert (DNS phải đã trỏ về VPS)
certbot certonly --webroot -w /opt/webphoto/photo-storage/dist \
  -d <DOMAIN> -d www.<DOMAIN> \
  --non-interactive --agree-tos --email admin@<DOMAIN>

# Auto-renew (certbot tự setup systemd timer)
certbot renew --dry-run   # Test
```

### 6. Cron Jobs

```bash
crontab -e
# Thêm:
0 2 * * * curl -sf -H "x-cron-secret: <CRON_SECRET>" http://localhost:4000/api/cron/expire-images >> /var/log/cron-photo.log 2>&1
0 3 * * * curl -sf -H "x-cron-secret: <CRON_SECRET>" http://localhost:4000/api/cron/reconcile-quota >> /var/log/cron-photo.log 2>&1
0 * * * * curl -sf -H "x-cron-secret: <CRON_SECRET>" http://localhost:4000/api/cron/remind-payments >> /var/log/cron-photo.log 2>&1
0 1 * * 0 cd /opt/webphoto && bash scripts/backup.sh >> /var/log/cron-photo.log 2>&1
```

---

## Quản lý Production

```bash
# === KẾT NỐI VPS ===
ssh root@213.163.199.176
cd /opt/webphoto

# === TRẠNG THÁI ===
docker compose ps                           # Xem containers
docker compose logs -f api                  # Logs API (realtime)
docker compose logs -f worker               # Logs Worker
docker exec photo-api cat /app/logs/*.log   # File logs (structured JSON)

# === RESTART ===
docker compose restart api worker           # Restart API + Worker
docker compose restart                      # Restart tất cả
docker compose down && docker compose up -d # Recreate tất cả

# === DATABASE ===
# Backup
docker exec photo-mysql mysqldump -u root -p"<ROOT_PASS>" photo_storage \
  --single-transaction | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip < backup.sql.gz | docker exec -i photo-mysql mysql -u root -p"<ROOT_PASS>" photo_storage

# === CẬP NHẬT CODE (từ máy local) ===
bash scripts/update-deploy.sh 213.163.199.176

# === DEPLOY VPS MỚI (từ máy local) ===
bash scripts/quick-deploy.sh <VPS_IP> <DOMAIN>
```

---

## Biến môi trường (.env)

| Biến | Mô tả | Ví dụ |
|------|--------|-------|
| `MYSQL_ROOT_PASSWORD` | Root password MySQL | `StrongRootPass2024!` |
| `MYSQL_PASSWORD` | App user password MySQL | `StrongUserPass2024!` |
| `JWT_SECRET` | Secret cho JWT token (32 bytes hex) | `openssl rand -hex 32` |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint | `https://xxx.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY` | R2 API token access key | |
| `R2_SECRET_KEY` | R2 API token secret key | |
| `R2_PRIVATE_BUCKET` | Bucket chứa file gốc (private) | `webphoto` |
| `R2_PUBLIC_BUCKET` | Bucket chứa thumb/preview (public) | `webphoto-public` |
| `CDN_URL` | R2 public bucket CDN URL | `https://pub-xxx.r2.dev` |
| `RESEND_API_KEY` | API key gửi email (Resend) | `re_xxx` |
| `FROM_EMAIL` | Email gửi đi | `noreply@bhquan.site` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `https://bhquan.site` |
| `CRON_SECRET` | Secret header cho cron endpoints | `openssl rand -hex 16` |
| `DOMAIN` | Domain chính | `bhquan.site` |

---

## Troubleshooting

### API không start

```bash
docker compose logs api --tail 50          # Xem lỗi gần nhất
docker exec photo-api cat /app/logs/*.log | tail -20  # File log chi tiết
```

### MySQL access denied

```bash
# Fix auth plugin: caching_sha2_password → mysql_native_password
docker exec photo-api node -e "
  import mysql from 'mysql2/promise';
  const conn = await mysql.createConnection({host:'mysql',port:3306,user:'root',password:'<ROOT_PASS>'});
  await conn.query(\"ALTER USER 'photo_user'@'%' IDENTIFIED WITH mysql_native_password BY '<USER_PASS>'\");
  await conn.query('FLUSH PRIVILEGES');
  await conn.end();
"
```

### BullMQ spam "Eviction policy" warning

Redis đang dùng `allkeys-lru`, BullMQ yêu cầu `noeviction`:

```yaml
# docker-compose.yml → redis service
command: redis-server --maxmemory 128mb --maxmemory-policy noeviction --appendonly yes
```

### drizzle-kit push lỗi shell escaping (ký tự `!` trong password)

Ghi DATABASE_URL vào file .env thay vì truyền qua command line:

```bash
docker exec -w /app photo-api sh -c 'echo "DATABASE_URL=mysql://root:PASS@mysql:3306/photo_storage" > .env'
docker exec -w /app photo-api npx drizzle-kit push --force
```

### Upload lỗi 413 Request Entity Too Large

Nginx `client_max_body_size` quá nhỏ. Kiểm tra:

```bash
# BT Panel
grep client_max_body_size /www/server/panel/vhost/nginx/bhquan.site.conf
# Cần >= 12m (chunk 10MB + overhead), hiện set 500m
```

### Frontend trắng

Nginx thiếu SPA fallback. Cần `try_files $uri $uri/ /index.html;` trong location `/`

### SSL cert lỗi

DNS chưa trỏ. Kiểm tra:

```bash
dig +short <DOMAIN>  # Phải trả về VPS IP
```

---

## Bảo mật

### Upload Security

- **Không dùng presigned URL**: Tất cả upload (ảnh, avatar, QR) đều proxy qua API server. R2 credentials chỉ nằm trên server, client không bao giờ thấy R2 endpoint
- **Validate client-side**: File size (200MB), extension, empty file — hiển thị toast thay vì alert
- **Validate server-side**: File size, MIME type whitelist, extension whitelist, quota check
- **Chunk upload**: 10MB/chunk qua `/api/storage/upload-chunk`, Nginx cho phép `client_max_body_size 500m`

### Auth Security

- JWT access token: 15 phút, HttpOnly + SameSite=Strict cookie
- Refresh token: 7 ngày
- CORS: chỉ cho phép `https://bhquan.site`
- Rate limiting: Redis-based per endpoint
- Password: bcrypt hash, validate strength

### Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## Go Live Checklist

```
□ .env đã điền: JWT_SECRET, R2_*, RESEND_API_KEY, CRON_SECRET
□ DNS trỏ về VPS IP (DNS only / grey cloud)
□ Database đã seed (plans + settings + admin user)
□ curl https://<DOMAIN>/api/health → {"status":"ok"}
□ https://<DOMAIN> → frontend hiển thị đúng
□ Đăng ký user mới → nhận welcome email
□ Upload ảnh JPEG → worker xử lý → hiện thumbnail
□ Upload ảnh RAW (CR2/ARW) → worker xử lý → hiện thumbnail
□ https://<DOMAIN>/admin → dashboard hoạt động
□ Đổi admin password mặc định (admin@photostorage.com / admin123)
□ SSL/HTTPS hoạt động (certbot)
□ Cron jobs đã cấu hình (crontab -l)
□ Backup database lần đầu OK
□ Nginx client_max_body_size >= 12m
```

---

## Scripts Reference

| Script | Chạy từ | Mô tả |
|--------|---------|-------|
| `scripts/quick-deploy.sh <ip> [domain]` | Local | Deploy VPS mới từ đầu (8 bước) |
| `scripts/update-deploy.sh <ip>` | Local | Cập nhật code lên VPS đã deploy (5 bước) |
| `scripts/deploy.sh` | VPS | Deploy trên VPS (dùng Docker Compose gốc) |
| `scripts/backup.sh` | VPS | Backup database MySQL |
| `scripts/dev.sh` / `dev.bat` | Local | Start dev environment |

---

## Thông tin VPS hiện tại

| Mục | Giá trị |
|-----|---------|
| **IP** | 213.163.199.176 |
| **OS** | Ubuntu |
| **Panel** | BT Panel (aaPanel) |
| **Nginx config** | `/www/server/panel/vhost/nginx/bhquan.site.conf` |
| **Nginx binary** | `/www/server/nginx/sbin/nginx` (hoặc `/usr/bin/nginx`) |
| **App directory** | `/opt/webphoto` |
| **Frontend dist** | `/opt/webphoto/photo-storage/dist` |
| **SSL certs** | `/etc/letsencrypt/live/bhquan.site/` |
| **Docker containers** | photo-api, photo-worker, photo-mysql, photo-redis |
| **Ports** | 4000 (API), 4001 (Socket.io), 3306 (MySQL), 6379 (Redis) |
| **Default admin** | admin@photostorage.com / admin123 |
