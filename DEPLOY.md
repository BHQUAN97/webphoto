# PHOTO STORAGE — DEPLOYMENT GUIDE

> Domain: bhquan.site | Cập nhật: 2026-03-25

## Tổng quan kiến trúc Production (VPS Direct)

```
  User Browser
       │
       ▼
  Cloudflare DNS (DNS only / grey cloud)
       │
       ▼
  VPS Ubuntu (213.163.199.176)
  ┌──────────────────────────────────────────────┐
  │  Nginx (host)                                │
  │  ├─ :80  → redirect HTTPS                   │
  │  ├─ :443 → SSL (Let's Encrypt)              │
  │  │   ├─ /          → Frontend static files   │
  │  │   ├─ /api/*     → proxy :4000 (API)       │
  │  │   └─ /socket.io → proxy :4001 (WS)        │
  │  │                                           │
  │  └─ Frontend dist: /opt/webphoto/photo-      │
  │     storage/dist/                            │
  │                                              │
  │  Docker Containers                           │
  │  ┌─────────────────────────────────────┐     │
  │  │ photo-api    :4000 (Express.js)     │     │
  │  │ photo-worker       (BullMQ jobs)    │     │
  │  │ photo-mysql  :3306 (MySQL 8)        │     │
  │  │ photo-redis  :6379 (Redis 7)        │     │
  │  └─────────────────────────────────────┘     │
  └──────────────────────────────────────────────┘
       │
       ▼
  Cloudflare R2 (Object Storage)
  ├─ webphoto        (private: originals/RAW)
  └─ webphoto-public (public: thumbnails/previews)
      CDN: https://pub-xxx.r2.dev
```

**Điểm khác so với docker-compose.prod.yml gốc:**
- Nginx chạy trên **host** (không Docker) → tương thích BT Panel / aaPanel
- Frontend serve bằng Nginx static, không qua Docker
- API + Worker expose port ra host (4000, 4001)
- SSL bằng certbot trên host, không dùng certbot container

---

## Deploy nhanh 1 lệnh (VPS mới)

### Yêu cầu VPS
- Ubuntu 22.04 / 24.04
- Docker + Docker Compose đã cài
- Nginx đã cài (hoặc BT Panel)
- SSH key đã cấu hình từ máy local

### Bước 1: Cấu hình `.env`
```bash
cp .env.example .env
# Sửa các giá trị:
#   MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD
#   JWT_SECRET (openssl rand -hex 32)
#   R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY
#   RESEND_API_KEY
#   CRON_SECRET (openssl rand -hex 16)
```

### Bước 2: Trỏ DNS
Vào Cloudflare Dashboard → DNS:
| Type  | Name | Value              | Proxy     |
|-------|------|--------------------|-----------|
| A     | @    | `<VPS_IP>`         | DNS only  |
| A     | www  | `<VPS_IP>`         | DNS only  |

### Bước 3: Deploy
```bash
# Deploy lần đầu (từ máy local Windows/Mac/Linux):
bash scripts/quick-deploy.sh <VPS_IP> <DOMAIN>

# Ví dụ:
bash scripts/quick-deploy.sh 213.163.199.176 bhquan.site
bash scripts/quick-deploy.sh 45.67.89.10 photos.example.com
```

