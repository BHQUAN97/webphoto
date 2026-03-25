#!/bin/bash
# ============================================================
# PHOTO STORAGE — QUICK DEPLOY TO NEW VPS
# ============================================================
# Script chạy TỪ MÁY LOCAL (Windows/Mac/Linux)
# Tự động deploy toàn bộ lên VPS Ubuntu mới
#
# Yêu cầu VPS:
#   - Ubuntu 22.04/24.04
#   - SSH key đã cấu hình (không cần nhập password)
#   - Có Docker + Docker Compose
#
# Usage:
#   bash scripts/quick-deploy.sh <vps-ip> [domain]
#
# Ví dụ:
#   bash scripts/quick-deploy.sh 213.163.199.176 bhquan.site
#   bash scripts/quick-deploy.sh 45.67.89.10 photos.example.com
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

# Detect project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "============================================================"
echo "  PHOTO STORAGE — Quick Deploy"
echo "  VPS:    ${VPS_HOST}"
echo "  Domain: ${DOMAIN}"
echo "  Source: ${ROOT_DIR}"
echo "============================================================"

# ─── STEP 0: PRE-FLIGHT CHECKS ───────────────────────────
step "0/8 — Kiem tra truoc khi deploy"

# Check SSH
ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_HOST}" "echo SSH_OK" 2>/dev/null || err "Khong the SSH vao ${VPS_HOST}. Kiem tra SSH key."
log "SSH connection OK"

# Check .env
[ -f .env ] || err "Chua co .env! Copy: cp .env.example .env && sua thong tin"
log ".env found"

# Check Docker on VPS
ssh "${VPS_HOST}" "docker --version && docker compose version" >/dev/null 2>&1 || err "VPS chua cai Docker. Chay: curl -fsSL https://get.docker.com | sh"
log "Docker on VPS OK"

# ─── STEP 1: BUILD LOCAL ──────────────────────────────────
step "1/8 — Build frontend + backend (local)"

echo "  Building backend..."
cd "$ROOT_DIR/photo-storage/server"
npm run build
log "Backend built"

echo "  Building frontend..."
cd "$ROOT_DIR/photo-storage"
npm run build
log "Frontend built"

cd "$ROOT_DIR"

# ─── STEP 2: PREPARE VPS ──────────────────────────────────
step "2/8 — Chuan bi VPS"

ssh "${VPS_HOST}" "
  # Tao thu muc
  mkdir -p ${APP_DIR}/photo-storage/server

  # Mo firewall
  if command -v ufw &>/dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
  fi

  # Cai certbot neu chua co
  if ! command -v certbot &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq certbot 2>/dev/null
  fi

  echo 'VPS ready'
"
log "VPS prepared"

# ─── STEP 3: UPLOAD FILES ─────────────────────────────────
step "3/8 — Upload files len VPS"

echo "  Uploading .env + docker-compose..."
scp "$ROOT_DIR/.env" "${VPS_HOST}:${APP_DIR}/"
scp "$ROOT_DIR/docker-compose.prod.yml" "${VPS_HOST}:${APP_DIR}/"

echo "  Uploading frontend dist..."
scp -r "$ROOT_DIR/photo-storage/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/"

echo "  Uploading backend files..."
scp "$ROOT_DIR/photo-storage/server/Dockerfile" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/Dockerfile.worker" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/package.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/package-lock.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp -r "$ROOT_DIR/photo-storage/server/dist" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"

echo "  Uploading source (for db:push + seed)..."
scp -r "$ROOT_DIR/photo-storage/server/src" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/drizzle.config.ts" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"
scp "$ROOT_DIR/photo-storage/server/tsconfig.json" "${VPS_HOST}:${APP_DIR}/photo-storage/server/"

log "All files uploaded"

# ─── STEP 4: CREATE DOCKER COMPOSE (VPS-optimized) ────────
step "4/8 — Tao docker-compose cho VPS"

