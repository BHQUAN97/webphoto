#!/bin/bash
# ============================================================
# PHOTO STORAGE — UPDATE DEPLOY (Khong setup lai tu dau)
# ============================================================
# Chay tu may local khi can cap nhat code len VPS da deploy
# Chi build lai + upload + restart, KHONG tao DB/Nginx/SSL moi
#
# Usage:
#   bash scripts/update-deploy.sh <vps-ip>
#   bash scripts/update-deploy.sh 213.163.199.176
# ============================================================

set -e

VPS_IP="${1:?Usage: bash scripts/update-deploy.sh <vps-ip>}"
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_USER}@${VPS_IP}"
APP_DIR="/opt/webphoto"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
log() { echo -e "${GREEN}[OK]${NC} $1"; }
step() { echo -e "\n${CYAN}━━━ $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "=== Photo Storage — Update Deploy ==="
echo "  VPS: ${VPS_HOST}"
echo ""

# 1. Build
step "1/4 — Build local"
cd "$ROOT_DIR/photo-storage/server" && npm run build
cd "$ROOT_DIR/photo-storage" && npm run build
cd "$ROOT_DIR"
log "Build OK"

# 2. Upload (clean old dist first to avoid stale cached assets)
step "2/5 — Upload to VPS"
ssh "${VPS_HOST}" "rm -rf ${APP_DIR}/photo-storage/dist ${APP_DIR}/photo-storage/server/dist"
scp -r "$ROOT_DIR/photo-storage/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/"
scp -r "$ROOT_DIR/photo-storage/server/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/package.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/package-lock.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
log "Upload OK"

# 3. Update Nginx config (Docker photo-nginx)
step "3/5 — Update Nginx config"
scp "$ROOT_DIR/nginx/conf.d/bhquan.site.conf" "${VPS_HOST}:${APP_DIR}/nginx/conf.d/bhquan.site.conf" 2>/dev/null && {
  ssh "${VPS_HOST}" "docker exec photo-nginx nginx -t 2>&1 | tail -1 && docker exec photo-nginx nginx -s reload"
  log "Nginx config updated + reloaded"
} || {
  log "Nginx config unchanged (skip)"
}

# 4. Rebuild + Restart
step "4/5 — Rebuild Docker + Restart"
ssh "${VPS_HOST}" "
  # Ensure shared networks (app nào start trước cũng được)
  docker network create webphoto_backend 2>/dev/null || true
  docker network create vietnet_frontend 2>/dev/null || true
  cd ${APP_DIR}
  docker compose -f docker-compose.prod.yml build api worker 2>&1 | tail -5
  docker compose -f docker-compose.prod.yml up -d api worker
  docker exec photo-nginx nginx -s reload 2>/dev/null || true
  echo 'Restarted'
"
log "Containers restarted"

# 5. Run DB changelog (idempotent — safe to run every deploy)
step "5/6 — DB Changelog"
CHANGELOG_DIR="$ROOT_DIR/db/changelog"
if [ -d "$CHANGELOG_DIR" ] && ls "$CHANGELOG_DIR"/V*.sql 1>/dev/null 2>&1; then
  MYSQL_PWD=$(ssh "${VPS_HOST}" "grep '^MYSQL_PASSWORD=' ${APP_DIR}/.env | cut -d= -f2-")
  for f in $(find "$CHANGELOG_DIR" -name 'V*.sql' -type f | sort); do
    FNAME=$(basename "$f")
    echo -n "  $FNAME ... "
    OUTPUT=$(ssh "${VPS_HOST}" "docker exec -i shared-mysql mysql -u photo_user -p${MYSQL_PWD} photo_storage" < "$f" 2>&1)
    if [ $? -eq 0 ]; then
      echo "OK"
    else
      echo "FAILED"
      echo "$OUTPUT" | tail -3 | sed 's/^/    /'
    fi
  done
  log "DB Changelog done"
else
  log "No changelog files (skip)"
fi

# 6. Health check
step "6/6 — Health check"
sleep 5
ssh "${VPS_HOST}" "
  curl -sf https://bhquan.site/api/health && echo ''
  docker compose -f ${APP_DIR}/docker-compose.prod.yml ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null || docker ps --format 'table {{.Names}}\t{{.Status}}'
"
log "Update deploy done!"

echo ""
echo "=== Update complete ==="
echo "  https://$(grep '^DOMAIN=' ${ROOT_DIR}/.env 2>/dev/null | cut -d= -f2- || echo 'bhquan.site')"
echo ""
