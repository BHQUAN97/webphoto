#!/bin/bash
# ============================================
# PHOTO STORAGE — BUILD SCRIPT
# Build frontend + backend trước khi deploy
# Chạy trên máy dev hoặc trên server
# ============================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=========================================="
echo "  Photo Storage — Build"
echo "=========================================="

# 1. Build Frontend
echo ""
echo "1) Build frontend..."
cd photo-storage
npm ci --silent
npm run build
echo "   ✅ Frontend built → photo-storage/dist/"

# 2. Build Backend
echo ""
echo "2) Build backend..."
cd server
npm ci --silent
npm run build
echo "   ✅ Backend built → photo-storage/server/dist/"

cd "$ROOT_DIR"

echo ""
echo "=========================================="
echo "  ✅ Build hoàn tất!"
echo "=========================================="
echo ""
echo "  Bước tiếp theo (trên server):"
echo "  1. Push DB schema: cd photo-storage/server && npm run db:push"
echo "  2. Chạy Docker:    docker-compose -f docker-compose.prod.yml -f docker-compose.tunnel.yml up -d --build"
echo "  3. Health check:    curl http://localhost:4000/api/health"
echo ""
