# WebPhoto (PhotoStorage) — Index tai lieu

> Danh muc tat ca tai lieu du an. Cap nhat: 2026-04-16

---

## Tai lieu goc (Root)

| File | Mo ta |
|------|-------|
| [`CLAUDE.md`](../CLAUDE.md) | Huong dan AI agent — stack, dev commands, key files, architecture notes |
| [`README.md`](../README.md) | Gioi thieu project, features, tech stack, quick start, deploy guide |
| [`API.md`](../API.md) | API documentation — 44+ REST endpoints, WebSocket events, error format |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Kien truc he thong — diagram, DB schema, auth flow, upload flow, Redis, payment, security, performance |
| [`DEPLOY.md`](../DEPLOY.md) | Huong dan deploy — quick-deploy 1 lenh, manual deploy, Nginx, SSL, cron, troubleshooting |
| [`SETUP.md`](../SETUP.md) | Huong dan cai dat local — yeu cau, Docker, backend, frontend, worker, verify |
| [`CHECKLIST.md`](../CHECKLIST.md) | Checklist trien khai — 30 buoc tu code den go-live, security audit, performance audit |
| [`Base-Pattern.md`](../Base-Pattern.md) | Base patterns cho BE — 13 rules (layer, interface-first, generic CRUD, DI, transaction...) |
| [`PHOTO_STORAGE_PROMPT_v2.md`](../PHOTO_STORAGE_PROMPT_v2.md) | Prompt goc de xay dung he thong (yeu cau chuc nang, bai toan) |

---

## Tai lieu nghiep vu & ky thuat (`docs/`)

| File | Mo ta |
|------|-------|
| [`business-flows.md`](business-flows.md) | Luong nghiep vu chi tiet — Upload, Storage, User, Payment, Admin, Share, Cron |

---

## Constitution & SDD (`.sdd/`)

| File | Mo ta |
|------|-------|
| [`.sdd/constitution.md`](../.sdd/constitution.md) | Nguyen tac bat bien — stack, architecture, code conventions, domain rules. Doc TRUOC khi lam viec |
| `.sdd/features/` | Feature specs (thu muc) |

---

## Database (`db/`)

| Folder | Mo ta |
|--------|-------|
| `db/schema/tables/` | 16 files — 1 file per table (CREATE TABLE IF NOT EXISTS) |
| `db/data/` | Seed data, master data |
| `db/changelog/` | Idempotent migration scripts (V001, V002, ...) |

---

## Scripts (`scripts/`)

| Script | Chay tu | Mo ta |
|--------|---------|-------|
| `dev.sh` / `dev.bat` | Local | Start tat ca services (MySQL, Redis, API, FE) |
| `build.sh` | Local | Build FE (Vite) + BE (tsc) |
| `quick-deploy.sh <ip> <domain>` | Local | Deploy VPS moi tu dau (8 buoc tu dong) |
| `update-deploy.sh <ip>` | Local | Cap nhat code len VPS da deploy (5 buoc) |
| `deploy.sh` | VPS | Deploy truc tiep tren server |
| `db-changelog.sh <ip> [version]` | Local | Chay DB changelog (idempotent) |
| `backup.sh` | VPS | Backup database MySQL |
| `vps-setup.sh` | VPS | Initial VPS setup |
| `ssl-init.sh` | VPS | SSL certificate setup |
| `qc-api-test.sh` | Local | Automated API test (17 test cases) |

---

## Docker & Infrastructure

| File | Mo ta |
|------|-------|
| [`docker-compose.yml`](../docker-compose.yml) | Local dev — MySQL 8 + Redis 7 |
| [`docker-compose.prod.yml`](../docker-compose.prod.yml) | Production stack — API + Worker + MySQL + Redis |
| [`docker-compose.tunnel.yml`](../docker-compose.tunnel.yml) | Cloudflare Tunnel overlay |

---

## CI/CD (`.github/workflows/`)

