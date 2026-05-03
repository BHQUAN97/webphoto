# ADR-0007: Redis INCR/DECR cho quota counter (atomic)

- **Status**: accepted
- **Date**: 2026-04-01
- **Tags**: storage, concurrency

## Context

User co storage quota (Free 1GB, Basic 20GB, Pro 100GB). Moi upload/delete → check quota + update used.

Neu luu `used_bytes` trong `users` table:
- Race condition: 2 upload dong thoi → cung doc 500MB, cung write 600MB → actual la 700MB
- Slow: SELECT + UPDATE moi upload

## Decision

**Redis INCR/DECR**:

### Keys
- `quota:used:{userId}` — bytes dang dung (number)
- `quota:limit:{userId}` — limit plan hien tai

### Flow upload
```typescript
const limit = await redis.get(`quota:limit:${userId}`);
const newUsed = await redis.incrby(`quota:used:${userId}`, fileSize);

if (newUsed > limit) {
  await redis.decrby(`quota:used:${userId}`, fileSize);  // rollback
  throw new ForbiddenException('Quota exceeded');
}

// OK, proceed upload
```

### Flow delete
```typescript
await redis.decrby(`quota:used:${userId}`, fileSize);
```

### Persistence
- Persist: khong TTL (quota luu vinh vien)
- Backup: daily cron recompute `used_bytes` tu DB images table, update Redis → consistency check

### Plan change
- User upgrade plan → update `quota:limit:{userId}`
- Downgrade: check neu used > new limit → warn (khong auto-delete)

## Rationale

- Redis INCR atomic (single-threaded) → no race
- Fast (~1ms)
- Decoupled tu DB transaction

## Consequences

### Tich cuc
- Concurrent upload khong race
- Upload latency giam
- Scale horizontal duoc

### Tieu cuc
- Redis down = quota check unavailable → mitigation: fallback recompute tu DB (slow path)
- Reconciliation needed (daily cron verify vs DB)

### Rui ro
- **Redis data loss** (khong AOF) → mitigation: recompute tu DB images table

## References

- `server/src/utils/redis.ts`
- Related: CROSS-0001 (Redis noeviction)
