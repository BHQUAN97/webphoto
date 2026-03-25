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

# 2. Upload
step "2/5 — Upload to VPS"
scp -r "$ROOT_DIR/photo-storage/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/"
scp -r "$ROOT_DIR/photo-storage/server/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/package.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/package-lock.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
log "Upload OK"

# 3. Update Nginx config (BT Panel path)
step "3/5 — Update Nginx config"
NGINX_CONF="/www/server/panel/vhost/nginx/bhquan.site.conf"
scp "$ROOT_DIR/nginx/conf.d/bhquan.site.conf" "${VPS_HOST}:${NGINX_CONF}" 2>/dev/null && {
  ssh "${VPS_HOST}" "nginx -t && nginx -s reload"
  log "Nginx config updated + reloaded"
} || {
  log "Nginx config unchanged (skip)"
}

# 4. Rebuild + Restart
step "4/5 — Rebuild Docker + Restart"
ssh "${VPS_HOST}" "
  cd ${APP_DIR}
  docker compose build api worker 2>&1 | tail -5
  docker compose up -d api worker
  echo 'Restarted'
"
log "Containers restarted"

# 5. Health check
step "5/5 — Health check"
sleep 5
ssh "${VPS_HOST}" "
  curl -sf http://localhost:4000/api/health && echo ''
  docker compose -f ${APP_DIR}/docker-compose.yml ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null || docker ps --format 'table {{.Names}}\t{{.Status}}'
"
log "Update deploy done!"

echo ""
echo "=== Update complete ==="
echo "  https://$(grep '^DOMAIN=' ${ROOT_DIR}/.env 2>/dev/null | cut -d= -f2- || echo 'bhquan.site')"
echo ""
