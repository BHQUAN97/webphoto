#!/bin/bash
# ============================================================
# DB CHANGELOG RUNNER (directory-versioned)
# Cau truc: db/changelog/{version}/{NNN}__mo_ta.sql
#
# Usage:
#   bash scripts/db-changelog.sh <vps-ip>              # chay tat ca pending
#   bash scripts/db-changelog.sh <vps-ip> 1.1.0        # force chay 1 version
#   bash scripts/db-changelog.sh <vps-ip> --status     # xem trang thai
# ============================================================

set -e

VPS_IP="${1:?Usage: bash scripts/db-changelog.sh <vps-ip> [version|--status]}"
SINGLE="${2:-}"
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_USER}@${VPS_IP}"
APP_DIR="/opt/webphoto"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CHANGELOG_DIR="$ROOT_DIR/db/changelog"

if [ ! -d "$CHANGELOG_DIR" ]; then
  echo -e "${RED}[ERR]${NC} Khong tim thay thu muc db/changelog/"
  exit 1
fi

# Get MySQL password from VPS .env
MYSQL_PWD=$(ssh "${VPS_HOST}" "grep '^MYSQL_PASSWORD=' ${APP_DIR}/.env | cut -d= -f2-")
if [ -z "$MYSQL_PWD" ]; then
  echo -e "${RED}[ERR]${NC} Khong doc duoc MYSQL_PASSWORD tu .env tren VPS"
  exit 1
fi

MYSQL_CMD="docker exec -i photo-mysql mysql -u photo_user -p${MYSQL_PWD} photo_storage"

echo ""
echo "=== DB Changelog Runner ==="
echo "  VPS: ${VPS_HOST}"
echo ""

# Ensure tracker table exists
for f in "$CHANGELOG_DIR"/_init/*.sql; do
  [ -f "$f" ] && ssh "${VPS_HOST}" "$MYSQL_CMD" < "$f" > /dev/null 2>&1
done

# --status: show applied versions and exit
if [ "$SINGLE" = "--status" ]; then
  echo -e "${CYAN}Applied migrations:${NC}"
  ssh "${VPS_HOST}" "$MYSQL_CMD -e \"SELECT version, filename, applied_at, applied_by, execution_ms FROM schema_changelog ORDER BY version, filename\"" 2>/dev/null
  echo ""

  # Show pending
  APPLIED=$(ssh "${VPS_HOST}" "$MYSQL_CMD -N -e \"SELECT CONCAT(version, '/', filename) FROM schema_changelog\"" 2>/dev/null || echo "")
  echo -e "${CYAN}Pending migrations:${NC}"
  PENDING=0
  for ver_dir in $(find "$CHANGELOG_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '_init' | sort); do
    VER=$(basename "$ver_dir")
    for f in $(find "$ver_dir" -name '*.sql' -type f | sort); do
      FNAME=$(basename "$f")
      KEY="${VER}/${FNAME}"
      if ! echo "$APPLIED" | grep -qF "$KEY"; then
        echo "  $KEY"
        ((PENDING++))
      fi
    done
  done
  [ $PENDING -eq 0 ] && echo "  (none — all up to date)"
  exit 0
fi

# Get already-applied migrations
APPLIED=$(ssh "${VPS_HOST}" "$MYSQL_CMD -N -e \"SELECT CONCAT(version, '/', filename) FROM schema_changelog\"" 2>/dev/null || echo "")

# Collect version directories
if [ -n "$SINGLE" ]; then
  # Force run single version directory
  if [ ! -d "$CHANGELOG_DIR/$SINGLE" ]; then
    echo -e "${RED}[ERR]${NC} Khong tim thay thu muc: db/changelog/$SINGLE"
    exit 1
  fi
  VER_DIRS=("$CHANGELOG_DIR/$SINGLE")
  echo -e "${YELLOW}[FORCE]${NC} Running version $SINGLE regardless of applied status"
  FORCE_MODE=true
else
  VER_DIRS=()
  while IFS= read -r d; do
    VER_DIRS+=("$d")
  done < <(find "$CHANGELOG_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '_init' | sort)
  FORCE_MODE=false
fi

if [ ${#VER_DIRS[@]} -eq 0 ]; then
  echo "Khong co version changelog nao."
  exit 0
fi

PASS=0
SKIP=0
FAIL=0

for ver_dir in "${VER_DIRS[@]}"; do
  VER=$(basename "$ver_dir")
  echo -e "\n${CYAN}── Version $VER ──${NC}"

  for f in $(find "$ver_dir" -name '*.sql' -type f | sort); do
    FNAME=$(basename "$f")
    KEY="${VER}/${FNAME}"

    # Skip already applied (unless force mode)
    if [ "$FORCE_MODE" != "true" ] && echo "$APPLIED" | grep -qF "$KEY"; then
      echo -e "  ${CYAN}[SKIP]${NC} $FNAME (already applied)"
      ((SKIP++))
      continue
    fi

    echo -ne "  ${CYAN}[RUN]${NC} $FNAME ... "

    START_S=$(date +%s)
    OUTPUT=$(ssh "${VPS_HOST}" "$MYSQL_CMD" < "$f" 2>&1)
    EXIT_CODE=$?
    END_S=$(date +%s)
    DURATION_MS=$(( (END_S - START_S) * 1000 ))

    if [ $EXIT_CODE -eq 0 ]; then
      DESC=$(echo "$FNAME" | sed 's/^[0-9]*__//; s/\.sql$//; s/_/ /g')
      CHECKSUM=$(sha256sum "$f" | cut -d' ' -f1)

      # Upsert into schema_changelog
      ssh "${VPS_HOST}" "$MYSQL_CMD -e \"REPLACE INTO schema_changelog (version, filename, description, applied_by, checksum, execution_ms) VALUES ('$VER', '$FNAME', '$DESC', 'manual', '$CHECKSUM', $DURATION_MS)\"" 2>/dev/null

      echo -e "${GREEN}OK${NC} (${DURATION_MS}ms)"
      echo "$OUTPUT" | grep -E '^\[OK\]|^\[SKIP\]|^result' | sed 's/^/    /'
      ((PASS++))
    else
      echo -e "${RED}FAILED${NC}"
      echo "$OUTPUT" | tail -5 | sed 's/^/    /'
      ((FAIL++))
    fi
  done
done

echo ""
echo "=== Done: ${PASS} applied, ${SKIP} skipped, ${FAIL} failed ==="
