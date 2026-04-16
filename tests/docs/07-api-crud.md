# 07. API CRUD Operations — Thao tac du lieu

## Summary

Kiem tra cac API CRUD co ban: public endpoints (albums list, images list, plans, payment methods) va authenticated endpoints (create album, referrals, user albums, user stats). Verify du lieu tra ve dung format.

**File test:** `tests/07-api-crud.spec.ts`
**So test:** 8
**API prefix:** `/api/*`

## Workflow

```
Public APIs (khong can auth):
  ├── GET /api/albums → 200 (public feed)
  ├── GET /api/images → 200 (public images)
  ├── GET /api/plans → 200, >= 3 plans
  └── GET /api/payment-methods → 200

Authenticated APIs (admin token):
  ├── POST /api/albums → Tao album moi
  ├── GET /api/referrals → < 500
  ├── GET /api/users/me/albums → 200
  └── GET /api/users/me/stats → < 500
```

## Chi tiet cac test case

### TC07.1 — Public albums list
- **Muc dich:** Album feed public hoat dong
- **Buoc:** GET `/api/albums`
- **Ky vong:** Status 200

### TC07.2 — Public images list
- **Muc dich:** Images feed public hoat dong
- **Buoc:** GET `/api/images`
- **Ky vong:** Status 200

### TC07.3 — Create album thanh cong
- **Muc dich:** Tao album moi voi auth
- **Buoc:** Login lay token → POST `/api/albums` voi title unique + isPublic=false
- **Ky vong:** Status < 300, body defined (tra ve album info)

### TC07.4 — Plans public >= 3 plans
- **Muc dich:** Plans endpoint tra ve du 3 goi (Free/Basic/Pro)
- **Buoc:** GET `/api/plans`
- **Ky vong:** Status 200, `plans` array length >= 3
- **Ghi chu:** Flexible response format: check `body.plans`, `body` (array), hoac `body.data`

### TC07.5 — Payment methods public
- **Muc dich:** Payment methods public endpoint hoat dong
- **Buoc:** GET `/api/payment-methods`
- **Ky vong:** Status 200

### TC07.6 — Referrals API
- **Muc dich:** Referrals endpoint accessible (soft check)
- **Buoc:** GET `/api/referrals` voi admin token
- **Ky vong:** Status < 500

### TC07.7 — User albums
- **Muc dich:** User's albums list hoat dong
- **Buoc:** GET `/api/users/me/albums` voi admin token
- **Ky vong:** Status 200

### TC07.8 — User stats
- **Muc dich:** User stats endpoint hoat dong (soft check)
- **Buoc:** GET `/api/users/me/stats` voi admin token
- **Ky vong:** Status < 500
