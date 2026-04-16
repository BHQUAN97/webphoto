# 01. Public Pages — Trang cong khai

## Summary

Kiem tra cac trang cong khai co the truy cap khong can dang nhap: trang chu, login form, register form, trang 404, login voi sai credentials, va 2 API endpoints public (health check + plans).

**File test:** `tests/01-public-pages.spec.ts`
**So test:** 7
**Trang:** `/`, `/login`, `/register`, `/khong-ton-tai-xyz`, API endpoints

## Workflow

```
Guest truy cap website
  ├── / (Homepage) → Body khong rong
  ├── /login → Form: email + password + submit button
  ├── /register → Form: email + password field
  ├── /random-url → Hien 404 / "Khong tim thay" / "Not Found"
  ├── Login sai → Hien thong bao loi
  ├── /api/health → { "status": "ok" }
  └── /api/plans → 200 OK (danh sach goi dich vu)
```

## Chi tiet cac test case

### TC01.1 — Trang chu load thanh cong
- **Muc dich:** Verify homepage render duoc, body khong rong
- **Buoc:** Goto `/` → check `body` not empty
- **Ky vong:** Body co noi dung

### TC01.2 — Trang login hien form
- **Muc dich:** Login page co day du form elements
- **Buoc:** Goto `/login` → check 3 elements visible
- **Ky vong:** `input[type="email"]`, `input[type="password"]`, `button[type="submit"]` deu visible

### TC01.3 — Trang register hien form
- **Muc dich:** Register page co day du form elements
- **Buoc:** Goto `/register` → check email input + password field visible
- **Ky vong:** Email input visible, password field (type="password" hoac placeholder "...")  visible

### TC01.4 — Trang 404 hien thi dung
- **Muc dich:** URL khong ton tai hien thong bao 404
- **Buoc:** Goto `/khong-ton-tai-xyz` → check body text
- **Ky vong:** Body chua "404" hoac "Khong tim thay" hoac "Not Found"

### TC01.5 — Login sai password hien thong bao loi
- **Muc dich:** Submit form voi credentials sai → hien error
- **Buoc:** Goto `/login` → fill wrong email + password → click submit → doi 3s → check body
- **Ky vong:** Body chua "khong dung" hoac "Invalid" hoac "Loi" hoac "Error"

### TC01.6 — Health check API
- **Muc dich:** API server dang chay va phan hoi dung
- **Buoc:** GET `/api/health`
- **Ky vong:** Status 200, body `{ "status": "ok" }`

### TC01.7 — API plans public
- **Muc dich:** Plans endpoint public (khong can auth), co the cham do Redis cache miss
- **Buoc:** GET `/api/plans` (timeout 15s)
- **Ky vong:** Status 200
