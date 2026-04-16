# 05. User Dashboard — Dashboard nguoi dung

## Summary

Kiem tra cac trang dashboard cua user (dung admin account de test): 6 trang dashboard load OK, profile hien email, 2 API endpoints (/users/me va /users/me/storage) hoat dong, va trang upgrade hien plans.

**File test:** `tests/05-user-dashboard.spec.ts`
**So test:** 5
**Trang:** `/dashboard/*`, `/upgrade`, API `/api/users/me*`

## Workflow

```
Login admin (dong thoi la user) → truy cap dashboard
  ├── 6 trang dashboard:
  │   /dashboard, /dashboard/albums, /dashboard/favorites,
  │   /dashboard/profile, /dashboard/settings, /dashboard/referral
  │   → Tat ca load OK
  ├── /dashboard/profile → Hien email admin
  ├── GET /api/users/me → 200 (profile info)
  ├── GET /api/users/me/storage → 200 (used/limit)
  └── /upgrade → Hien danh sach plans
```

## Chi tiet cac test case

### TC05.1 — Tat ca trang user dashboard load
- **Muc dich:** 6 trang dashboard render duoc
- **Buoc:** Login → navigate 6 trang → moi trang check body length > 10
- **6 trang:** `/dashboard`, `/dashboard/albums`, `/dashboard/favorites`, `/dashboard/profile`, `/dashboard/settings`, `/dashboard/referral`
- **Ky vong:** Tat ca trang co noi dung

### TC05.2 — Profile hien email admin
- **Muc dich:** Trang profile hien thong tin dung
- **Buoc:** Login → goto `/dashboard/profile` → check body text
- **Ky vong:** Body chua "admin" hoac "Admin" hoac email admin

### TC05.3 — API /users/me
- **Muc dich:** Profile API tra ve thong tin user
- **Buoc:** GET `/api/users/me` voi admin token
- **Ky vong:** Status 200

### TC05.4 — API /users/me/storage
- **Muc dich:** Storage API tra ve used/limit
- **Buoc:** GET `/api/users/me/storage` voi admin token
- **Ky vong:** Status 200

### TC05.5 — Upgrade page hien plans
- **Muc dich:** Trang upgrade hien danh sach goi dich vu
- **Buoc:** Login → goto `/upgrade` → check body length > 50
- **Ky vong:** Body co noi dung (plans loaded)
