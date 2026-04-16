# E2E Test Documentation — WebPhoto (PhotoStorage)

> Tai lieu nghiep vu E2E Playwright cho platform PhotoStorage
> Cap nhat: 2026-04-16 | Tong: 7 test suites | 50 tests

## Tong quan

| # | Nghiep vu | File test | So test | Pham vi |
|---|-----------|-----------|---------|---------|
| 01 | [Public Pages](01-public-pages.md) | `01-public-pages.spec.ts` | 7 | Trang chu, login, register, 404, API |
| 02 | [Admin Login](02-admin-login.md) | `02-admin-login.spec.ts` | 6 | Login API + UI, credentials, logout |
| 03 | [Admin API](03-admin-api.md) | `03-admin-api.spec.ts` | 11 | 11 admin API endpoints |
| 04 | [Admin UI](04-admin-ui.md) | `04-admin-ui.spec.ts` | 3 | Dashboard, sidebar, tat ca trang admin |
| 05 | [User Dashboard](05-user-dashboard.md) | `05-user-dashboard.spec.ts` | 5 | Dashboard pages, profile, storage, upgrade |
| 06 | [Security](06-security.md) | `06-security.spec.ts` | 10 | Auth, headers, XSS, SQLi, upload, cron |
| 07 | [API CRUD](07-api-crud.md) | `07-api-crud.spec.ts` | 8 | Albums, images, plans, referrals CRUD |

## Coverage theo man hinh

```
PUBLIC PAGES:
  [x] Homepage /                    — 1 test (body load)
  [x] Login /login                  — 2 tests (form render, sai password)
  [x] Register /register            — 1 test (form render)
  [x] 404 Page                      — 1 test (not found)
  [x] Health Check API              — 1 test (/api/health)
  [x] Plans API                     — 1 test (/api/plans)

AUTH:
  [x] Login API                     — 4 tests (thanh cong, sai email, sai password, thieu field)
  [x] Login UI                      — 1 test (redirect dashboard/admin)
  [x] Logout API                    — 1 test (logout endpoint)

ADMIN API:
  [x] Dashboard Stats               — 1 test
  [x] Dashboard Charts              — 1 test
  [x] Users (list + detail)         — 2 tests
  [x] Albums                        — 1 test
  [x] Payments                      — 1 test
  [x] Plans                         — 1 test
  [x] Payment Methods               — 1 test
  [x] Vouchers                      — 1 test
  [x] Settings                      — 1 test
  [x] Logs                          — 1 test

ADMIN UI:
  [x] Dashboard load                — 1 test (stat cards)
  [x] Sidebar menu                  — 1 test (menu items)
  [x] 9 trang admin load            — 1 test (no server error)

USER DASHBOARD:
  [x] 6 trang dashboard             — 1 test (load OK)
  [x] Profile                       — 1 test (hien admin email)
  [x] /users/me API                 — 1 test
  [x] /users/me/storage API         — 1 test
  [x] Upgrade page                  — 1 test (hien plans)

SECURITY:
  [x] Admin API auth (9 endpoints)  — 1 test (block 401/403)
  [x] User API auth (2 endpoints)   — 1 test (block 401)
  [x] /admin redirect               — 1 test (redirect login)
  [x] /dashboard redirect           — 1 test (redirect login)
  [x] Security headers              — 1 test (X-Content-Type-Options, X-Frame-Options)
  [x] XSS protection                — 1 test (script injection)
  [x] SQL injection                 — 1 test (login SQL inject)
  [x] Upload auth                   — 1 test (block unauthenticated)
  [x] Cron auth                     — 1 test (require secret header)
  [x] Duplicate email               — 1 test (register exist email)

API CRUD:
  [x] Public albums                 — 1 test
  [x] Public images                 — 1 test
  [x] Create album                  — 1 test
  [x] Plans >= 3                    — 1 test
  [x] Payment methods               — 1 test
  [x] Referrals API                 — 1 test
  [x] User albums                   — 1 test
  [x] User stats                    — 1 test
```

## Cau hinh

- **Base URL:** `http://127.0.0.1:4100` (API) / `http://localhost:3000` (FE)
- **Admin credentials:** `admin@photostorage.com` / `admin123`
- **Auth helper:** `helpers.ts` — `getAdminToken()` login API tra ve accessToken
- **Framework:** Playwright

## Cach chay test

```bash
# Tat ca tests
npx playwright test

# Chi 1 file
npx playwright test tests/01-public-pages.spec.ts

# Chi 1 test case
npx playwright test -g "TC01.1"

# Voi UI mode (debug)
npx playwright test --ui

# Xem report
npx playwright show-report
```

## Helpers (`tests/helpers.ts`)

| Export | Mo ta |
|--------|-------|
| `API_BASE` | `http://127.0.0.1:4100` |
| `ADMIN_EMAIL` | `admin@photostorage.com` |
| `ADMIN_PASSWORD` | `admin123` |
| `getAdminToken(request)` | Login API, tra ve accessToken string |
| `loginAdminUI(page)` | Login qua API, set token vao localStorage + cookie |

## Cau truc file

```
tests/
  ├── docs/                          ← TAI LIEU (ban dang doc)
  │   ├── INDEX.md                   ← File nay
  │   ├── 01-public-pages.md
  │   ├── 02-admin-login.md
  │   ├── 03-admin-api.md
  │   ├── 04-admin-ui.md
  │   ├── 05-user-dashboard.md
  │   ├── 06-security.md
  │   └── 07-api-crud.md
  ├── .auth/                         ← Auth state storage
  ├── helpers.ts                     ← Test utilities
  ├── 01-public-pages.spec.ts
  ├── 02-admin-login.spec.ts
  ├── 03-admin-api.spec.ts
  ├── 04-admin-ui.spec.ts
  ├── 05-user-dashboard.spec.ts
  ├── 06-security.spec.ts
  └── 07-api-crud.spec.ts
```
