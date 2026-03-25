#!/bin/bash
# ============================================
# PHOTO STORAGE — BACKUP DATABASE
# Chạy thủ công hoặc đặt crontab
# ============================================

BACKUP_DIR="./backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="photo_storage_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up database..."
docker exec photo-mysql mysqldump -u root -p"${MYSQL_ROOT_PASSWORD:-StrongRootPass2024!}" \
  photo_storage --single-transaction --quick | gzip > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 30 backups
ls -t "${BACKUP_DIR}"/photo_storage_*.sql.gz | tail -n +31 | xargs rm -f 2>/dev/null

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "✅ Backup saved: ${BACKUP_DIR}/${FILENAME} (${SIZE})"