ssh "${VPS_HOST}" "cat > ${APP_DIR}/docker-compose.yml << 'COMPOSEEOF'
services:

  mysql:
    image: mysql:8.0
    container_name: photo-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-StrongRootPass2024!}
      MYSQL_DATABASE: photo_storage
      MYSQL_USER: photo_user
      MYSQL_PASSWORD: \${MYSQL_PASSWORD:-StrongUserPass2024!}
    volumes:
      - mysql_data:/var/lib/mysql
    command: >
      --default-authentication-plugin=mysql_native_password
      --innodb-buffer-pool-size=256M
      --max-connections=100
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - backend

  redis:
    image: redis:7-alpine
    container_name: photo-redis
    restart: always
    command: redis-server --maxmemory 128mb --maxmemory-policy noeviction --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  api:
    build:
      context: ./photo-storage/server
      dockerfile: Dockerfile
    container_name: photo-api
    restart: always
    ports:
      - '4000:4000'
      - '4001:4001'
    environment:
      PORT: 4000
      NODE_ENV: production
      DATABASE_URL: mysql://photo_user:\${MYSQL_PASSWORD:-StrongUserPass2024!}@mysql:3306/photo_storage
      REDIS_URL: redis://redis:6379
      JWT_SECRET: \${JWT_SECRET}
      R2_ENDPOINT: \${R2_ENDPOINT}
      R2_ACCESS_KEY: \${R2_ACCESS_KEY}
      R2_SECRET_KEY: \${R2_SECRET_KEY}
      R2_PRIVATE_BUCKET: webphoto
      R2_PUBLIC_BUCKET: webphoto-public
      R2_LIMIT_GB: 10
      CDN_URL: https://pub-5bee544ff1d1411bb92b8acd71487437.r2.dev
      RESEND_API_KEY: \${RESEND_API_KEY}
      FROM_EMAIL: noreply@\${DOMAIN:-bhquan.site}
      APP_NAME: PhotoStorage
      APP_URL: https://\${DOMAIN:-bhquan.site}
      APP_ADDRESS: Vietnam
      SUPPORT_PHONE: \${SUPPORT_PHONE:-0123456789}
      SUPPORT_EMAIL: support@\${DOMAIN:-bhquan.site}
      ADMIN_EMAILS: \${ADMIN_EMAILS:-admin@bhquan.site}
      CORS_ORIGIN: https://\${DOMAIN:-bhquan.site}
      SOCKET_PORT: 4001
      CRON_SECRET: \${CRON_SECRET}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - backend

  worker:
    build:
      context: ./photo-storage/server
      dockerfile: Dockerfile.worker
    container_name: photo-worker
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://photo_user:\${MYSQL_PASSWORD:-StrongUserPass2024!}@mysql:3306/photo_storage
      REDIS_URL: redis://redis:6379
      R2_ENDPOINT: \${R2_ENDPOINT}
      R2_ACCESS_KEY: \${R2_ACCESS_KEY}
      R2_SECRET_KEY: \${R2_SECRET_KEY}
      R2_PRIVATE_BUCKET: webphoto
      R2_PUBLIC_BUCKET: webphoto-public
      R2_LIMIT_GB: 10
      CDN_URL: https://pub-5bee544ff1d1411bb92b8acd71487437.r2.dev
      RESEND_API_KEY: \${RESEND_API_KEY}
      FROM_EMAIL: noreply@\${DOMAIN:-bhquan.site}
      APP_NAME: PhotoStorage
      APP_URL: https://\${DOMAIN:-bhquan.site}
      SUPPORT_PHONE: \${SUPPORT_PHONE:-0123456789}
      SUPPORT_EMAIL: support@\${DOMAIN:-bhquan.site}
      ADMIN_EMAILS: \${ADMIN_EMAILS:-admin@bhquan.site}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - backend

volumes:
  mysql_data:
  redis_data:

networks:
  backend:
COMPOSEEOF
"
log "docker-compose.yml created"

# ─── STEP 5: BUILD + START DOCKER ─────────────────────────
step "5/8 — Build Docker images + Start services"

ssh "${VPS_HOST}" "
  cd ${APP_DIR}

  echo '  Building Docker images...'
  docker compose build 2>&1 | tail -5

  echo '  Starting MySQL + Redis...'
  docker compose up -d mysql redis

  echo '  Waiting for MySQL...'
  for i in \$(seq 1 60); do
    if docker exec photo-mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
      echo '  MySQL ready'
      break
    fi
    [ \$i -eq 60 ] && echo '  MySQL timeout, continuing...'
    sleep 1
  done

  echo '  Starting API + Worker...'
  docker compose up -d
"
log "All containers started"

