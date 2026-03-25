#!/bin/bash
# ============================================
# SSL Certificate — Lấy cert lần đầu
# Chạy 1 lần trên server production
# ============================================

set -e

DOMAIN="bhquan.site"
EMAIL="${1:-admin@bhquan.site}"

echo "=========================================="
echo "  SSL Init for $DOMAIN"
echo "  Email: $EMAIL"
echo "=========================================="

# 1. Tạo nginx tạm (chỉ serve HTTP cho certbot challenge)
echo ""
echo "1️⃣  Tạo nginx tạm cho certbot challenge..."

mkdir -p nginx/conf.d
cat > nginx/conf.d/temp.conf << 'TMPEOF'
server {
    listen 80;
    server_name bhquan.site api.bhquan.site ws.bhquan.site;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'Setting up SSL...';
        add_header Content-Type text/plain;
    }
}
TMPEOF

# 2. Start nginx tạm
echo "2️⃣  Start nginx..."
docker-compose -f docker-compose.prod.yml up -d nginx

# Wait for nginx
sleep 3

# 3. Lấy certificate
echo "3️⃣  Requesting SSL certificate..."
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "api.$DOMAIN" \
  -d "ws.$DOMAIN"

# 4. Xóa config tạm, dùng config thật
echo "4️⃣  Switching to production nginx config..."
rm -f nginx/conf.d/temp.conf

# 5. Restart nginx với SSL config
docker-compose -f docker-compose.prod.yml restart nginx

echo ""
echo "=========================================="
echo "  ✅ SSL certificate installed!"
echo "  https://$DOMAIN"
echo "  https://api.$DOMAIN"
echo "  https://ws.$DOMAIN"
echo "=========================================="
echo ""
echo "  Certificate auto-renew: certbot container"
echo "=========================================="
