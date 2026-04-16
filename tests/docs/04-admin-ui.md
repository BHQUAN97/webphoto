# 04. Admin UI Pages — Giao dien quan tri

## Summary

Kiem tra giao dien admin sau khi login: dashboard load co noi dung, sidebar hien menu items dung, va tat ca 9 trang admin load khong bi server error.

**File test:** `tests/04-admin-ui.spec.ts`
**So test:** 3
**Trang:** `/admin`, `/admin/*`

## Workflow

```
Login admin qua UI (fill form → submit → redirect)
  ├── /admin → Dashboard load, co stat cards
  ├── Sidebar → Hien menu items (Dashboard, Users, Albums, Payments, Plans, Settings, Logs, Voucher)
  └── Navigate 9 trang:
      /admin, /admin/users, /admin/albums, /admin/payments,
      /admin/plans, /admin/payment-methods, /admin/vouchers,
      /admin/settings, /admin/logs
      → Tat ca co noi dung, khong co "internal server error"
```

## Chi tiet cac test case

### TC04.1 — Admin dashboard load, co stat cards
- **Muc dich:** Dashboard render duoc sau khi login
- **Buoc:** Login admin → goto `/admin` → waitForLoadState('networkidle') → check body
- **Ky vong:** Body text length > 50 (co noi dung)

### TC04.2 — Admin sidebar hien menu
- **Muc dich:** Sidebar navigation co cac menu items can thiet
- **Buoc:** Login → goto `/admin` → kiem tra text cua 14 keywords (EN + VI)
- **Keywords kiem tra:** Dashboard, Users, Albums, Payments, Plans, Settings, Logs, Nguoi dung, Album, Thanh toan, Goi, Cai dat, Nhat ky, Voucher
- **Ky vong:** Tim thay >= 3 keywords (flexible cho i18n)

### TC04.3 — Tat ca trang admin load khong loi
- **Muc dich:** 9 trang admin deu render duoc, khong bi 500 error
- **Buoc:** Login → navigate lan luot 9 trang → moi trang check body
- **9 trang:** `/admin`, `/admin/users`, `/admin/albums`, `/admin/payments`, `/admin/plans`, `/admin/payment-methods`, `/admin/vouchers`, `/admin/settings`, `/admin/logs`
- **Ky vong:** Moi trang: body length > 10 va khong chua "internal server error"
- **Ghi chu:** Bat page errors qua `page.on('pageerror')` de debug neu fail
