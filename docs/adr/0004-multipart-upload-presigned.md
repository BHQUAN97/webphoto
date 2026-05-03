# ADR-0004: Multipart upload 10MB chunks voi presigned URL

- **Status**: accepted
- **Date**: 2026-03-15
- **Tags**: upload, performance

## Context

User upload RAW photo (CR2/ARW/NEF/DNG) thuong 30-50MB, co khi 100MB. Options:
1. **Upload qua BE** → BE receive full file → upload R2
   - Nhuoc: BE memory pressure, network bottleneck
2. **Presigned URL single part** → client upload truc tiep R2
   - Nhuoc: 1 request = timeout cho file lon
3. **Multipart upload** → chunk 10MB, parallel upload → R2 combine
   - Uu: resilient, fast, khong qua BE

## Decision

**S3 Multipart upload** voi **10MB chunks**:

### Flow
1. `POST /api/images/upload-url` voi `{ filename, size, albumId, mimeType }`
   - BE tao multipart upload trong R2, return `{ imageId, uploadId, presignedUrls[] }`
   - `presignedUrls` = array voi N entries (N = ceil(size / 10MB))
2. Client upload song song tung chunk qua PUT presignedUrls[i]
   - Progress tracker per chunk
3. `POST /api/images/complete` voi `{ imageId, parts: [{ PartNumber, ETag }] }`
   - BE call `completeMultipartUpload` tren R2
   - Create BullMQ `image-process` job
4. Worker process (dcraw, Sharp, R2 public) → update DB `status='ready'`
5. Socket emit `image:ready` to user

### Client
- AWS SDK browser v3 (hoac fetch raw)
- Parallel upload (4 chunks cung luc)
- Retry failed chunk
- Abort support

## Rationale

- BE khong receive file content → giam memory + network
- Parallel chunks → upload 100MB file ~10s voi broadband
- Resilient: fail 1 chunk → retry chi chunk do

## Consequences

### Tich cuc
- Upload lon (100MB+) OK, khong timeout
- BE scale khong bi upload bandwidth bottleneck
- UX: progress bar per chunk chinh xac

### Tieu cuc
- Complex client code
- Phai track parts + ETag de complete
- R2 orphan multipart neu client abort giua chung → cleanup cron

### Rui ro
- **Orphan multipart**: user abort, server crash → R2 giu chunk → mitigation: cron daily list + abort incomplete uploads > 24h

## References

- `frontend/src/composables/useUpload.ts`
- `server/src/routes/images/`
- Related: ADR-0005 (storage backend), ADR-0009 (worker)
