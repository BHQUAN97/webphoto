# 06. Security — Bao mat

## Summary

Kiem tra 10 khia canh bao mat: admin API block khi chua login (9 endpoints), user API block, redirect khi truy cap trang protected, security headers, XSS protection, SQL injection prevention, upload auth, cron secret, va duplicate email.

**File test:** `tests/06-security.spec.ts`
**So test:** 10
**Pham vi:** API endpoints, UI routes, headers, injection attacks

## Workflow

```
Guest (chua login) truy cap he thong
  ├── 9 Admin API endpoints → 401/403 (block)
  ├── 2 User API endpoints → 401 (block)
  ├── /admin (UI) → Redirect /login
  ├── /dashboard (UI) → Redirect /login
  ├── Security headers → X-Content-Type-Options, X-Frame-Options
  ├── XSS input → Khong trigger alert()
  ├── SQL injection → 400+ (khong login duoc)
  ├── Upload khong login → 401
  ├── Cron khong co secret → 400+
  └── Register email da ton tai → 400+
```

## Chi tiet cac test case

### TC06.1 — Admin APIs block khi khong co token
- **Muc dich:** Tat ca admin endpoints phai yeu cau auth
- **Buoc:** GET 9 endpoints khong co Authorization header
- **9 endpoints:** `/api/admin/dashboard/stats`, `/api/admin/users`, `/api/admin/albums`, `/api/admin/payments`, `/api/admin/plans`, `/api/admin/settings`, `/api/admin/logs`, `/api/admin/vouchers`, `/api/admin/payment-methods`
- **Ky vong:** Tat ca tra ve status >= 401

### TC06.2 — Protected user APIs block khi khong co token
- **Muc dich:** User endpoints can auth
- **Buoc:** GET `/api/users/me` va `/api/users/me/storage` khong co token
- **Ky vong:** Status >= 401

### TC06.3 — /admin redirect ve login khi chua login
- **Muc dich:** Admin UI protected boi auth guard
- **Buoc:** Goto `/admin` → waitForLoadState → check URL hoac body
- **Ky vong:** URL chua `/login` hoac body chua "Dang nhap" / "Login"

### TC06.4 — /dashboard redirect ve login khi chua login
- **Muc dich:** User dashboard protected
- **Buoc:** Goto `/dashboard` → check URL
- **Ky vong:** URL chua `/login`

### TC06.5 — Security headers
- **Muc dich:** API tra ve security headers dung
- **Buoc:** GET `/api/health` → check response headers
- **Ky vong:** `x-content-type-options: nosniff`, `x-frame-options` defined

### TC06.6 — XSS trong login input
- **Muc dich:** Script injection khong chay duoc
- **Buoc:** Fill email = `<script>alert(1)</script>@test.com` → submit → doi 2s
- **Ky vong:** Khong co dialog alert

### TC06.7 — SQL injection trong login
- **Muc dich:** SQL injection khong bypass duoc auth
- **Buoc:** POST `/api/auth/login` voi email `admin' OR '1'='1` va password `' OR '1'='1`
- **Ky vong:** Status >= 400

### TC06.8 — Upload khong cho phep khi chua login
- **Muc dich:** Upload endpoint can auth
- **Buoc:** POST `/api/images/upload-url` khong co token
- **Ky vong:** Status >= 401

### TC06.9 — Cron endpoint can secret
- **Muc dich:** Cron jobs can header `x-cron-secret`
- **Buoc:** GET `/api/cron/expire-images` khong co secret header
- **Ky vong:** Status >= 400

### TC06.10 — Register voi email da ton tai
- **Muc dich:** Khong cho dang ky trung email
- **Buoc:** POST `/api/auth/register` voi email `admin@photostorage.com`
- **Ky vong:** Status >= 400 (409 Conflict)
