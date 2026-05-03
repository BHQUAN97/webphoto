# WebPhoto — Architecture Decision Records

> Photo sharing app (bhquan.site). Vue 3 + Express.js 5 + MySQL + Redis + Drizzle ORM + Cloudflare R2.

## Index

- [ADR-0001](0001-vue-express-drizzle.md) — Stack: Vue 3 + Express 5 + Drizzle (khac Next+Nest)
- [ADR-0002](0002-drizzle-orm-push-pattern.md) — Drizzle ORM `db:push` thay vi TypeORM migration
- [ADR-0003](0003-auto-ask-mode-governance.md) — AUTO/ASK mode cho Claude Code workflow
- [ADR-0004](0004-multipart-upload-presigned.md) — Multipart upload 10MB chunks voi presigned URL
- [ADR-0005](0005-dual-backend-storage.md) — Dual-backend storage (R2 + local) voi migration support
- [ADR-0006](0006-dcraw-raw-image-pipeline.md) — dcraw cho RAW photo + Sharp WebP pipeline
- [ADR-0007](0007-redis-quota-counter-incr.md) — Redis INCR/DECR cho quota counter (atomic)
- [ADR-0008](0008-pinia-zustand-alt.md) — Pinia stores (Vue equivalent cua Zustand)
- [ADR-0009](0009-bullmq-photo-worker-service.md) — BullMQ worker service tach ra khoi API
- [ADR-0010](0010-vite-proxy-dev-isolation.md) — Vite dev proxy 4100 thay vi 4000 (isolate auth cookies)
