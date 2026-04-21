# PHOTO STORAGE — DEPLOYMENT GUIDE

> Domain: bhquan.site | VPS: <your-vps-ip> | Cập nhật: 2026-03-25

---

## Tổng quan kiến trúc Production

> **Lưu ý quan trọng**: Dự án này hỗ trợ deploy qua **GitHub Actions** sử dụng **User/Password**. Không bắt buộc phải cấu hình SSH Key trên VPS nếu bạn sử dụng quy trình CI/CD.

```
  Browser (https://bhquan.site)
       │
       ▼
  Cloudflare DNS (DNS only / grey cloud)
       │
       ▼
  VPS Ubuntu (<your-vps-ip>)
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
  │  │ shared-mysql  :3306 (MySQL 8)        │     │
  │  │ shared-redis  :6379 (Redis 7)        │     │
  │  └─────────────────────────────────────┘     │
  └──────────────────────────────────────────────┘
       │
       ▼
  Cloudflare R2 (Object Storage)
  ├─ webphoto        (private: originals/RAW)
  └─ webphoto-public (public: thumbnails/previews/avatars)
      CDN: ${CDN_URL}
```

### Đặc điểm kiến trúc

- **Nginx chạy trên host** (BT Panel) — không Docker, tương thích aaPanel
- **Frontend** serve bằng Nginx static (`/opt/webphoto/photo-storage/dist/`)
- **API + Worker** chạy trong Docker, expose port `4000`, `4001` ra host
- **SSL** bằng certbot trên host (auto-renew via systemd timer)
- **Upload bảo mật**: Tất cả upload (ảnh, avatar, QR) đều qua server → R2. Client không bao giờ gọi trực tiếp R2 (không dùng presigned URL)

---

## Deploy tự động (Khuyên dùng)

### Yêu cầu

- VPS: Ubuntu 22.04 / 24.04
- Docker + Docker Compose đã cài
- Nginx đã cài (hoặc BT Panel / aaPanel)
- **User & Password SSH** của VPS (để cấu hình GitHub Secrets)

### Bước 1: Cấu hình GitHub Secrets

Để deploy tự động, hãy vào Repo GitHub > Settings > Secrets > Actions và thêm:
- `HOST`: IP của VPS
- `USERNAME`: root (hoặc user có quyền sudo)
- `PASSWORD`: Mật khẩu SSH của VPS
- `ENV_FILE`: Nội dung file `.env` thực tế

### Bước 2: Deploy

Chỉ cần **Push code** lên nhánh `main` hoặc `master`. GitHub Actions sẽ tự động:
1. Build Frontend & Backend trên GitHub Runner.
2. Đẩy file lên VPS qua SCP (sử dụng Password).
3. Khởi động Docker containers trên VPS.

---

## Deploy thủ công từ máy Local (Dùng Password)

Nếu bạn muốn chạy script từ máy local mà không dùng SSH Key, bạn cần cài đặt `sshpass`:
- Ubuntu/Debian: `sudo apt install sshpass`
- Mac: `brew install sshpass`
- Windows: Dùng WSL hoặc Git Bash.

```bash
# Cấu hình password tạm thời
export SSHPASS="mat_khau_vps"

# Chạy script deploy (Script sẽ tự dùng sshpass nếu có biến SSHPASS)
bash scripts/quick-deploy.sh <VPS_IP> <DOMAIN>
```

### Cập nhật code (các lần sau)

```bash
export SSHPASS="mat_khau_vps"
bash scripts/update-deploy.sh <VPS_IP>
```
