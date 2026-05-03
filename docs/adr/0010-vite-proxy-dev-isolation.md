# ADR-0010: Vite dev proxy 4100 thay vi 4000 (isolate auth cookies)

- **Status**: accepted
- **Date**: 2026-04-01
- **Tags**: dev-experience

## Context

Dev local: Vite dev server (port 3000), Express API (port 4000). Proxy `/api/*` → `localhost:4000`.

Van de: khi dev cung may voi prod data (via tunnel) → cookie dev va prod conflict. Cookie set domain=localhost → browser ship cookie ca 2 server.

## Decision

**Vite proxy `/api/*` → `localhost:4100`** (KHONG `4000`):

### Dev config
```ts
// vite.config.ts
proxy: {
  '/api': 'http://localhost:4100'
}
```

### Dev API
- API dev run tren port `4100` (env `PORT=4100` cho dev)
- Prod API van dung 4000

### .env.dev
```
PORT=4100
```

### Lợi ích isolation
- Cookie set o dev (domain localhost:4100) khong cross-talk voi prod (bhquan.site)
- Dev-only middleware (debug toolbar, mock data) khong accidentally o prod path

## Rationale

- Isolation giua dev/prod → tranh misfire
- Port khac → browser tab dev + prod song song OK
- Minimal config overhead

## Consequences

### Tich cuc
- Debug de (port thay doi = biet ngay dev vs prod)
- Cookie khong leak

### Tieu cuc
- Moi dev phai nho dev port 4100 (docs note)
- Prod config khong tuong ung (prod 4000 → reverse proxy `/api`)

## References

- `vite.config.ts`
- Related: CROSS-0002 (port allocation)
