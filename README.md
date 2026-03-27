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
- **Dual storage backend**: Cloudflare R2 (cloud) or Local Filesystem — switchable at runtime, per-image tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Tailwind CSS 4 + Pinia + vue-i18n + vue-chartjs |
| Backend | Express.js 5 + TypeScript + Drizzle ORM |
| Database | MySQL 8 (16 tables, ULID primary keys) |
| Cache/Queue | Redis 7 + BullMQ (4 workers) |
| Storage | Cloudflare R2 (S3 compatible) or Local Filesystem (per-image backend) |
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
│           ├── database/       #   Schema (16 tables) + seed
│           ├── middleware/      #   Auth (JWT), admin guard, rate limit
│           ├── routes/         #   44 API endpoints (auth, albums, images, payments, admin, cron, share)
│           ├── utils/          #   DB, Redis, R2, JWT, hash, mail, socket, quota, validate
│           │   └── storage/    #   r2-provider.ts, local-provider.ts (dual-backend)
│           ├── workers/        #   imageProcessor, imageExpiry, driveImport, storageMonitor
│           └── plugins/        #   Socket.io, BullMQ
│
├── db/                         # Database management (source of truth for DBO)
│   ├── schema/tables/          #   16 files — 1 file per table (CREATE TABLE IF NOT EXISTS)
│   ├── data/                   #   Seed data, master data
│   └── changelog/              #   Idempotent migration scripts (V001, V002, ...)
│
├── scripts/                    # All automation scripts
│   ├── dev.sh                  #   Start local dev (all services)
│   ├── build.sh                #   Build FE + BE
│   ├── deploy.sh               #   Full deploy on production server
│   ├── quick-deploy.sh         #   Deploy to new VPS from local machine
│   ├── update-deploy.sh        #   Update existing VPS (build → upload → changelog → restart)
│   ├── db-changelog.sh         #   Run DB changelog on VPS (idempotent)
│   ├── backup.sh               #   Database backup
│   ├── vps-setup.sh            #   Initial VPS setup
│   └── ssl-init.sh             #   SSL certificate setup
│
├── docker-compose.yml          # Local dev (MySQL + Redis)
├── docker-compose.prod.yml     # Production stack
├── docker-compose.tunnel.yml   # Cloudflare Tunnel overlay
├── CLAUDE.md                   # Agent system rules (BA → SA → Dev → QC → DBO → DevOps)
└── .env                        # Environment variables (not committed)
```

## Database Schema (16 tables)

| Table | Description |
|-------|-------------|
| `users` | User accounts, roles, referral codes |
| `plans` | Subscription plans (Free/Basic/Pro) |
| `user_plans` | Active plan assignments per user |
| `vouchers` | Discount/activation voucher codes |
| `voucher_usages` | Voucher redemption log |
| `referrals` | Referral tracking (referrer → referee) |
| `storage_addons` | Extra storage purchased by user |
| `payment_methods` | Bank transfer, MoMo, ZaloPay config |
| `payments` | Payment orders + approval workflow |
| `albums` | Photo albums with cover, sharing, password |
| `images` | Photos with per-image `storage_backend` (r2/local) |
| `likes` | Image like tracking (user + image composite PK) |
| `comments` | Image comments (user or guest) |
| `refresh_tokens` | JWT refresh token store |
| `album_share_tokens` | Shareable album links with permissions |
| `system_settings` | Key-value admin config |
| `admin_logs` | Admin action audit log |
| `app_logs` | Application-level log storage |
| `storage_snapshots` | Daily storage/user/revenue metrics |

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

## Deployment

### First-time Deploy (new VPS)

```bash
bash scripts/quick-deploy.sh <vps-ip> <domain>
# Example: bash scripts/quick-deploy.sh 213.163.199.176 bhquan.site
```

Steps: build local → upload → Docker setup → DB schema + seed → Nginx + SSL → cron jobs → health check.

### Update Deploy (code changes)

```bash
bash scripts/update-deploy.sh <vps-ip>
```

Steps:
1. Build FE + BE locally
2. Upload dist to VPS
3. Update Nginx config
4. Rebuild Docker images (api + worker)
5. **Run DB changelog** (idempotent — safe every deploy)
6. Health check

### DB Changelog (standalone)

```bash
# Run all changelogs (V001, V002, ...)
bash scripts/db-changelog.sh <vps-ip>

# Run single version
bash scripts/db-changelog.sh <vps-ip> V005
```

All changelog scripts are **idempotent** — they check `information_schema` before making changes, so running them multiple times is safe.

### Deploy on server directly

```bash
ssh root@<vps-ip>
cd /opt/webphoto
git pull origin main
bash scripts/deploy.sh              # Direct SSL mode
bash scripts/deploy.sh tunnel       # Cloudflare Tunnel mode
```

## Build Commands

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | `photo-storage/` | Vite dev server (:3000) |
| `npm run build` | `photo-storage/` | vue-tsc check + Vite bundle → dist/ |
| `npm run dev` | `photo-storage/server/` | API with tsx watch (:4000) |
| `npm run build` | `photo-storage/server/` | TypeScript → dist/ |
| `npm run db:push` | `photo-storage/server/` | Push Drizzle schema to MySQL (dev only) |
| `npm run db:seed` | `photo-storage/server/` | Seed default plans + admin user |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `DATABASE_URL` | Yes | MySQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `R2_ENDPOINT` | For R2 | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY` | For R2 | R2 access key |
| `R2_SECRET_KEY` | For R2 | R2 secret key |
| `CDN_URL` | For R2 | Public R2 CDN URL |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `CRON_SECRET` | Yes | Secret header for cron endpoints |
| `APP_URL` | No | App URL for email links (default: http://localhost:3000) |

Storage backend (R2 or local) is configured via Admin Settings UI, not env vars.

## Git Workflow

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

## URLs

| Service | URL |
|---------|-----|
| Frontend | https://bhquan.site |
| API | https://bhquan.site/api/health |
| Admin | https://bhquan.site/admin |
