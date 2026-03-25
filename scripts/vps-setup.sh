#!/bin/bash
# ============================================================
# PHOTO STORAGE — VPS UBUNTU SETUP (TU DAU DEN CUOI)
# ============================================================
# Chay tren VPS Ubuntu 22.04/24.04 moi tinh
# Usage:
#   1. SSH vao VPS:  ssh root@<ip>
#   2. Upload file:  scp scripts/vps-setup.sh root@<ip>:/root/
#   3. Chay:         bash /root/vps-setup.sh
#
# Hoac 1 lenh duy nhat:
#   curl -sSL <raw-url> | bash
# ============================================================

set -e

# ─── COLORS ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ─── CHECK ROOT ──────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  err "Vui long chay voi quyen root: sudo bash vps-setup.sh"
fi

echo ""
echo "============================================================"
echo "  PHOTO STORAGE — VPS Setup for bhquan.site"
echo "============================================================"
echo ""

# ─── CONFIG (SUA TRUOC KHI CHAY) ────────────────────────────
# Neu chua co, script se hoi ban nhap tu ban phim

DOMAIN="${DOMAIN:-bhquan.site}"
APP_DIR="/opt/webphoto"

# ─── STEP 1: UPDATE SYSTEM ──────────────────────────────────
step "1/9 — Cap nhat he thong"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git unzip htop nano ufw
log "He thong da cap nhat"

# ─── STEP 2: FIREWALL ───────────────────────────────────────
step "2/9 — Cau hinh Firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable 2>/dev/null || true
log "Firewall: SSH + HTTP + HTTPS"

# ─── STEP 3: INSTALL DOCKER ─────────────────────────────────
step "3/9 — Cai Docker + Docker Compose"
if command -v docker &>/dev/null; then
  log "Docker da co san: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log "Docker da cai: $(docker --version)"
fi

# Docker Compose plugin (v2)
if docker compose version &>/dev/null; then
  log "Docker Compose da co san"
else
  apt-get install -y -qq docker-compose-plugin
  log "Docker Compose da cai"
fi

# ─── STEP 4: INSTALL NODE.JS 20 ─────────────────────────────
step "4/9 — Cai Node.js 20 LTS"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  log "Node.js da co san: $NODE_VER"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  log "Node.js da cai: $(node -v)"
fi

# ─── STEP 5: CLONE/COPY PROJECT ─────────────────────────────
step "5/9 — Thiet lap project"

if [ -d "$APP_DIR" ]; then
  warn "Thu muc $APP_DIR da ton tai"
  read -p "  Ghi de? (y/N): " OVERWRITE
  if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
    log "Giu nguyen thu muc cu"
  else
    rm -rf "$APP_DIR"
  fi
fi

if [ ! -d "$APP_DIR" ]; then
  echo ""
  echo "  Ban can dua code len VPS. Chon cach:"
  echo "  1) Git clone tu repository"
  echo "  2) Code da co san tai $APP_DIR (bo qua)"
  echo ""
  read -p "  Chon (1/2): " CODE_METHOD

  if [ "$CODE_METHOD" = "1" ]; then
    read -p "  Git repo URL (vd: https://github.com/user/webphoto.git): " GIT_URL
    if [ -z "$GIT_URL" ]; then
      err "Chua nhap Git URL"
    fi
    git clone "$GIT_URL" "$APP_DIR"
    log "Da clone repo"
  else
    if [ ! -d "$APP_DIR" ]; then
      mkdir -p "$APP_DIR"
      warn "Thu muc $APP_DIR trong. Hay upload code truoc:"
      echo "  Tren may Windows chay:"
      echo "  scp -r E:\\DEVELOP\\WebPhoto\\* root@<vps-ip>:$APP_DIR/"
      echo ""
      echo "  Sau do chay lai script nay."
      exit 0
    fi
  fi
fi

cd "$APP_DIR"
log "Project tai: $APP_DIR"

# ─── STEP 6: CAU HINH .ENV ──────────────────────────────────
step "6/9 — Cau hinh .env"

