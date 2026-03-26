# PhotoStorage — Professional Photo Storage Platform

> Upload RAW photos in original quality, view on web at high speed, download 100% intact.
> Domain: **https://bhquan.site**

## Features

- Upload RAW photos (CR2/ARW/NEF/DNG, up to 200MB/file)
- Auto processing: RAW → WebP thumbnail (400px) + preview (1920px)
- 3 plans: Free / Basic (49k/month) / Pro (499k/year)
- Album management, like, comment, favorites, batch rename/delete
- Google Drive import (paste folder link → auto-sync)
- Share albums via link (with like/comment/download permissions)
- Manual payment (bank transfer → admin approval) + voucher system
- Referral program (+7 VIP days per referral)
- Admin dashboard with real-time charts
- Real-time notifications via Socket.io
- Auto emails (welcome, orders, reminders)
- Dark mode + i18n (Vietnamese/English)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Tailwind CSS 4 + Pinia + vue-i18n + vue-chartjs |
| Backend | Express.js 5 + TypeScript + Drizzle ORM |
| Database | MySQL 8 (14 tables, ULID primary keys) |
| Cache/Queue | Redis 7 + BullMQ (4 workers) |
| Storage | Cloudflare R2 (S3 compatible) or Local Filesystem |
| Image Processing | dcraw + Sharp.js |
| Real-time | Socket.io + Redis adapter |
| Email | Resend |
| Deploy | Docker + Nginx + Cloudflare Tunnel (or Let's Encrypt SSL) |

## Project Structure

```
WebPhoto/
├── photo-storage/
│   ├── src/                    # Frontend Vue 3
│   │   ├── pages/              #   File-based routing (dashboard, admin, public)
│   │   ├── components/         #   Organized by domain (album, image, layout, ui)
│   │   ├── stores/             #   Pinia stores (auth, upload, notification, toast)
│   │   ├── composables/        #   useTheme, useNotify, useToast, useUpload
│   │   ├── plugins/            #   i18n setup
│   │   ├── locales/            #   vi.json, en.json (~515 keys each)
│   │   └── utils/              #   API client, format, debounce
│   │
│   └── server/                 # Backend Express
│       └── src/
│           ├── database/       #   Schema (14 tables) + seed
│           ├── middleware/      #   Auth (JWT), admin guard, rate limit
│           ├── routes/         #   44 API endpoints (auth, albums, images, payments, admin, cron, share)
│           ├── utils/          #   DB, Redis, R2, JWT, hash, mail, socket, quota, validate
│           │   └── storage/    #   r2-provider.ts, local-provider.ts
│           ├── workers/        #   imageProcessor, imageExpiry, emailSender, storageMonitor
│           └── plugins/        #   Socket.io, BullMQ
│
├── scripts/                    # All automation scripts
│   ├── dev.sh / dev.bat        #   Start local dev (all services)
│   ├── build.sh                #   Build FE + BE
│   ├── deploy.sh               #   Full deploy on production server
│   ├── quick-deploy.sh         #   Deploy to new VPS from local machine
│   ├── update-deploy.sh        #   Update existing VPS (build → upload → restart)
│   ├── backup.sh               #   Database backup
│   ├── vps-setup.sh            #   Initial VPS setup
│   └── ssl-init.sh             #   SSL certificate setup
│
├── docker-compose.yml          # Local dev (MySQL + Redis)
├── docker-compose.prod.yml     # Production stack
├── docker-compose.tunnel.yml   # Cloudflare Tunnel overlay
└── .env                        # Environment variables (not committed)
```

## Quick Start (Local Development)

```bash
# 1. Start infrastructure
docker-compose up -d                # MySQL :3306 + Redis :6379

# 2. Setup backend
cd photo-storage/server
cp .env.example .env                # Edit with your config
npm ci
npm run db:push                     # Push Drizzle schema to MySQL
npm run db:seed                     # Seed plans + admin user

# 3. Start backend
npm run dev                         # API server :4000

# 4. Start frontend (new terminal)
cd photo-storage
npm ci
npm run dev                         # Vite dev server :3000, proxies /api → :4000

# 5. Start workers (new terminal, optional)
cd photo-storage/server
npx tsx src/workers/start.ts        # Image processing, email, expiry, monitoring
```

Open http://localhost:3000 — Login: `admin@photostorage.com` / `admin123`

## Deployment Flow

### First-time Deploy (new VPS)

```bash
# From local machine — deploys everything automatically:
# build → upload → Docker setup → DB schema → Nginx + SSL → cron jobs
bash scripts/quick-deploy.sh <vps-ip> <domain>

# Example:
bash scripts/quick-deploy.sh <your-vps-ip> bhquan.site
```

What `quick-deploy.sh` does:
1. Builds frontend + backend locally
2. Uploads dist files to VPS via SCP
3. Creates docker-compose on VPS
4. Starts MySQL + Redis + API + Worker containers
5. Pushes DB schema + seeds data
6. Configures Nginx (HTTP → certbot → HTTPS)
7. Sets up cron jobs (expire images, reconcile quota, payment reminders, weekly backup)
8. Health check

### Update Deploy (code changes)

```bash
# From local machine — rebuild + upload + restart only:
bash scripts/update-deploy.sh <vps-ip>

# Example:
bash scripts/update-deploy.sh <your-vps-ip>
```

What `update-deploy.sh` does:
1. Build FE (`npm run build`) + BE (`tsc`) locally
2. Clean old dist on VPS, upload new dist
3. Rebuild Docker images (api + worker)
4. Restart containers
5. Health check

### Deploy on server directly

```bash
# SSH into server, then:
cd /opt/webphoto
git pull origin main
bash scripts/deploy.sh              # Direct SSL mode
bash scripts/deploy.sh tunnel       # Cloudflare Tunnel mode
```

### Git Workflow

```
main (production)
  │
  ├── Local development
  │     npm run dev (FE :3000 + BE :4000)
  │
  ├── Commit changes
  │     git add <files>
  │     git commit -m "fix/feat: description"
  │     git push origin main
  │
  └── Deploy to VPS
        bash scripts/update-deploy.sh <vps-ip>
```

All work happens on `main` branch. Deploy is manual via scripts.

## Build Commands

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | `photo-storage/` | Vite dev server (:3000) |
| `npm run build` | `photo-storage/` | vue-tsc check + Vite bundle → dist/ |
| `npm run dev` | `photo-storage/server/` | API with tsx watch (:4000) |
| `npm run build` | `photo-storage/server/` | TypeScript → dist/ |
| `npm run db:push` | `photo-storage/server/` | Push Drizzle schema to MySQL |
| `npm run db:seed` | `photo-storage/server/` | Seed default plans + admin user |
| `npm run db:migrate` | `photo-storage/server/` | Apply migration files |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `DATABASE_URL` | Yes | MySQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `R2_ENDPOINT` | Yes | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY` | Yes | R2 access key |
| `R2_SECRET_KEY` | Yes | R2 secret key |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `CRON_SECRET` | Yes | Secret header for cron endpoints |
| `CDN_URL` | No | Public R2 CDN URL |
| `STORAGE_BACKEND` | No | `r2` (default) or `local` |

## Documentation

| File | Content |
|------|---------|
| [SETUP.md](SETUP.md) | Detailed installation guide |
| [API.md](API.md) | Full API documentation (44 endpoints) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [DEPLOY.md](DEPLOY.md) | Production deployment guide |
| [CHECKLIST.md](CHECKLIST.md) | Development progress tracking |

## URLs

| Service | URL |
|---------|-----|
| Frontend | https://bhquan.site |
| API | https://bhquan.site/api |
| Admin | https://bhquan.site/admin |
| CDN | *(configured via CDN_URL env var)* |
