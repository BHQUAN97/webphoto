# PhotoStorage — Hệ thống lưu trữ ảnh chuyên nghiệp

> Nền tảng lưu trữ và chia sẻ ảnh RAW dành cho thợ chụp ảnh chuyên nghiệp.

## Tính năng chính

- Upload ảnh RAW dung lượng lớn (CR2/ARW/NEF/DNG, 20-80MB/file)
- Xử lý tự động: RAW → WebP thumbnail (400px) + preview (1920px)
- 3 gói dịch vụ: Free / Cơ bản (49k/tháng) / Pro (499k/năm)
- Quản lý album, like, comment, bộ lọc ảnh
- Thanh toán thủ công (chuyển khoản → admin duyệt)
- Admin dashboard với biểu đồ real-time
- Thông báo real-time qua Socket.io
- Email tự động (welcome, đơn hàng, nhắc nhở)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Tailwind CSS + vue-chartjs |
| Backend | Express.js 5 + TypeScript |
| Database | MySQL 8 (Drizzle ORM) |
| Cache/Queue | Redis 7 + BullMQ |
| Storage | Cloudflare R2 (S3 compatible) |
| Image Processing | dcraw + Sharp.js |
| Real-time | Socket.io + Redis pub/sub |
| Email | Resend |
| Deploy | Docker + Nginx + Let's Encrypt |

## Cấu trúc project

```
WebPhoto/
├── photo-storage/
│   ├── src/                    # Frontend Vue 3
│   │   ├── pages/              #   22 pages
│   │   ├── components/         #   21 components
│   │   ├── stores/             #   4 Pinia stores
│   │   ├── composables/        #   Reusable logic
│   │   └── utils/              #   API, format, debounce
│   │
│   └── server/                 # Backend Express
│       └── src/
│           ├── database/       #   Schema (14 tables) + seed
│           ├── middleware/      #   Auth, admin guard, rate limit
│           ├── routes/         #   44 API endpoints
│           ├── utils/          #   DB, Redis, R2, JWT, mail, etc.
│           ├── workers/        #   Image processing, expiry, email
│           └── plugins/        #   Socket.io, BullMQ
│
├── nginx/                      # Reverse proxy + SSL
├── scripts/                    # Deploy, setup, backup, dev
├── .github/workflows/          # CI/CD + cron
├── docker-compose.yml          # Local dev
├── docker-compose.prod.yml     # Production
├── SETUP.md                    # Hướng dẫn cài đặt
├── API.md                      # Tài liệu API
├── ARCHITECTURE.md             # Kiến trúc hệ thống
├── DEPLOY.md                   # Hướng dẫn deploy
└── CHECKLIST.md                # Tiến độ triển khai
```

## Quick Start

```bash
# 1. Start MySQL + Redis
docker-compose up -d

# 2. Setup backend
cd photo-storage/server
cp .env.example .env          # Sửa config
npm ci
npm run db:push               # Push schema
npm run db:seed               # Seed data

# 3. Start
npm run dev                   # API :4000

# 4. Start frontend (terminal khác)
cd photo-storage
npm run dev                   # FE :3000
```

Mở http://localhost:3000 — Login admin: `admin@photostorage.com` / `admin123`

## Documentation

| File | Nội dung |
|------|----------|
| [SETUP.md](SETUP.md) | Hướng dẫn cài đặt chi tiết |
| [API.md](API.md) | Tài liệu API đầy đủ (44 endpoints) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Kiến trúc hệ thống |
| [DEPLOY.md](DEPLOY.md) | Hướng dẫn deploy production |
| [CHECKLIST.md](CHECKLIST.md) | Tiến độ triển khai |

## Domain

- Frontend: https://bhquan.site
- API: https://bhquan.site/api
- CDN: https://pub-5bee544ff1d1411bb92b8acd71487437.r2.dev
# webphoto
