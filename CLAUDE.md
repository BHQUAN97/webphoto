# CLAUDE.md — PhotoStorage

This file provides guidance to Claude Code when working with this repository.
**Constitution:** `.sdd/constitution.md` — doc TRUOC khi lam bat ky viec gi.

# Stack: Vue 3 + TypeScript + Tailwind CSS 4 (FE) | Express.js 5 + TypeScript + Drizzle ORM (BE)
# Domain: https://bhquan.site | DB: MySQL 8 | Cache: Redis 7 | Storage: Cloudflare R2

---

## AUTO MODE — QUYET DINH TU DONG

### TU DONG THUC HIEN (khong hoi):
- Doc bat ky file nao trong repo
- Chay: build, typecheck, lint, test (vitest, vue-tsc, tsc --noEmit)
- Tao/sua file code trong src/ hoac server/src/
- Cai package npm (khong phai global)
- Doc .env.example (KHONG doc .env that)

### BAT BUOC HOI USER:
- Xoa file hoac thu muc
- Chay migration DB production (db:push, db:migrate)
- SSH vao VPS / lenh tren server
- Deploy len production
- Thay doi .env production
- Xoa data trong DB / Reset Redis cache production
- Commit va push len git
- Bat ky hanh dong khong the hoan tac

---

## DEV COMMANDS

**Infrastructure:**
```bash
docker-compose up -d          # MySQL :3306 + Redis :6379
```

**Backend** (`photo-storage/server/`):
```bash
npm run dev                   # API :4000 (tsx watch)
npm run build                 # tsc → dist/
npm run db:push               # Push schema
npm run db:seed               # Seed plans + admin
npx tsx src/workers/start.ts  # BullMQ workers
```

**Frontend** (`photo-storage/`):
```bash
npm run dev                   # Vite :3000 (proxy /api → :4000)
npm run build                 # vue-tsc + Vite → dist/
```

**Production:**
```bash
bash scripts/update-deploy.sh <vps-ip>   # Build local → upload → restart
bash scripts/deploy.sh                    # Deploy tren server
bash scripts/db-changelog.sh <vps-ip>    # Chay DB changelog
bash scripts/db-changelog.sh <vps-ip> V005  # Chay 1 version cu the
```

---

## KEY FILES
- DB Schema: `photo-storage/server/src/database/schema.ts` (14 tables, ULID PKs)
- Auth middleware: `server/src/middleware/auth.ts` (JWT, requireAuth, requireAdmin, requirePlan)
- Validate utils: `server/src/utils/validate.ts` (sanitize, ULID check, XSS strip)
- asyncHandler: `server/src/utils/asyncHandler.ts`
- Response helpers: `server/src/utils/response.ts` (ok, fail, created, unauthorized...)
- API client FE: `photo-storage/src/utils/api.ts` (Axios + interceptors)
- useApi composable: `photo-storage/src/composables/useApi.ts`
- Design tokens: `photo-storage/src/assets/tokens.css`
- Socket: `server/src/plugins/socket.ts` (:4001, Redis adapter)
- Workers: `server/src/workers/` (imageProcessor, imageExpiry, emailSender, storageMonitor)

## ARCHITECTURE NOTES
- ULID cho tat ca primary keys
- JWT access token 15min + refresh token 7 days (HttpOnly cookies)
- R2 private bucket (originals) + public bucket (thumb/preview)
- BullMQ + Redis cho async image processing
- Socket.io rooms: user:{userId}, admin
- Manual payment flow: bank transfer → admin approve
- Admin default: admin@photostorage.com / admin123
