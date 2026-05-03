# ADR-0001: Stack — Vue 3 + Express 5 + Drizzle (khac Next+Nest group)

- **Status**: accepted
- **Date**: 2026-02-01
- **Tags**: stack

## Context

WebPhoto la project dau tien trong hoi. Stack Next.js/NestJS chua quyet. Vue va Express la cai dev quen → chon de ship nhanh.

Sau nay cac project khac (LeQuyDon, FashionEcom, VietNet) chon Next+Nest vi SEO + pattern enterprise. WebPhoto giu stack rieng → khong migrate (chi phi khong dang).

## Decision

- **Frontend**: Vue 3 + TypeScript + Vite + Tailwind CSS 4 + Pinia
- **Backend**: Express.js 5 (moi, ESM native) + Drizzle ORM 0.45
- **DB**: MySQL 8
- **Cache + Queue**: Redis 7 + BullMQ
- **Storage**: Cloudflare R2 (dual-backend, ADR-0005)
- **Real-time**: Socket.io 4.8
- **Auth**: JWT jose (thay bcryptjs)
- **Image**: Sharp + dcraw (ADR-0006)
- **Email**: Resend
- **Tests**: Playwright E2E

## Rationale

- Vue 3 + Composition API → don gian hon React hook
- Express 5 ESM native → modern, khong can transpile
- Drizzle > TypeORM cho project photo (type-safe, perf tot cho query nhieu)
- Photo app khong can SEO cao (gallery private, share link) → Vue SPA du

## Consequences

### Tich cuc
- Dev velocity cao (quen stack)
- Bundle FE nho hon Next.js
- Drizzle type-safe → IDE autocomplete tot

### Tieu cuc
- **KHAC stack voi 3 project kia** → khi fix bug cross-project khong reuse code truc tiep
- Vue ecosystem nho hon React trong VN market

## References

- Related: VietNet2026 ADR-0001 (khac: Next+Nest)
- Git-nexus ghi WebPhoto "doc lap, stack khac"
