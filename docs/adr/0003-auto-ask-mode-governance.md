# ADR-0003: AUTO/ASK mode cho Claude Code workflow

- **Status**: accepted
- **Date**: 2026-02-20
- **Tags**: ai-workflow, governance

## Context

Claude Code co the chay automatic (approved tools), nhung co action destructive (xoa file, deploy prod, modify DB) can human approval. Neu ask tat ca = cham, neu auto tat ca = rui ro.

## Decision

**AUTO/ASK mode** trong `CLAUDE.md` (ghi cu the rang buoc):

### AUTO mode (khong hoi)
- Doc file
- Chay build, typecheck, lint, test
- Tao/sua code trong `src/`, `server/src/`
- Cai npm package (non-global)
- Doc `.env.example`

### ASK mode (phai hoi xac nhan)
- Xoa file/folder
- Chay prod DB migration (`db:push`, `db:migrate`)
- SSH vao VPS
- Deploy production
- Sua prod `.env`
- Delete data / reset Redis cache
- Git commit + push
- Bat ky action irreversible

## Rationale

- AUTO cho action safe → solo dev work nhanh
- ASK cho action irreversible → user control
- Ghi ro → Claude khong phai guess boundary

## Consequences

### Tich cuc
- Dev velocity cao cho tasks thong thuong
- An toan cho action manh
- Consistent: moi phien Claude hanh xu giong nhau

### Tieu cuc
- Phai maintain list AUTO/ASK
- Edge case: "restart PM2 tren VPS" = SSH + action → ASK (nhung thuong xuyen)

## References

- `CLAUDE.md` (root repo)
- Related: Global CLAUDE.md "Pham vi TU QUYET / PHAI DUNG"
