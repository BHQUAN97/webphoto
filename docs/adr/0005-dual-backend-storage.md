# ADR-0005: Dual-backend storage (R2 + local) voi migration support

- **Status**: accepted
- **Date**: 2026-03-20
- **Tags**: storage, migration

## Context

Bat dau: local disk (phase 1). Sau khi scale: chuyen R2.

Nhung migration khong lam 1 lan:
- Anh moi upload = R2
- Anh cu = local (phai migrate dan)
- Khong downtime

Khac LeQuyDon (ADR-0007: chon 1 cho moi environment), WebPhoto muon **ca 2 active cung luc**.

## Decision

**Dual-backend voi `storageBackend` column**:

### Image entity
```typescript
{
  id: string,
  filename: string,
  url: string,           // public URL (R2 CDN hoac /uploads/)
  storageBackend: 'r2' | 'local',  // moi record khac nhau
  ...
}
```

### Storage provider interface
```typescript
interface StorageProvider {
  upload(key: string, buffer: Buffer, options): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

class R2Provider implements StorageProvider { ... }
class LocalProvider implements StorageProvider { ... }

class StorageService {
  getProvider(backend: 'r2' | 'local'): StorageProvider {
    return backend === 'r2' ? this.r2 : this.local;
  }
}
```

### Read
- Load image → lookup `storageBackend` → getProvider → getUrl/download

### Write
- New uploads → default R2 (env config)
- Legacy: stay on local until migrated

### Migration
- Cron job: chunk 100 local images / hour → download + re-upload R2 → update `storageBackend = 'r2'`, `url` new
- Verify new URL responds 200 → delete local file

## Rationale

- Migration progressive, no downtime
- Rollback possible (neu R2 down = fallback read local)
- Explicit backend tracking per record

## Consequences

### Tich cuc
- Migration zero-downtime
- Legacy data accessible trong suot migration
- Testing moi provider rieng duoc

### Tieu cuc
- Code complexity (2 provider)
- Migration script phai chac chan (mat anh = disaster)

### Rui ro
- **Migration fail mid-way**: record updated `storageBackend='r2'` nhung upload fail → mitigation: 2-phase commit (upload first, verify, then update DB)

## References

- `server/src/utils/storage/`
- Related: ADR-0004 (multipart upload), LeQuyDon ADR-0007 (khac: chon 1)
