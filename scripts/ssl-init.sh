#!/bin/bash
# ============================================
# SSL Certificate — Lấy cert lần đầu
# Chạy 1 lần trên server production
# ============================================

set -e

DOMAIN="bhquan.site"
EMAIL="${1:-admin@bhquan.site}"

# Helper: use `docker compose` or `docker-compose`
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

COMPOSE_FILES="-f docker-compose.prod.yml"

echo "=========================================="
echo "  SSL Init for $DOMAIN"
echo "  Email: $EMAIL"
echo "=========================================="

# 1. Kill certbot processes cu neu co (tranh trung lap)
echo ""
echo "[1/5] Cleanup certbot cu..."
$DC $COMPOSE_FILES kill certbot 2>/dev/null || true
$DC $COMPOSE_FILES rm -f certbot 2>/dev/null || true

# 2. Tao self-signed placeholder de nginx start duoc
echo "[2/5] Tao placeholder cert..."
for D in ${DOMAIN} bhquan.store; do
  $DC $COMPOSE_FILES run --rm --entrypoint "" certbot sh -c "
    if [ ! -f /etc/letsencrypt/live/${D}/fullchain.pem ]; then
      mkdir -p /etc/letsencrypt/live/${D}
      openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
        -keyout /etc/letsencrypt/live/${D}/privkey.pem \
        -out /etc/letsencrypt/live/${D}/fullchain.pem \
        -subj '/CN=${D}' 2>/dev/null
      echo '  Created placeholder for ${D}'
    else
      echo '  ${D} cert already exists, skip'
    fi
  "
done

# 3. Start nginx (dung placeholder cert hoac cert that)
echo "[3/5] Start nginx..."
$DC $COMPOSE_FILES up -d nginx
sleep 3

# Verify nginx serves ACME challenge path
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/.well-known/acme-challenge/test 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo "   WARN: Nginx khong tra loi port 80. Kiem tra firewall/config."
fi

# 4. Lay certificate that tu Let's Encrypt (timeout 120s)
echo "[4/5] Requesting SSL certificate..."

# Xoa placeholder cert (certbot tu choi ghi de thu muc khong phai cua no)
$DC $COMPOSE_FILES run --rm --entrypoint "" certbot sh -c \
  "rm -rf /etc/letsencrypt/live/${DOMAIN} /etc/letsencrypt/archive/${DOMAIN} /etc/letsencrypt/renewal/${DOMAIN}.conf" 2>/dev/null

set +e
timeout 120 $DC $COMPOSE_FILES run --rm --entrypoint "" certbot \
  certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "api.$DOMAIN" \
  -d "ws.$DOMAIN"
CERT_RC=$?
set -e

if [ $CERT_RC -ne 0 ]; then
  echo ""
  echo "  SSL cert FAILED (exit code $CERT_RC)"
  echo "  Kiem tra:"
  echo "    1. DNS tro dung: dig +short $DOMAIN api.$DOMAIN ws.$DOMAIN"
  echo "    2. Port 80 mo: curl -I http://$DOMAIN/.well-known/acme-challenge/test"
  echo "    3. Rate limit: https://crt.sh/?q=$DOMAIN"
  echo ""
  echo "  Nginx van chay voi self-signed cert (HTTPS warning)."
  exit 1
fi

# 5. Reload nginx voi cert that
echo "[5/5] Reload nginx..."
$DC $COMPOSE_FILES exec -T nginx nginx -s reload 2>/dev/null || $DC $COMPOSE_FILES restart nginx

echo ""
echo "=========================================="
echo "  SSL certificate installed!"
echo "  https://$DOMAIN"
echo "  https://api.$DOMAIN"
echo "  https://ws.$DOMAIN"
echo "=========================================="
echo ""
echo "  Certificate auto-renew: certbot container"
echo "=========================================="
