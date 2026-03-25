# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PhotoStorage — a full-stack photo storage platform for photographers, specializing in RAW image management. Vue 3 frontend + Express.js 5 backend, deployed with Docker.

- **Domain:** https://bhquan.site
- **Language:** TypeScript (both frontend and backend), Vietnamese UI/comments
- **Default admin:** admin@photostorage.com / admin123

## Development Commands

### Infrastructure
```bash
docker-compose up -d          # Start MySQL (:3306) + Redis (:6379)
```

### Backend (photo-storage/server/)
```bash
npm run dev                   # Start API server with tsx watch (:4000)
npm run build                 # Compile TypeScript → dist/
npx tsx src/workers/start.ts  # Start BullMQ workers (image processing, email, expiry, monitoring)
npm run db:push               # Push Drizzle schema to MySQL
npm run db:seed               # Seed default plans + admin user
npm run db:migrate            # Apply migration files
```

### Frontend (photo-storage/)
```bash
npm run dev                   # Vite dev server (:3000), proxies /api → :4000
npm run build                 # vue-tsc type check + Vite bundle → dist/
```

### Full Dev Start (scripts/)
```bash
./scripts/dev.sh              # Linux/Mac: starts all services
./scripts/dev.bat             # Windows: starts all services
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d   # Full production stack
./scripts/deploy.sh                                 # Deploy script
./scripts/backup.sh                                 # Database backup
```

## Architecture

### Monorepo Layout
- `photo-storage/src/` — Vue 3 frontend (Vite, Tailwind CSS 4, Pinia, Vue Router)
- `photo-storage/server/src/` — Express.js 5 backend (Drizzle ORM, BullMQ, Socket.io)
- `nginx/` — Reverse proxy config
- `scripts/` — Dev/deploy/backup scripts

### Key Entry Points
- Frontend: `photo-storage/src/main.ts` → `App.vue` → router → pages
- Backend: `photo-storage/server/src/index.ts` → Express app with route registration
- DB Schema: `photo-storage/server/src/database/schema.ts` (14 tables, ULID primary keys)
- Workers: `photo-storage/server/src/workers/start.ts` (4 BullMQ workers)

### Frontend Structure
- **Pages** (`src/pages/`): File-based routing — `/dashboard/*` (auth required), `/admin/*` (admin role), public pages
- **Components** (`src/components/`): Organized by domain — `admin/`, `album/`, `image/`, `layout/`, `payment/`, `profile/`, `ui/`
- **Stores** (`src/stores/`): Pinia — auth, upload, notification, admin, toast
- **Composables** (`src/composables/`): useNotify (Socket.io), useToast, useUpload (multipart)
- **Utils** (`src/utils/`): api.ts (Axios + interceptors), format.ts, debounce.ts
- **Path alias:** `@` → `src/`

### Backend Structure
- **Routes** (`server/src/routes/`): 44 endpoints organized by domain — auth/, users/, albums/, images/, payments/, admin/, cron/
- **Middleware** (`server/src/middleware/`): auth.ts (JWT), admin.ts (role guard), rateLimit.ts (Redis-based)
- **Utils** (`server/src/utils/`): db.ts, redis.ts, r2.ts, jwt.ts, hash.ts, quota.ts, mailService.ts, socket-emit.ts, validate.ts
- **Storage providers** (`server/src/utils/storage/`): r2-provider.ts (Cloudflare R2) + local-provider.ts
- **Workers** (`server/src/workers/`): imageProcessor (RAW→WebP), imageExpiry, emailSender, storageMonitor
- **Plugins** (`server/src/plugins/`): socket.ts (Socket.io on :4001), bullmq.ts

### Image Processing Pipeline
1. Client uploads multipart to Cloudflare R2 (original RAW/JPG)
2. BullMQ job queued → worker downloads from R2
3. RAW files decoded via dcraw → Sharp generates thumb (400px WebP) + preview (1920px WebP)
4. Processed files uploaded to R2 public bucket → DB updated → Socket.io `image:ready` event

### Auth System
- JWT access tokens (15 min) + refresh tokens (7 days) in HttpOnly SameSite=Strict cookies
- Route guards: `meta: { auth: true }` (logged in), `meta: { admin: true }` (admin role), `meta: { guest: true }` (redirect if logged in)

### Real-time
- Socket.io server (:4001) with Redis adapter for scaling
- Rooms: `user:{userId}`, `admin`
- Events: image:ready, payment:success, quota:updated, notification:*

### Cron Jobs (via Express routes, secured by CRON_SECRET header)
- POST /api/cron/expire-images, /reconcile-quota, /remind-payments, /storage-monitor

## Key Technical Decisions

- **ULID** for all primary keys (26-char, sortable)
- **Drizzle ORM** with MySQL dialect — schema-first, no auto-sync
- **Cloudflare R2** (S3-compatible) — private bucket for originals, public bucket for thumbs/previews
- **BullMQ + Redis** for async job processing (not in-process)
- **Manual payment flow** — bank transfer → admin approval (no payment gateway)
- **No test framework** currently configured
- **No ESLint/Prettier** — relies on TypeScript strict mode

## Documentation

- `SETUP.md` — Detailed installation guide
- `API.md` — Full API documentation (44 endpoints)
- `ARCHITECTURE.md` — System architecture details
- `DEPLOY.md` — Production deployment guide
- `CHECKLIST.md` — Development progress tracking