Script tự động thực hiện:
1. Build frontend + backend trên máy local
2. Upload files lên VPS via SCP
3. Tạo docker-compose.yml tối ưu cho VPS
4. Build Docker images (API + Worker)
5. Start MySQL, Redis, API, Worker
6. Push DB schema + seed data
7. Cấu hình Nginx + SSL (Let's Encrypt)
8. Setup cron jobs + health check

### Bước 4: Cập nhật code
```bash
# Khi code thay đổi, chỉ cần:
bash scripts/update-deploy.sh <VPS_IP>

# Ví dụ:
bash scripts/update-deploy.sh 213.163.199.176
```

---

## Deploy thủ công (từng bước)

### 1. Setup dịch vụ bên ngoài

#### Cloudflare R2 (free: 10GB storage, 1M requests/tháng)
```
1. https://dash.cloudflare.com → R2
2. Create bucket: "webphoto" (private - originals/RAW)
3. Create bucket: "webphoto-public" (public - thumbnails)
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

# Push schema + seed (chạy trong container)
docker exec -w /app photo-api npm install --include=dev
docker cp /opt/webphoto/photo-storage/server/src photo-api:/app/src
docker cp /opt/webphoto/photo-storage/server/drizzle.config.ts photo-api:/app/drizzle.config.ts
docker cp /opt/webphoto/photo-storage/server/tsconfig.json photo-api:/app/tsconfig.json

# Fix MySQL auth (nếu cần)
docker exec photo-api node -e "
  import mysql from 'mysql2/promise';
  const conn = await mysql.createConnection({host:'mysql',port:3306,user:'root',password:'<MYSQL_ROOT_PASS>'});
  await conn.query(\"ALTER USER 'photo_user'@'%' IDENTIFIED WITH mysql_native_password BY '<MYSQL_USER_PASS>'\");
  await conn.query('FLUSH PRIVILEGES');
  await conn.end();
"

# Write .env for drizzle (tránh lỗi shell escaping ký tự !)
docker exec -w /app photo-api sh -c 'echo "DATABASE_URL=mysql://root:<MYSQL_ROOT_PASS>@mysql:3306/photo_storage" > .env'
docker exec -w /app photo-api npx drizzle-kit push --force
docker exec -w /app photo-api npx tsx src/database/seed.ts

# Restart để apply
docker compose restart api worker
```

### 5. Nginx + SSL

#### BT Panel (aaPanel)
```bash
# Config path: /www/server/panel/vhost/nginx/<domain>.conf
# Nginx binary: /www/server/nginx/sbin/nginx
# Reload: /www/server/nginx/sbin/nginx -s reload
```

#### System Nginx
```bash
# Config path: /etc/nginx/sites-enabled/<domain>.conf
# Reload: nginx -s reload
```

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

    root /opt/webphoto/photo-storage/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        client_max_body_size 500m;
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

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
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
# Lấy cert (cần DNS đã trỏ về VPS)
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
```

---

## Troubleshooting

### API không start — xem file log (production logger không ghi console)
```bash
docker exec photo-api cat /app/logs/*.log | tail -20
```

### MySQL access denied — fix auth plugin
```bash
docker exec photo-api node -e "
  import mysql from 'mysql2/promise';
  const conn = await mysql.createConnection({host:'mysql',port:3306,user:'root',password:'<ROOT_PASS>'});
  await conn.query(\"ALTER USER 'photo_user'@'%' IDENTIFIED WITH mysql_native_password BY '<USER_PASS>'\");
  await conn.query('FLUSH PRIVILEGES');
  await conn.end();
"
```

### BullMQ spam "Eviction policy" warning
Redis đang dùng `allkeys-lru`, BullMQ yêu cầu `noeviction`. Sửa trong docker-compose:
```yaml
command: redis-server --maxmemory 128mb --maxmemory-policy noeviction --appendonly yes
```

### drizzle-kit push lỗi shell escaping (ký tự `!` trong password)
Ghi DATABASE_URL vào file .env thay vì truyền qua command line:
```bash
docker exec -w /app photo-api sh -c 'echo "DATABASE_URL=mysql://root:PASS@mysql:3306/photo_storage" > .env'
docker exec -w /app photo-api npx drizzle-kit push --force
```

### Frontend trắng — kiểm tra SPA fallback
Nginx phải có `try_files $uri $uri/ /index.html;` trong location `/`

### SSL cert lỗi — DNS chưa trỏ
Certbot cần DNS A record trỏ về VPS IP. Kiểm tra:
```bash
dig +short <DOMAIN>  # Phải trả về VPS IP
```

---

## Quản lý Production

```bash
# === TRẠNG THÁI ===
cd /opt/webphoto
docker compose ps                           # Xem containers
docker compose logs -f api                  # Logs API (realtime)
docker compose logs -f worker               # Logs Worker
docker exec photo-api cat /app/logs/*.log   # File logs (đầy đủ hơn)

# === RESTART ===
docker compose restart api worker           # Restart API + Worker
docker compose restart                      # Restart tất cả
docker compose down && docker compose up -d # Recreate tất cả

# === DATABASE ===
# Backup
docker exec photo-mysql mysqldump -u root -p"<ROOT_PASS>" photo_storage --single-transaction | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip < backup.sql.gz | docker exec -i photo-mysql mysql -u root -p"<ROOT_PASS>" photo_storage

# === CẬP NHẬT CODE (từ máy local) ===
bash scripts/update-deploy.sh <VPS_IP>

# === DEPLOY VPS MỚI (từ máy local) ===
bash scripts/quick-deploy.sh <VPS_IP> <DOMAIN>
```

---

## Go Live Checklist

```
□ .env đã điền: JWT_SECRET, R2_*, RESEND_API_KEY, CRON_SECRET
□ DNS trỏ về VPS IP (DNS only / grey cloud)
□ Database đã seed (plans + settings + admin user)
□ curl https://<DOMAIN>/api/health → {"status":"ok"}
□ https://<DOMAIN> → frontend hiển thị
□ Đăng ký user mới → nhận welcome email
□ Upload ảnh JPEG → worker xử lý → hiện thumbnail
□ https://<DOMAIN>/admin → dashboard hoạt động
□ Đổi admin password mặc định (admin@photostorage.com / admin123)
□ SSL/HTTPS hoạt động
□ Cron jobs đã cấu hình
□ Backup database lần đầu OK
```

---

## Scripts Reference

| Script | Chạy từ | Mô tả |
|--------|---------|-------|
| `scripts/quick-deploy.sh <ip> [domain]` | Local | Deploy VPS mới từ đầu |
| `scripts/update-deploy.sh <ip>` | Local | Cập nhật code lên VPS đã deploy |
| `scripts/deploy.sh` | VPS | Deploy trên VPS (dùng Docker Compose gốc) |
| `scripts/vps-setup.sh` | VPS | Setup VPS Ubuntu từ đầu |
| `scripts/backup.sh` | VPS | Backup database |
| `scripts/ssl-init.sh` | VPS | Lấy SSL cert lần đầu (Docker mode) |
| `scripts/build.sh` | Local | Build FE + BE |
| `scripts/dev.sh` / `dev.bat` | Local | Start dev environment |
