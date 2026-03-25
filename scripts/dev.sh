#!/bin/bash
# ============================================
# PHOTO STORAGE — START ALL DEV SERVICES
# ============================================

set -e

echo "=========================================="
echo "  Photo Storage — Dev Mode"
echo "=========================================="

# Check if Docker services are running
if command -v docker &>/dev/null; then
  echo "1️⃣  Starting MySQL + Redis (Docker)..."
  cd "$(dirname "$0")/.."
  docker-compose up -d mysql redis 2>/dev/null || echo "   ⚠️  Docker not available, make sure MySQL + Redis are running manually"
fi

echo ""
echo "2️⃣  Starting Backend API (port 4000)..."
cd "$(dirname "$0")/../photo-storage/server"
npm run dev &
API_PID=$!

echo ""
echo "3️⃣  Starting Worker..."
npx tsx src/workers/start.ts &
WORKER_PID=$!

echo ""
echo "4️⃣  Starting Frontend (port 3000)..."
cd "$(dirname "$0")/../photo-storage"
npm run dev &
FE_PID=$!

echo ""
echo "=========================================="
echo "  ✅ All services started!"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:4000"
echo "  API docs:  http://localhost:4000/api/health"
echo "=========================================="
echo ""
echo "  Press Ctrl+C to stop all"

# Wait and cleanup on exit
trap "kill $API_PID $WORKER_PID $FE_PID 2>/dev/null; echo '  Stopped.'; exit 0" SIGINT SIGTERM
wait
