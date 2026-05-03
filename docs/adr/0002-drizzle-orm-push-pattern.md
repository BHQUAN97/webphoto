# ADR-0002: Drizzle ORM `db:push` thay vi TypeORM migration

- **Status**: accepted
- **Date**: 2026-02-15
- **Tags**: database, orm

## Context

TypeORM migrations (nhu LeQuyDon) co overhead: generate, review, run. Drizzle offer 2 mode:
- `db:push` — apply schema truc tiep tu `schema.ts` (nhanh, dev-friendly)
- `db:generate` — tao migration file (chuan enterprise)

Solo dev + iteration nhanh → thien ve `db:push`.

## Decision

### Dev workflow
```bash
# Edit schema
vim server/src/database/schema.ts

# Push changes directly to DB
npm run db:push        # drizzle-kit push

# Seed data
npm run db:seed
```

### Production
- Cung dung `db:push` voi `DRIZZLE_FORCE=true` khi deploy
- KHONG dung migration file (chap nhan data loss risk khi rename column)

### Khi can migration file
- Complex data migration (data transformation)
- Rollback-required change

## Rationale

- Solo dev = iteration tempo cao, migration workflow te te cham
- `db:push` detect diff va apply → 0 manual SQL
- Schema.ts = source of truth

## Consequences

### Tich cuc
- Schema change = sua file, chay 1 lenh
- Type safety (Drizzle infer TS type tu schema)
- 0 migration file clutter

### Tieu cuc
- **Rollback kho**: khong co migration history → revert code khong auto rollback DB
- **Prod data loss risk**: push khi rename column = drop + add (data mat)

### Rui ro
- **Prod data loss**: quen backup truoc push → mitigation: deploy script backup DB truoc
- **Multiple dev**: khong co lock concurrent schema change → solo OK, scale KHONG OK

## Alternatives Considered

### TypeORM migrations
- **Nhuoc**: ton buoc voi solo dev iterate nhanh

### Prisma migrate
- **Uu**: chuan
- **Nhuoc**: Prisma thich Node ESM moi, Drizzle da chon

## References

- `server/src/database/schema.ts`
- Related: LeQuyDon ADR-0001 (TypeORM migration approach)