# ─── STEP 6: PUSH DB SCHEMA + SEED ────────────────────────
step "6/8 — Push database schema + seed"

ssh "${VPS_HOST}" "
  cd ${APP_DIR}

  # Fix MySQL auth (caching_sha2_password → mysql_native_password)
  MYSQL_ROOT_PASS=\$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2-)
  MYSQL_USER_PASS=\$(grep '^MYSQL_PASSWORD=' .env | cut -d= -f2-)

  docker exec photo-api node -e \"
    import mysql from 'mysql2/promise';
    const conn = await mysql.createConnection({host:'mysql',port:3306,user:'root',password:'\${MYSQL_ROOT_PASS}'});
    await conn.query(\\\"ALTER USER 'photo_user'@'%' IDENTIFIED WITH mysql_native_password BY '\${MYSQL_USER_PASS}'\\\");
    await conn.query('FLUSH PRIVILEGES');
    console.log('MySQL auth fixed');
    await conn.end();
  \" 2>/dev/null || echo '  (MySQL auth already OK)'

  # Install drizzle-kit inside container
  docker exec -w /app photo-api npm install --include=dev 2>&1 | tail -3

  # Copy source files for drizzle config
  docker cp ${APP_DIR}/photo-storage/server/src photo-api:/app/src
  docker cp ${APP_DIR}/photo-storage/server/drizzle.config.ts photo-api:/app/drizzle.config.ts
  docker cp ${APP_DIR}/photo-storage/server/tsconfig.json photo-api:/app/tsconfig.json

  # Write .env for drizzle-kit (avoids shell escaping issues)
  docker exec -w /app photo-api sh -c \"echo DATABASE_URL=mysql://root:\${MYSQL_ROOT_PASS}@mysql:3306/photo_storage > .env\"

  # Push schema
  echo '  Pushing schema...'
  docker exec -w /app photo-api npx drizzle-kit push --force 2>&1 | tail -5

  # Seed
  echo '  Seeding database...'
  docker exec -w /app photo-api npx tsx src/database/seed.ts 2>&1 || echo '  (Seed already done)'

  # Restart API + Worker to pick up new schema
  docker compose restart api worker
  sleep 5

  # Verify
  echo '  Verifying API...'
  sleep 3
  curl -sf http://localhost:4000/api/health && echo ''
"
log "Database ready"

# ─── STEP 7: NGINX + SSL ──────────────────────────────────
step "7/8 — Cau hinh Nginx + SSL"

# Detect nginx type (BT Panel or system nginx)
NGINX_TYPE=$(ssh "${VPS_HOST}" "
  if [ -d /www/server/panel/vhost/nginx ]; then
    echo 'btpanel'
  elif [ -d /etc/nginx/sites-enabled ]; then
    echo 'system'
  elif [ -d /etc/nginx/conf.d ]; then
    echo 'confd'
  else
    echo 'unknown'
  fi
")

echo "  Nginx type: ${NGINX_TYPE}"

case "$NGINX_TYPE" in
  btpanel)
    NGINX_CONF_DIR="/www/server/panel/vhost/nginx"
    NGINX_BIN="/www/server/nginx/sbin/nginx"
    ;;
  system)
    NGINX_CONF_DIR="/etc/nginx/sites-enabled"
    NGINX_BIN="nginx"
    ;;
  confd)
    NGINX_CONF_DIR="/etc/nginx/conf.d"
    NGINX_BIN="nginx"
    ;;
  *)
    warn "Nginx khong tim thay. Cau hinh thu cong."
    NGINX_CONF_DIR=""
    ;;
esac

