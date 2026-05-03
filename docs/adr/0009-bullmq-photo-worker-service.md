# ADR-0009: BullMQ worker service tach ra khoi API

- **Status**: accepted
- **Date**: 2026-03-30
- **Tags**: async, infra

## Context

API server lam 2 viec: HTTP + BullMQ workers. Van de:
- Image processing CPU-heavy (Sharp, dcraw) → block event loop → HTTP latency tang
- Restart API = mat job dang chay

## Decision

**Tach `photo-worker` service** khac voi `photo-api`:

### Containers
- `photo-api` — Express HTTP server, goi bullmq `queue.add()`
- `photo-worker` — BullMQ Worker only, process jobs
- Cung dung shared Redis

### Workers trong `photo-worker`
1. **imageProcessor** — dcraw + Sharp + R2 upload (concurrency 3)
2. **imageExpiry** — cron 2AM delete expired images
3. **emailSender** — Resend email (Password reset, upload done notify)
4. **storageMonitor** — hourly metrics (total storage used, per-user top 10)
5. **driveImportWorker** (optional) — Google Drive import

### Scale
- `photo-worker` replicas khi can: `docker-compose up -d --scale photo-worker=3`
- `photo-api` stateless, scale rieng

## Rationale

- HTTP latency khong bi CPU work lam cham
- Restart API safe (worker tiep tuc chay)
- Scale rieng theo bottleneck

## Consequences

### Tich cuc
- API response time on dinh
- Deployment: rolling restart api khong mat job
- Resource allocation linh hoat (worker need more CPU, API need more memory)

### Tieu cuc
- 2 container vs 1 → them maintenance
- Env duplicate (db, redis, r2 cau hinh o 2 cho)

## References

- `server/src/workers/`
- `docker-compose.prod.yml` 2 services
- Related: ADR-0004 (multipart upload emit job)
