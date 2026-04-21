# PHOTO STORAGE — DEPLOYMENT GUIDE

> Domain: bhquan.site | VPS: 134.122.21.251 | Stack: Express.js + React + MySQL + Redis + Cloudflare R2

---

## Kiến trúc Production

```
  Browser (https://bhquan.site)
       │
       ▼
  VPS Ubuntu (134.122.21.251)
  ┌──────────────────────────────────────────────┐
  │  shared-nginx (Docker) :80/:443               │
  │  ├─ bhquan.site  → photo-api + static        │
  │  └─ bhquan.store → VietNet (project khác)    │
  │                                               │
  │  WebPhoto (/opt/webphoto)                     │
  │  ├─ photo-api     :4000 (Express.js)          │
  │  └─ photo-worker       (BullMQ jobs)          │
  │                                               │
  │  Shared infra (/opt/infra)                    │
  │  ├─ shared-mysql  :3306 (MySQL 8)             │
  │  │   └─ DB: photo_storage                     │
  │  ├─ shared-redis  :6379 (Redis 7)             │
  │  └─ shared-nginx  (certbot, SSL volume)       │
  │                                               │
  │  Docker Networks                              │
  │  ├─ webphoto_backend  (mysql, redis, api)     │
  │  └─ webphoto_frontend (nginx, photo-api)      │
  └──────────────────────────────────────────────┘
       │
       ▼
  Cloudflare R2 (Object Storage)
  ├─ webphoto        (private: originals/RAW)
  └─ webphoto-public (public: thumbnails/CDN)
```

---

## GitHub Actions Secrets

Secrets được lưu trong **repo settings** — không commit lên git.

| Secret | Mô tả |
|--------|-------|
| `VPS_HOST` | IP VPS: `134.122.21.251` |
| `VPS_PORT` | SSH port: `22` |
| `VPS_USER` | SSH user: `root` |
| `VPS_PASSWORD` | Mật khẩu SSH VPS |
| `VPS_DEPLOY_PATH` | Path deploy trên VPS: `/opt/webphoto` |
| `MYSQL_ROOT_PASSWORD` | Root password shared-mysql |
| `MYSQL_PASSWORD` | Password user `photo_storage` trong MySQL |
| `JWT_SECRET` | JWT signing secret |
| `R2_ENDPOINT` | Cloudflare R2 endpoint URL |
| `R2_ACCESS_KEY` | R2 access key ID |
| `R2_SECRET_KEY` | R2 secret access key |
| `RESEND_API_KEY` | Resend email API key |
| `CRON_SECRET` | Secret header cho cron endpoints |
| `BACKUP_ENCRYPT_KEY` | GPG passphrase để encrypt backup |

### Thêm/cập nhật secret nhanh qua CLI

```bash
# Không cần vào GitHub UI — dùng gh CLI
gh secret set VPS_PASSWORD --body "mat_khau_moi" --repo BHQUAN97/WebPhoto

# Thêm từ biến môi trường
gh secret set R2_SECRET_KEY --body "$R2_KEY" --repo BHQUAN97/WebPhoto

# Xem danh sách secrets (chỉ thấy tên, không thấy giá trị)
gh secret list --repo BHQUAN97/WebPhoto
```

---

## Deploy

### Tự động (Khuyên dùng)

Push lên nhánh `main` → GitHub Actions tự động chạy:
1. Upload source lên VPS qua SCP/tar
2. Build Docker images trên VPS
3. Start containers
4. Health check

### Backup tự động

- Chạy hàng ngày lúc **4:00 AM UTC+7** (cron `0 21 * * *`)
- Backup DB (photo_storage + vietnet) + uploads → encrypt AES-256 → push lên branch `backups`
- Giữ 7 ngày, xoá backup cũ tự động

### Restore từ backup

Chạy workflow `restore.yml` thủ công từ GitHub Actions tab.

---

## Quản lý trên VPS

```bash
ssh root@134.122.21.251
cd /opt/webphoto

# Xem logs
docker logs photo-api --tail 50 -f
docker logs photo-worker --tail 50 -f

# Restart
docker compose -f docker-compose.prod.yml restart api worker

# Nginx config
cat /opt/webphoto/nginx/conf.d/bhquan.site.conf
docker exec shared-nginx nginx -t && docker exec shared-nginx nginx -s reload

# Xem disk usage
docker system df
du -sh /opt/webphoto/
```

---

## Troubleshooting

```bash
# API không start — xem logs
docker logs photo-api --tail 30

# 502 Bad Gateway — kiểm tra network
docker inspect shared-nginx --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# Phải có: webphoto_frontend
# Nếu thiếu:
docker network connect webphoto_frontend shared-nginx
docker exec shared-nginx nginx -s reload

# SSL cert hết hạn
# Chạy workflow ssl-renew.yml từ GitHub Actions tab
```