| File | Mo ta |
|------|-------|
| `ci.yml` | CI pipeline — typecheck + build FE & BE |
| `deploy.yml` | Deploy workflow |
| `cron.yml` | Scheduled tasks (expire-images, reconcile-quota, remind-payments) |
| `backup.yml` | Database backup workflow |
| `restore.yml` | Database restore workflow |
| `vps-setup.yml` | VPS initial setup workflow |

---

## E2E Tests (`tests/`)

| File | Tests | Pham vi |
|------|-------|---------|
| `01-public-pages.spec.ts` | 7 | Trang chu, login, register, 404, health check, plans API |
| `02-admin-login.spec.ts` | 6 | Login API + UI, sai credentials, logout |
| `03-admin-api.spec.ts` | 11 | Admin API endpoints: stats, users, albums, payments, plans, settings, logs |
| `04-admin-ui.spec.ts` | 3 | Admin UI: dashboard load, sidebar menu, tat ca trang admin |
| `05-user-dashboard.spec.ts` | 5 | User dashboard pages, profile, storage API, upgrade page |
| `06-security.spec.ts` | 10 | Auth protection, security headers, XSS, SQL injection, CSRF |
| `07-api-crud.spec.ts` | 8 | Public APIs + CRUD: albums, images, plans, referrals, user data |
| **Tong** | **50** | **Full coverage: public, auth, admin, user, security, CRUD** |

> Chi tiet: xem [`tests/docs/INDEX.md`](../tests/docs/INDEX.md)

---

## Cau truc project

```
WebPhoto/
├── photo-storage/
│   ├── src/                    # Frontend Vue 3
│   │   ├── pages/              #   22 pages (public, dashboard, admin, share)
│   │   ├── components/         #   Organized: admin, album, image, layout, payment, profile, ui
│   │   ├── stores/             #   Pinia: auth, upload, notification, toast
│   │   ├── composables/        #   useTheme, useNotify, useToast, useUpload, useApi
│   │   ├── plugins/            #   i18n, socket
│   │   ├── locales/            #   vi.json, en.json (~515 keys)
│   │   └── utils/              #   API client, format, debounce
│   │
│   └── server/                 # Backend Express.js 5
│       └── src/
│           ├── database/       #   Schema (16 tables) + seed
│           ├── middleware/      #   Auth (JWT), admin guard, rate limit
│           ├── routes/         #   44+ endpoints (auth, albums, images, payments, admin, cron, share, vouchers, referrals, storage)
│           ├── utils/          #   DB, Redis, R2, JWT, hash, mail, socket, quota, validate
│           ├── workers/        #   imageProcessor, imageExpiry, driveImport, storageMonitor
│           └── plugins/        #   Socket.io, BullMQ
│
├── db/                         # Database (source of truth)
│   ├── schema/tables/          #   16 files — 1 file per table
│   ├── data/                   #   Seed data
│   └── changelog/              #   Idempotent migrations (V001, V002, ...)
│
├── scripts/                    # Automation scripts (15 files)
├── tests/                      # E2E tests (Playwright, 7 spec files)
│   └── docs/                   #   Tai lieu E2E tests
├── docs/                       # Tai lieu tong hop (ban dang doc)
├── .sdd/                       # Constitution + feature specs
├── .github/workflows/          # CI/CD (6 workflows)
└── docker-compose*.yml         # Docker configs (3 files)
```

---

## Ports (Dev)

| Service | Port |
|---------|------|
| Frontend (Vite) | 3000 |
| Backend API (Express) | 4000 |
| Socket.io | 4001 |
| MySQL | 3306 |
| Redis | 6379 |

## URLs (Production)

| Service | URL |
|---------|-----|
| Frontend | https://bhquan.site |
| API | https://bhquan.site/api/ |
| Admin | https://bhquan.site/admin |
| WebSocket | wss://bhquan.site/socket.io/ |
