#!/bin/bash
# ============================================================
# PHOTO STORAGE — QUICK DEPLOY TO NEW VPS
# ============================================================
# Script chạy TỪ MÁY LOCAL (Windows/Mac/Linux)
# Tự động deploy toàn bộ lên VPS Ubuntu mới
#
# Yêu cầu VPS:
#   - Ubuntu 22.04/24.04
#   - User & Password SSH (hoặc SSH Key)
#   - Có Docker + Docker Compose
#
# Usage:
#   export SSHPASS="your_password" (nếu dùng password)
#   bash scripts/quick-deploy.sh <vps-ip> [domain]
# ============================================================

set -e

# ─── ARGUMENTS ────────────────────────────────────────────
VPS_IP="${1:?Usage: bash scripts/quick-deploy.sh <vps-ip> [domain]}"
DOMAIN="${2:-bhquan.site}"
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_USER}@${VPS_IP}"
APP_DIR="/opt/webphoto"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# Helper function for SSH/SCP with optional password
run_ssh() {
  if [ -n "$SSHPASS" ]; then
    sshpass -e ssh -o StrictHostKeyChecking=no "$@"
  else
    ssh "$@"
  fi
}

run_scp() {
  if [ -n "$SSHPASS" ]; then
    sshpass -e scp -o StrictHostKeyChecking=no "$@"
  else
    scp "$@"
  fi
}

# Detect project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "============================================================"
echo "  PHOTO STORAGE — Quick Deploy (Password Support)"
echo "  VPS:    ${VPS_HOST}"
echo "  Domain: ${DOMAIN}"
echo "============================================================"

# ─── STEP 0: PRE-FLIGHT CHECKS ───────────────────────────
step "0/8 — Kiem tra truoc khi deploy"

# Check SSH
run_ssh "${VPS_HOST}" "echo SSH_OK" >/dev/null 2>&1 || err "Khong the SSH vao ${VPS_HOST}. Kiem tra password/SSH key."
log "SSH connection OK"

# Check .env
[ -f .env ] || err "Chua co .env! Copy: cp .env.example .env && sua thong tin"
log ".env found"

# Check Docker on VPS
run_ssh "${VPS_HOST}" "docker --version && docker compose version" >/dev/null 2>&1 || err "VPS chua cai Docker."
log "Docker on VPS OK"

# ─── STEP 1: BUILD LOCAL ──────────────────────────────────
step "1/8 — Build frontend + backend (local)"

echo "  Building backend..."
cd "$ROOT_DIR/photo-storage/server"
npm install && npm run build
log "Backend built"

echo "  Building frontend..."
cd "$ROOT_DIR/photo-storage"
npm install && npm run build
log "Frontend built"

cd "$ROOT_DIR"

# ─── STEP 2: PREPARE VPS ──────────────────────────────────
step "2/8 — Chuan bi VPS"

run_ssh "${VPS_HOST}" "
  mkdir -p ${APP_DIR}/photo-storage/server
  if command -v ufw &>/dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
  fi
  echo 'VPS ready'
"
log "VPS prepared"

# ─── STEP 3: UPLOAD FILES ─────────────────────────────────
step "3/8 — Upload files len VPS"

run_scp "$ROOT_DIR/.env" "${VPS_HOST}:${APP_DIR}/"
run_scp "$ROOT_DIR/docker-compose.prod.yml" "${VPS_HOST}:${APP_DIR}/docker-compose.yml"
run_scp -r "$ROOT_DIR/photo-storage/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/"
run_scp "$ROOT_DIR/photo-storage/server/Dockerfile" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
run_scp "$ROOT_DIR/photo-storage/server/package.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
run_scp -r "$ROOT_DIR/photo-storage/server/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"

log "All files uploaded"

# ─── STEP 4: START DOCKER ─────────────────────────────────
step "4/8 — Khoi dong Docker containers"

run_ssh "${VPS_HOST}" "
  cd ${APP_DIR}
  docker compose up -d --build
"
log "Docker services started"

step "DEPLOY HOAN THANH!"
echo "Truy cap: http://${DOMAIN} (hoac https neu da config SSL)"