if [ -f .env ]; then
  warn "File .env da ton tai, giu nguyen"
else
  echo ""
  echo "  Nhap cau hinh (Enter de dung gia tri mac dinh):"
  echo ""

  # MySQL
  read -p "  MySQL root password [StrongRootPass2024!]: " MYSQL_ROOT_PASS
  MYSQL_ROOT_PASS="${MYSQL_ROOT_PASS:-StrongRootPass2024!}"

  read -p "  MySQL user password [StrongUserPass2024!]: " MYSQL_USER_PASS
  MYSQL_USER_PASS="${MYSQL_USER_PASS:-StrongUserPass2024!}"

  # JWT
  JWT_SECRET=$(openssl rand -hex 32)
  log "JWT_SECRET da tao tu dong"

  # R2
  echo ""
  echo "  -- Cloudflare R2 --"
  read -p "  R2_ENDPOINT: " R2_EP
  read -p "  R2_ACCESS_KEY: " R2_AK
  read -p "  R2_SECRET_KEY: " R2_SK
  read -p "  R2 Public CDN URL (vd: https://pub-xxx.r2.dev): " CDN_URL_VAL

  # Resend
  echo ""
  echo "  -- Resend (Email) --"
  read -p "  RESEND_API_KEY: " RESEND_KEY

  # Cloudflare Tunnel
  echo ""
  echo "  -- Cloudflare Tunnel --"
  read -p "  CLOUDFLARE_TUNNEL_TOKEN (de trong neu dung SSL truc tiep): " CF_TOKEN

  # Cron
  CRON_SECRET=$(openssl rand -hex 16)

  cat > .env << ENVEOF
# ============================================
# PRODUCTION ENV — ${DOMAIN}
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ============================================

# MySQL
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASS}
MYSQL_PASSWORD=${MYSQL_USER_PASS}

# JWT
JWT_SECRET=${JWT_SECRET}

# Cloudflare R2
R2_ENDPOINT=${R2_EP}
R2_ACCESS_KEY=${R2_AK}
R2_SECRET_KEY=${R2_SK}

# Resend
RESEND_API_KEY=${RESEND_KEY}

# Contact
SUPPORT_PHONE=0123456789
ADMIN_EMAILS=admin@${DOMAIN}

# Cron
CRON_SECRET=${CRON_SECRET}

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=${CF_TOKEN}
ENVEOF

  log ".env da tao"
fi

# Frontend .env.production
if [ ! -f photo-storage/.env.production ]; then
  # Try to get CDN URL from .env
  CDN_FROM_ENV=$(grep "^R2_ENDPOINT=" .env 2>/dev/null | cut -d= -f2-)
  # If user provided CDN_URL_VAL use it, otherwise ask
  if [ -z "${CDN_URL_VAL:-}" ]; then
    read -p "  Frontend CDN URL (R2 public, vd: https://pub-xxx.r2.dev): " CDN_URL_VAL
  fi

  cat > photo-storage/.env.production << FEEOF
# Frontend production env
VITE_API_URL=https://${DOMAIN}/api
VITE_CDN_URL=${CDN_URL_VAL}
VITE_SOCKET_URL=https://${DOMAIN}
FEEOF
  log "photo-storage/.env.production da tao"
fi

# ─── STEP 7: BUILD ──────────────────────────────────────────
step "7/9 — Build frontend + backend"

echo "  Building frontend..."
cd "$APP_DIR/photo-storage"
npm ci --silent 2>/dev/null || npm install
npm run build
log "Frontend built -> photo-storage/dist/"

echo "  Building backend..."
cd "$APP_DIR/photo-storage/server"
npm ci --silent 2>/dev/null || npm install
npm run build
log "Backend built -> photo-storage/server/dist/"

cd "$APP_DIR"

# ─── STEP 8: DOCKER COMPOSE UP ──────────────────────────────
step "8/9 — Start Docker services"

