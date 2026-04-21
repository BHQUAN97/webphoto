#!/bin/bash
# ============================================================
# PHOTO STORAGE — UPDATE DEPLOY
# ============================================================

set -e

VPS_IP="${1:?Usage: bash scripts/update-deploy.sh <vps-ip>}"
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_USER}@${VPS_IP}"
APP_DIR="/opt/webphoto"

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

echo "Updating ${VPS_HOST}..."

# Build
cd photo-storage/server && npm run build
cd ../ && npm run build
cd ../

# Upload
run_scp -r photo-storage/dist "${VPS_HOST}:${APP_DIR}/photo-storage/"
run_scp -r photo-storage/server/dist "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
run_scp photo-storage/server/package.json "${VPS_HOST}:${APP_DIR}/photo-storage/server/"

# Restart
run_ssh "${VPS_HOST}" "cd ${APP_DIR} && docker compose up -d --build"

echo "Update complete!"
