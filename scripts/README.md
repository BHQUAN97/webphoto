# Scripts — WebPhoto

Backup / restore / ops tooling cho WebPhoto. Tat ca script duoc viet bash + `set -euo pipefail`.

## Muc luc

| Script | Muc dich |
|---|---|
| `backup-mysql.sh` | Dump MySQL gzipped, retention 7 ngay, optional rclone upload |
| `restore-mysql.sh` | Restore dump `.sql.gz` vao container MySQL (interactive hoac tu arg) |
| `backup-gdrive.sh` / `backup-gdrive.js` | Sync DB dump + uploads zip len Google Drive qua Service Account |
| `backup.sh.old` | Script backup cu (giu lam tham chieu, khong dung nua) |
| `deploy.sh` / `quick-deploy.sh` / `update-deploy.sh` | Docker compose deploy workflows |
| `db-changelog.sh` | Ghi log migration applied |

---

## 1. `backup-mysql.sh`

Dump database va nen `.sql.gz` vao `BACKUP_DIR`. Xoa backup cu hon `RETENTION_DAYS`. Neu co `rclone` se upload len remote `r2:webphoto-backups/mysql/`.

### Usage
```bash
# One-shot manual
./scripts/backup-mysql.sh

# Override config qua env vars
BACKUP_DIR=/tmp/webphoto-backups DB_NAME=photo_storage RETENTION_DAYS=14 ./scripts/backup-mysql.sh

# Password: dat MYSQL_BACKUP_PASSWORD hoac luu MYSQL_PASSWORD vao /opt/webphoto/.env
export MYSQL_BACKUP_PASSWORD='xxx'
./scripts/backup-mysql.sh
```

### Env vars
- `BACKUP_DIR` (default `/opt/webphoto/backups/mysql`)
- `RETENTION_DAYS` (default `7`)
- `DB_CONTAINER` (default `shared-mysql`)
- `DB_NAME` (default `photo_storage`)
- `DB_USER` (default `photo_user`)
- `MYSQL_BACKUP_PASSWORD` — bat buoc (hoac doc tu `/opt/webphoto/.env`)

### Output
- File: `${BACKUP_DIR}/${DB_NAME}_YYYY-MM-DD_HH-MM.sql.gz`
- Log: `/var/log/webphoto/backup.log`

---

## 2. `restore-mysql.sh`

Restore backup `.sql.gz` vao container MySQL. Verify gzip integrity, prompt confirmation, ghi log start/end/duration.

### Usage
```bash
# Interactive: script liet ke tat ca backup va cho chon
./scripts/restore-mysql.sh

# Restore file cu the
./scripts/restore-mysql.sh /opt/webphoto/backups/mysql/photo_storage_2026-04-17_02-00.sql.gz

# Skip confirmation (dung cho CI / automation)
./scripts/restore-mysql.sh /opt/webphoto/backups/mysql/photo_storage_2026-04-17_02-00.sql.gz --force
```

### Exit codes
| Code | Nghia |
|---|---|
| 0 | Success |
| 1 | File not found / directory missing |
| 2 | Gzip corrupted (`gunzip -t` fail) |
| 3 | MySQL restore failed / container khong chay / khong co password |
| 4 | User aborted (khong confirm hoac chon `q`) |

### Env vars
Cung nhom nhu backup + `LOG_FILE` (default `/var/log/webphoto/restore.log`).

---

## 3. `backup-gdrive.sh` + `backup-gdrive.js`

Upload DB dump (`.sql.gz`) va uploads (zip cua `photo-storage/server/data/storage/`) len Google Drive qua Service Account. Rotation giu `GDRIVE_KEEP_COUNT` ban moi nhat, xoa cu hon.

### Setup lan dau
1. Cai deps: `cd scripts && npm install`
2. Theo huong dan trong `scripts/.gdrive-credentials.example.json` de tao GCP service account
3. Dat JSON tai `scripts/.gdrive-credentials.json` (gitignored)
4. Cau hinh `.env`:
   ```
   GDRIVE_ENABLED=true
   GDRIVE_FOLDER_ID=<folder_id_tu_gdrive_url>
   ```

### Usage
```bash
# Backup ca DB + media
./scripts/backup-gdrive.sh

# Chi DB
./scripts/backup-gdrive.sh db

# Chi media
./scripts/backup-gdrive.sh media

# Dry-run (khong upload, in hanh dong)
node scripts/backup-gdrive.js --dry-run

# Force (bypass GDRIVE_ENABLED=false)
node scripts/backup-gdrive.js --force
```

### Env vars
- `GDRIVE_ENABLED` (default `false`)
- `GDRIVE_CREDENTIALS_PATH` (default `./scripts/.gdrive-credentials.json`)
- `GDRIVE_FOLDER_ID` — bat buoc
- `GDRIVE_DB_SUBFOLDER` (default `database`)
- `GDRIVE_UPLOADS_SUBFOLDER` (default `media`)
- `GDRIVE_KEEP_COUNT` (default `14`)
- `BACKUP_DIR` (default `/opt/webphoto/backups`)
- `UPLOADS_DIR` (default `./photo-storage/server/data/storage`)

---

## Cron setup

Tren VPS:

```cron
# Backup MySQL moi dem luc 2h sang
0 2 * * * /opt/webphoto/scripts/backup-mysql.sh >> /var/log/webphoto/backup.log 2>&1

# Sync len Google Drive luc 3h sang
0 3 * * * /opt/webphoto/scripts/backup-gdrive.sh all >> /var/log/webphoto/gdrive-backup.log 2>&1
```

Cai dat:
```bash
crontab -e
# paste cac dong tren, save
crontab -l   # verify
```

---

## Troubleshooting

### `ERROR: MYSQL_BACKUP_PASSWORD env var not set`
- Export env var truoc khi chay, hoac dam bao `/opt/webphoto/.env` co dong `MYSQL_PASSWORD=...`.

### `Container "shared-mysql" khong chay`
- `docker ps` kiem tra ten container. Override qua env: `DB_CONTAINER=webphoto-mysql-1 ./restore-mysql.sh ...`.

### `File gzip bi corrupt`
- `gunzip -t file.sql.gz` de verify thu cong. Neu corrupt thi file dump loi — lay backup khac.

### Restore xong nhung app van doc du lieu cu
- Xoa cache Redis: `docker exec shared-redis redis-cli FLUSHDB`
- Restart backend: `docker restart photo-api` (prod)

### WebPhoto dung Cloudflare R2 lam storage chinh
- File anh luu tren R2 bucket `webphoto` / `webphoto-public`, KHONG phai tren local disk.
- Local storage `photo-storage/server/data/storage/` chi dung khi switch backend (local mode) trong admin settings.
- Neu storage_backend=r2 (mac dinh), viec zip `data/storage` co the rong. Backup rieng R2 bucket bang `rclone` neu can.

### Permission denied khi chay restore
- `chmod +x scripts/restore-mysql.sh`
- Tren Windows dung Git Bash / WSL, khong dung cmd.exe.