# Detect deploy mode
CF_TOKEN_VAL=$(grep "^CLOUDFLARE_TUNNEL_TOKEN=" .env 2>/dev/null | cut -d= -f2-)
if [ -n "$CF_TOKEN_VAL" ]; then
  DEPLOY_MODE="tunnel"
  COMPOSE_CMD="docker compose -f docker-compose.prod.yml -f docker-compose.tunnel.yml"
  log "Mode: Cloudflare Tunnel"
else
  DEPLOY_MODE="direct"
  COMPOSE_CMD="docker compose -f docker-compose.prod.yml"
  log "Mode: Direct SSL"
fi

# Build Docker images
echo "  Building Docker images..."
$COMPOSE_CMD build api worker

# Start infra first
echo "  Starting MySQL + Redis..."
$COMPOSE_CMD up -d mysql redis

# Wait for MySQL
echo "  Waiting for MySQL..."
for i in $(seq 1 60); do
  if $COMPOSE_CMD exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
    log "MySQL ready"
    break
  fi
  if [ $i -eq 60 ]; then
    warn "MySQL chua san sang sau 60s, tiep tuc..."
  fi
  sleep 1
done

# Push DB schema
echo "  Pushing database schema..."
cd "$APP_DIR/photo-storage/server"
MYSQL_PWD=$(grep "^MYSQL_PASSWORD=" "$APP_DIR/.env" | cut -d= -f2-)
DATABASE_URL="mysql://photo_user:${MYSQL_PWD}@localhost:3306/photo_storage" npx drizzle-kit push --force 2>&1 | tail -3
DATABASE_URL="mysql://photo_user:${MYSQL_PWD}@localhost:3306/photo_storage" npm run db:seed 2>/dev/null || log "Seed da chay truoc do, skip"
cd "$APP_DIR"
log "Database schema OK"

# Start all
echo "  Starting all services..."
$COMPOSE_CMD up -d
log "All services started"

# ─── STEP 9: HEALTH CHECK ───────────────────────────────────
step "9/9 — Health check"
sleep 5

# Check via Docker network
API_STATUS=$($COMPOSE_CMD exec -T api node -e "
  fetch('http://localhost:4000/api/health')
    .then(r => r.json())
    .then(d => console.log(JSON.stringify(d)))
    .catch(e => console.log('ERROR: ' + e.message))
" 2>/dev/null || echo "ERROR")

if echo "$API_STATUS" | grep -q '"ok"'; then
  log "API healthy: $API_STATUS"
else
  # Fallback check
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "API healthy (HTTP 200)"
  else
    warn "API chua san sang. Kiem tra logs:"
    echo "  $COMPOSE_CMD logs api --tail 30"
  fi
fi

# Check all containers
echo ""
echo "  Container status:"
$COMPOSE_CMD ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || $COMPOSE_CMD ps

# ─── DONE ────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  SETUP HOAN TAT!"
echo "============================================================"
echo ""
echo "  Domain:   https://${DOMAIN}"
echo "  API:      https://${DOMAIN}/api/health"
echo "  Admin:    https://${DOMAIN}/admin"
echo ""
echo "  Project:  $APP_DIR"
echo "  Mode:     $DEPLOY_MODE"
echo ""
echo "  Commands:"
echo "    Logs:        cd $APP_DIR && $COMPOSE_CMD logs -f"
echo "    Restart:     cd $APP_DIR && $COMPOSE_CMD restart"
echo "    Stop:        cd $APP_DIR && $COMPOSE_CMD down"
echo "    Rebuild:     cd $APP_DIR && bash scripts/deploy.sh ${DEPLOY_MODE}"
echo ""
if [ "$DEPLOY_MODE" = "direct" ]; then
echo "  SSL (neu chua co):"
echo "    apt install certbot"
echo "    certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} -d api.${DOMAIN} -d ws.${DOMAIN}"
echo ""
fi
echo "  Cap nhat code:"
echo "    cd $APP_DIR && git pull && bash scripts/deploy.sh ${DEPLOY_MODE}"
echo ""
echo "============================================================"
