# 02. Admin Login — Dang nhap Admin

## Summary

Kiem tra toan bo luong xac thuc admin: login API tra ve token + user info, login UI redirect dung, xu ly credentials sai (email sai, password sai, thieu field), va logout endpoint.

**File test:** `tests/02-admin-login.spec.ts`
**So test:** 6
**Trang:** `/login`, API `/api/auth/*`

## Workflow

```
Admin truy cap /login
  ├── Nhap email + password
  ├── POST /api/auth/login
  │   ├── 200 → { user: { role: "admin" }, accessToken }
  │   ├── 401 → Email hoac password sai
  │   └── 400 → Thieu field
  ├── Thanh cong → Redirect /admin hoac /dashboard
  └── Logout → POST /api/auth/logout (can token)
```

## Chi tiet cac test case

### TC02.1 — Login API tra ve accessToken va user info
- **Muc dich:** Verify API tra ve du lieu dung khi login thanh cong
- **Buoc:** POST `/api/auth/login` voi admin credentials
- **Ky vong:** Status 200, body co `user` (role="admin", email dung), co `accessToken`

### TC02.2 — Login UI redirect ve dashboard/admin
- **Muc dich:** Login tren giao dien redirect dung
- **Buoc:** Goto `/login` → fill email + password → click submit → doi URL
- **Ky vong:** URL chua `/admin` hoac `/dashboard` (timeout 15s)

### TC02.3 — Login voi email sai
- **Muc dich:** Email khong ton tai → 401
- **Buoc:** POST `/api/auth/login` voi email `notexist@test.com`
- **Ky vong:** Status 401

### TC02.4 — Login voi password sai
- **Muc dich:** Password sai → 401
- **Buoc:** POST `/api/auth/login` voi password `wrongpass`
- **Ky vong:** Status 401

### TC02.5 — Login thieu field
- **Muc dich:** Thieu password → 400+
- **Buoc:** POST `/api/auth/login` chi co email, khong co password
- **Ky vong:** Status >= 400

### TC02.6 — Logout endpoint
- **Muc dich:** Logout xoa tokens thanh cong
- **Buoc:** Login lay token → POST `/api/auth/logout` voi Bearer token
- **Ky vong:** Status < 300
