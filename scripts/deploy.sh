#!/bin/bash
# ============================================
# PHOTO STORAGE — FULL DEPLOY SCRIPT
# Chạy trên server production
# Usage:
#   bash scripts/deploy.sh          → Deploy with SSL (direct)
#   bash scripts/deploy.sh tunnel   → Deploy with Cloudflare Tunnel
# ============================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-direct}"
COMPOSE_FILES="-f docker-compose.prod.yml"

if [ "$MODE" = "tunnel" ]; then
  COMPOSE_FILES="-f docker-compose.prod.yml -f docker-compose.tunnel.yml"
  echo "=========================================="
  echo "  Photo Storage — Deploy (Cloudflare Tunnel)"
  echo "=========================================="
else
  echo "=========================================="
  echo "  Photo Storage — Deploy (Direct SSL)"
  echo "=========================================="
fi

# 0. Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker chua cai."; exit 1; }
(docker compose version >/dev/null 2>&1 || docker-compose version >/dev/null 2>&1) || { echo "docker-compose chua cai."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js chua cai."; exit 1; }

# Helper: use `docker compose` or `docker-compose`
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

# 0.5 Ensure shared networks exist (app nào start trước cũng được)
echo "[0/8] Ensure shared Docker networks..."
docker network create webphoto_backend 2>/dev/null || true
docker network create vietnet_frontend 2>/dev/null || true

# 1. Check .env
echo ""
echo "[1/8] Kiem tra .env..."
if [ ! -f .env ]; then
  echo "Chua co .env! Copy tu template:"
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

for var in JWT_SECRET R2_ENDPOINT R2_ACCESS_KEY R2_SECRET_KEY RESEND_API_KEY CRON_SECRET; do
  val=$(grep "^$var=" .env | cut -d= -f2-)
  if [ -z "$val" ] || [[ "$val" == *"CHANGE_ME"* ]] || [[ "$val" == *"xxxxx"* ]]; then
    echo "$var chua duoc cau hinh trong .env"
    exit 1
  fi
done

if [ "$MODE" = "tunnel" ]; then
  val=$(grep "^CLOUDFLARE_TUNNEL_TOKEN=" .env | cut -d= -f2-)
  if [ -z "$val" ]; then
    echo "CLOUDFLARE_TUNNEL_TOKEN chua duoc cau hinh trong .env"
    exit 1
  fi
fi
echo "   .env OK"

# 2. Build frontend
echo ""
echo "[2/8] Build frontend..."
cd photo-storage
npm ci --silent 2>/dev/null || npm install --silent
npm run build
cd ..
echo "   Frontend OK"

# 3. Build backend
echo ""
echo "[3/8] Build backend..."
cd photo-storage/server
npm ci --silent 2>/dev/null || npm install --silent
npm run build
cd ../..
echo "   Backend OK"

# 4. Build Docker images
echo ""
echo "[4/8] Build Docker images..."
$DC $COMPOSE_FILES build api worker
echo "   Docker images OK"

# 5. Start infrastructure
echo ""
echo "[5/8] Start MySQL + Redis..."
$DC $COMPOSE_FILES up -d mysql redis
echo "   Waiting for MySQL..."

# Wait for MySQL with retry instead of fixed sleep
for i in $(seq 1 30); do
  if $DC $COMPOSE_FILES exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
    echo "   MySQL ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "   MySQL not ready after 30s, continuing anyway..."
  fi
  sleep 1
done

# 6. Run DB push + seed
echo ""
echo "[6/8] Push database schema..."
cd photo-storage/server
MYSQL_PWD=$(grep "^MYSQL_PASSWORD=" ../../.env | cut -d= -f2-)
DATABASE_URL="mysql://photo_user:${MYSQL_PWD}@localhost:3306/photo_storage" npx drizzle-kit push --force 2>&1 | tail -5
DATABASE_URL="mysql://photo_user:${MYSQL_PWD}@localhost:3306/photo_storage" npm run db:seed 2>/dev/null || echo "   (Seed da chay truoc do, skip)"
cd ../..
echo "   Database OK"

# 7. SSL Certificate (direct mode only)
if [ "$MODE" != "tunnel" ]; then
  echo ""
  echo "[7/9] SSL certificate..."
  DOMAIN="bhquan.site"

  # Check if cert exists in Docker volume
  CERT_EXISTS="no"
  if $DC $COMPOSE_FILES run --rm --entrypoint "" certbot test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem 2>/dev/null; then
    CERT_EXISTS="yes"
  fi

  if [ "$CERT_EXISTS" = "no" ]; then
    echo "   SSL cert not found — generating placeholder + requesting real cert..."

    # Tao self-signed placeholder cho moi domain co SSL config
    # De nginx start duoc trong khi cho Certbot lay cert that
    for D in ${DOMAIN} bhquan.store; do
      $DC $COMPOSE_FILES run --rm --entrypoint "" certbot sh -c "
        mkdir -p /etc/letsencrypt/live/${D}
        openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
          -keyout /etc/letsencrypt/live/${D}/privkey.pem \
          -out /etc/letsencrypt/live/${D}/fullchain.pem \
          -subj '/CN=${D}' 2>/dev/null
      "
    done
    echo "   Placeholder certs created"

    # Start nginx (su dung placeholder cert)
    $DC $COMPOSE_FILES up -d nginx
    sleep 3

    # Request real cert tu Let's Encrypt (timeout 120s)
    set +e
    timeout 120 $DC $COMPOSE_FILES run --rm certbot certonly \
      --webroot -w /var/www/certbot \
      --email admin@${DOMAIN} --agree-tos --no-eff-email \
      --force-renewal \
      -d ${DOMAIN} -d api.${DOMAIN} -d ws.${DOMAIN}
    CERT_RC=$?
    set -e

    if [ $CERT_RC -eq 0 ]; then
      echo "   SSL certificate installed!"
      # Reload nginx to use real cert
      $DC $COMPOSE_FILES exec -T nginx nginx -s reload 2>/dev/null || true
    else
      echo "   SSL cert failed (code $CERT_RC). Site chay voi self-signed cert."
      echo "   Retry sau: bash scripts/ssl-init.sh"
    fi
  else
    echo "   SSL certificate found"
  fi
else
  echo ""
  echo "[7/9] SSL skipped (tunnel mode)"
fi

# 8. Start all services
echo ""
echo "[8/9] Start all services..."
$DC $COMPOSE_FILES up -d
echo "   All services started"

# 9. Health check
echo ""
echo "[9/9] Health check..."
sleep 3

# Try multiple ways to reach the API
HTTP_CODE="000"
for endpoint in "http://localhost:4000/api/health" "http://127.0.0.1:4000/api/health"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then break; fi
done

if [ "$HTTP_CODE" = "200" ]; then
  echo "   API healthy (HTTP 200)"
else
  # API might not be exposed on host, check via docker
  DOCKER_HEALTH=$($DC $COMPOSE_FILES exec -T api curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "000")
  if [ "$DOCKER_HEALTH" = "200" ]; then
    echo "   API healthy (via Docker)"
  else
    echo "   API chua san sang (HTTP $HTTP_CODE), kiem tra logs:"
    echo "   $DC $COMPOSE_FILES logs api --tail 50"
  fi
fi

echo ""
echo "=========================================="
echo "  Deploy hoan tat!"
echo "=========================================="
echo ""
echo "  Services:"
echo "    MySQL:       running (3306)"
echo "    Redis:       running (6379)"
echo "    API:         running (4000)"
echo "    Worker:      running (background)"
if [ "$MODE" = "tunnel" ]; then
echo "    Cloudflared: running (tunnel)"
echo "    Nginx:       running (internal)"
else
echo "    Nginx:       running (80/443)"
fi
echo ""
echo "  URLs:"
echo "    Frontend: https://bhquan.site"
echo "    API:      https://bhquan.site/api/health"
echo "    Admin:    https://bhquan.site/admin"
echo ""
echo "  Commands:"
echo "    Logs:     $DC $COMPOSE_FILES logs -f"
echo "    Stop:     $DC $COMPOSE_FILES down"
echo "    Restart:  $DC $COMPOSE_FILES restart api worker"
echo "=========================================="
