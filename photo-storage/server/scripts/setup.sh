#!/bin/bash
# ============================================
# PHOTO STORAGE — SETUP SCRIPT
# Chạy 1 lần khi cài đặt lần đầu
# ============================================

set -e

echo "=========================================="
echo "  Photo Storage — Setup"
echo "=========================================="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js chưa cài. Cần Node 20+"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm chưa cài."; exit 1; }

echo ""
echo "1️⃣  Kiểm tra .env file..."
if [ ! -f .env ]; then
  echo "   Tạo .env từ .env.example..."
  cp .env.example .env
  echo "   ⚠️  Hãy sửa .env với thông tin thật trước khi tiếp tục!"
  echo "   Mở file: $(pwd)/.env"
  echo ""
  read -p "   Đã sửa xong .env? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "   Thoát. Hãy sửa .env rồi chạy lại script."
    exit 0
  fi
fi

echo ""
echo "2️⃣  Cài dependencies..."
npm ci

echo ""
echo "3️⃣  Build TypeScript..."
npm run build

echo ""
echo "4️⃣  Push database schema..."
echo "   (Đảm bảo MySQL đang chạy và DATABASE_URL đúng)"
npm run db:push

echo ""
echo "5️⃣  Generate migrations..."
npm run db:generate

echo ""
echo "6️⃣  Seed database (plans + settings + admin)..."
npm run db:seed

echo ""
echo "=========================================="
echo "  ✅ Setup hoàn tất!"
echo "=========================================="
echo ""
echo "  Admin login:"
echo "    Email:    admin@photostorage.com"
echo "    Password: admin123"
echo "    ⚠️  ĐỔI MẬT KHẨU NGAY sau khi đăng nhập!"
echo ""
echo "  Chạy server:  npm run dev"
echo "  Chạy worker:  npx tsx src/workers/start.ts"
echo "=========================================="
