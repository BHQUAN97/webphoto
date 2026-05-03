# ADR-0006: dcraw cho RAW photo + Sharp WebP pipeline

- **Status**: accepted
- **Date**: 2026-03-25
- **Tags**: image-processing

## Context

User upload RAW (Canon CR2, Sony ARW, Nikon NEF, DNG) — Sharp khong doc duoc. Phai convert RAW → TIFF/JPEG truoc khi Sharp xu ly.

## Decision

**dcraw → Sharp pipeline**:

### Flow (trong image-process worker)
1. Fetch original tu R2 (upload o ADR-0004)
2. **Detect MIME**: neu la `image/x-canon-cr2`, `image/x-sony-arw`, `image/x-nikon-nef`, `image/x-adobe-dng`:
   - `dcraw -c -w -T input.raw > output.tiff`
     - `-c`: output to stdout
     - `-w`: white balance from camera
     - `-T`: output TIFF
3. **Sharp pipeline**:
   ```typescript
   const pipeline = sharp(buffer);
   const thumb = pipeline.clone().resize(400, 400, { fit: 'cover' }).webp({ quality: 80 });
   const preview = pipeline.clone().resize(1920, null, { fit: 'inside' }).webp({ quality: 85 });
   ```
4. Upload thumb + preview to **R2 public** bucket
5. Original RAW stay in **R2 private** (only owner download)
6. Update DB: status='ready', urls, metadata (width/height)

### Binary
- `dcraw` installed in Docker image worker (Ubuntu package)
- Worker Dockerfile: `RUN apt-get install -y dcraw`

## Rationale

- Sharp native khong support RAW
- dcraw standard tool (used by Lightroom backend too)
- Preview WebP: ~85% smaller than TIFF, good quality
- Thumb 400px: grid 3-col mobile

## Consequences

### Tich cuc
- Support moi major RAW format
- WebP + R2 CDN = photo load fast
- Original preserve (RAW edit lai duoc)

### Tieu cuc
- dcraw dependency (khong portable pure Node)
- RAW conversion slow (~3-5s per photo) → workers concurrency han che

### Rui ro
- **Corrupt RAW**: dcraw crash → mitigation: try/catch, fail job gracefully

## References

- `server/src/workers/imageProcessor.ts`
- Related: ADR-0004 (multipart upload), ADR-0005 (storage)