if [ -n "$NGINX_CONF_DIR" ]; then
  # Step 7a: HTTP-only config first (for certbot)
  ssh "${VPS_HOST}" "cat > ${NGINX_CONF_DIR}/${DOMAIN}.conf << 'NGXEOF'
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${APP_DIR}/photo-storage/dist;
    index index.html;

    location /.well-known/acme-challenge/ {
        root ${APP_DIR}/photo-storage/dist;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 300s;
        client_max_body_size 500m;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 86400s;
    }

    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\\$ {
        expires 30d;
        add_header Cache-Control \"public, immutable\";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
NGXEOF
${NGINX_BIN} -t && ${NGINX_BIN} -s reload
echo 'Nginx HTTP config applied'
"
  log "Nginx HTTP OK"

  # Step 7b: Get SSL certificate
  echo "  Getting SSL certificate..."
  SSL_RESULT=$(ssh "${VPS_HOST}" "
    certbot certonly --webroot -w ${APP_DIR}/photo-storage/dist \
      -d ${DOMAIN} -d www.${DOMAIN} \
      --non-interactive --agree-tos --email admin@${DOMAIN} 2>&1
  " || true)

  if echo "$SSL_RESULT" | grep -q "Successfully\|already exists"; then
    log "SSL certificate OK"

    # Step 7c: Upgrade to HTTPS config
    ssh "${VPS_HOST}" "cat > ${NGINX_CONF_DIR}/${DOMAIN}.conf << 'NGXEOF'
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root ${APP_DIR}/photo-storage/dist;
    }

    location / {
        return 301 https://\\\$host\\\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root ${APP_DIR}/photo-storage/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 300s;
        client_max_body_size 500m;
    }

    # Socket.io proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 86400s;
    }

    # Local storage proxy
    location /storage/public/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
    }

    # SPA fallback
    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\\$ {
        expires 30d;
        add_header Cache-Control \"public, immutable\";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
NGXEOF
${NGINX_BIN} -t && ${NGINX_BIN} -s reload
echo 'Nginx HTTPS config applied'
"
    log "Nginx HTTPS OK"
  else
    warn "SSL cert failed (DNS chua tro?). Site chay HTTP truoc."
    echo "  Chay sau: certbot certonly --webroot -w ${APP_DIR}/photo-storage/dist -d ${DOMAIN}"
  fi
fi

# ─── STEP 8: CRON JOBS + FINAL CHECK ──────────────────────
step "8/8 — Cron jobs + Health check"

CRON_SECRET=$(grep "^CRON_SECRET=" .env | cut -d= -f2-)

ssh "${VPS_HOST}" "
  # Setup cron jobs
  EXISTING_CRON=\$(crontab -l 2>/dev/null || true)
  if ! echo \"\$EXISTING_CRON\" | grep -q 'expire-images'; then
    (echo \"\$EXISTING_CRON\"
     echo '# PhotoStorage cron jobs'
     echo '0 2 * * * curl -sf -H \"x-cron-secret: ${CRON_SECRET}\" http://localhost:4000/api/cron/expire-images >> /var/log/cron-photo.log 2>&1'
     echo '0 3 * * * curl -sf -H \"x-cron-secret: ${CRON_SECRET}\" http://localhost:4000/api/cron/reconcile-quota >> /var/log/cron-photo.log 2>&1'
     echo '0 * * * * curl -sf -H \"x-cron-secret: ${CRON_SECRET}\" http://localhost:4000/api/cron/remind-payments >> /var/log/cron-photo.log 2>&1'
     echo '0 1 * * 0 cd ${APP_DIR} && bash scripts/backup.sh >> /var/log/cron-photo.log 2>&1'
    ) | crontab -
    echo 'Cron jobs installed'
  else
    echo 'Cron jobs already exist'
  fi

  # Health check
  echo ''
  echo 'Health check:'
  curl -sf http://localhost:4000/api/health && echo ''
  echo ''
  echo 'Container status:'
  cd ${APP_DIR} && docker compose ps --format 'table {{.Names}}\t{{.Status}}'
"

# ─── DONE ──────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "  ${GREEN}DEPLOY HOAN TAT!${NC}"
echo "============================================================"
echo ""
echo "  Domain:   https://${DOMAIN}"
echo "  API:      https://${DOMAIN}/api/health"
echo "  Admin:    https://${DOMAIN}/admin"
echo "  Login:    admin@photostorage.com / admin123"
echo ""
echo "  Server:   ssh ${VPS_HOST}"
echo "  Project:  ${APP_DIR}"
echo ""
echo "  Commands (on VPS):"
echo "    cd ${APP_DIR}"
echo "    docker compose logs -f api      # Xem logs API"
echo "    docker compose logs -f worker   # Xem logs Worker"
echo "    docker compose restart api      # Restart API"
echo "    docker compose down             # Stop all"
echo "    docker compose up -d            # Start all"
echo ""
echo "  Update deploy (from local):"
echo "    bash scripts/quick-deploy.sh ${VPS_IP} ${DOMAIN}"
echo ""
echo "============================================================"
