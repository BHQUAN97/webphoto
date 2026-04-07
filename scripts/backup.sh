#!/bin/bash
# ============================================
# PHOTO STORAGE — BACKUP DATABASE
# Chay thu cong hoac dat crontab
# Yeu cau: MYSQL_ROOT_PASSWORD env var
# ============================================

set -euo pipefail

BACKUP_DIR="./backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="photo_storage_${DATE}.sql.gz"

if [ -z "${MYSQL_ROOT_PASSWORD:-}" ]; then
  echo "ERROR: MYSQL_ROOT_PASSWORD env var not set"
  echo "Usage: MYSQL_ROOT_PASSWORD=xxx bash scripts/backup.sh"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Backing up database..."
docker exec photo-mysql mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" \
  photo_storage --single-transaction --routines --triggers --events --quick \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

# Verify backup
if [ ! -s "${BACKUP_DIR}/${FILENAME}" ]; then
  echo "ERROR: Backup file is empty!"
  rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

if ! gunzip -t "${BACKUP_DIR}/${FILENAME}" 2>/dev/null; then
  echo "ERROR: Backup file is corrupt!"
  exit 1
fi

# Keep only last 30 backups
ls -t "${BACKUP_DIR}"/photo_storage_*.sql.gz | tail -n +31 | xargs rm -f 2>/dev/null

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "Backup saved: ${BACKUP_DIR}/${FILENAME} (${SIZE})"
