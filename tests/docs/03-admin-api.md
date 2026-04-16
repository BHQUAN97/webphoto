# 03. Admin API Endpoints — API quan tri

## Summary

Kiem tra 11 admin API endpoints co phan hoi dung khi goi voi admin token. Bao gom: dashboard stats/charts, user management, album management, payments, plans, payment methods, vouchers, settings, va logs.

**File test:** `tests/03-admin-api.spec.ts`
**So test:** 11
**API prefix:** `/api/admin/*`

## Workflow

```
Login admin → lay accessToken
  ├── Dashboard
  │   ├── GET /admin/dashboard/stats → 200
  │   └── GET /admin/dashboard/charts → < 500 (co the 404)
  ├── User Management
  │   ├── GET /admin/users → 200 (list)
  │   └── GET /admin/users/:id → 200 (detail)
  ├── Content
  │   ├── GET /admin/albums → 200
  │   ├── GET /admin/payments → 200
  │   ├── GET /admin/plans → 200
  │   ├── GET /admin/payment-methods → 200
  │   └── GET /admin/vouchers → 200
  └── System
      ├── GET /admin/settings → 200
      └── GET /admin/logs → 200
```

## Chi tiet cac test case

### TC03.1 — Dashboard stats
- **Muc dich:** Admin dashboard stats endpoint hoat dong
- **Buoc:** GET `/api/admin/dashboard/stats` voi admin token
- **Ky vong:** Status 200

### TC03.2 — List users
- **Muc dich:** Danh sach users tra ve data
- **Buoc:** GET `/api/admin/users` voi admin token
- **Ky vong:** Status 200, body defined

### TC03.3 — User detail
- **Muc dich:** Chi tiet user cu the
- **Buoc:** GET `/api/admin/users/:id` voi admin token (hardcoded admin ULID)
- **Ky vong:** Status 200

### TC03.4 — List albums
- **Muc dich:** Danh sach albums tra ve OK
- **Buoc:** GET `/api/admin/albums` voi admin token
- **Ky vong:** Status 200

### TC03.5 — List payments
- **Muc dich:** Danh sach payments tra ve OK
- **Buoc:** GET `/api/admin/payments` voi admin token
- **Ky vong:** Status 200

### TC03.6 — List plans
- **Muc dich:** Danh sach plans tra ve OK
- **Buoc:** GET `/api/admin/plans` voi admin token
- **Ky vong:** Status 200

### TC03.7 — Payment methods
- **Muc dich:** Danh sach payment methods tra ve OK
- **Buoc:** GET `/api/admin/payment-methods` voi admin token
- **Ky vong:** Status 200

### TC03.8 — Vouchers
- **Muc dich:** Danh sach vouchers tra ve OK
- **Buoc:** GET `/api/admin/vouchers` voi admin token
- **Ky vong:** Status 200

### TC03.9 — Settings
- **Muc dich:** System settings tra ve OK
- **Buoc:** GET `/api/admin/settings` voi admin token
- **Ky vong:** Status 200

### TC03.10 — Logs
- **Muc dich:** Admin logs tra ve OK
- **Buoc:** GET `/api/admin/logs` voi admin token
- **Ky vong:** Status 200

### TC03.11 — Dashboard charts
- **Muc dich:** Charts endpoint hoat dong (soft check — co the 404 neu chua implement)
- **Buoc:** GET `/api/admin/dashboard/charts` voi admin token
- **Ky vong:** Status < 500 (khong duoc internal server error)
