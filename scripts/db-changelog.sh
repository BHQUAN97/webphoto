#!/bin/bash
# ============================================================
# DB CHANGELOG RUNNER (versioned)
# Chi chay nhung version CHUA applied. Track trong bang schema_changelog.
#
# Usage:
#   bash scripts/db-changelog.sh <vps-ip>              # chay tat ca chua applied
#   bash scripts/db-changelog.sh <vps-ip> V005         # force chay lai 1 version
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
ssh "${VPS_HOST}" "$MYSQL_CMD" < "$CHANGELOG_DIR/V000__create_changelog_tracker.sql" > /dev/null 2>&1

# --status: show applied versions and exit
if [ "$SINGLE" = "--status" ]; then
  echo -e "${CYAN}Applied versions:${NC}"
  ssh "${VPS_HOST}" "$MYSQL_CMD -e \"SELECT version, filename, applied_at, applied_by, execution_ms FROM schema_changelog ORDER BY version\"" 2>/dev/null
  echo ""

  # Show pending
  APPLIED=$(ssh "${VPS_HOST}" "$MYSQL_CMD -N -e \"SELECT version FROM schema_changelog ORDER BY version\"" 2>/dev/null || echo "")
  echo -e "${CYAN}Pending versions:${NC}"
  PENDING=0
  for f in $(find "$CHANGELOG_DIR" -name 'V*.sql' -type f | sort); do
    FNAME=$(basename "$f")
    VERSION=$(echo "$FNAME" | grep -oP '^V\d+')
    [ "$VERSION" = "V000" ] && continue
    if ! echo "$APPLIED" | grep -qw "$VERSION"; then
      echo "  $FNAME"
      ((PENDING++))
    fi
  done
  [ $PENDING -eq 0 ] && echo "  (none — all up to date)"
  exit 0
fi

# Get already-applied versions
APPLIED=$(ssh "${VPS_HOST}" "$MYSQL_CMD -N -e \"SELECT version FROM schema_changelog ORDER BY version\"" 2>/dev/null || echo "")

# Collect files
FILES=()
if [ -n "$SINGLE" ]; then
  # Force run single version (even if already applied)
  for f in "$CHANGELOG_DIR"/${SINGLE}__*.sql; do
    [ -f "$f" ] && FILES+=("$f")
  done
  if [ ${#FILES[@]} -eq 0 ]; then
    echo -e "${RED}[ERR]${NC} Khong tim thay file changelog cho version: $SINGLE"
    exit 1
  fi
  echo -e "${YELLOW}[FORCE]${NC} Running $SINGLE regardless of applied status"
  FORCE_MODE=true
else
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find "$CHANGELOG_DIR" -name 'V*.sql' -type f | sort)
  FORCE_MODE=false
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "Khong co file changelog nao."
  exit 0
fi

PASS=0
SKIP=0
FAIL=0

for f in "${FILES[@]}"; do
  FNAME=$(basename "$f")
  VERSION=$(echo "$FNAME" | grep -oP '^V\d+')

  # Skip V000
  [ "$VERSION" = "V000" ] && continue

  # Skip already applied (unless force mode)
  if [ "$FORCE_MODE" != "true" ] && echo "$APPLIED" | grep -qw "$VERSION"; then
    echo -e "${CYAN}[SKIP]${NC} $FNAME (already applied)"
    ((SKIP++))
    continue
  fi

  echo -ne "${CYAN}[RUN]${NC} $FNAME ... "

  START_S=$(date +%s)
  OUTPUT=$(ssh "${VPS_HOST}" "$MYSQL_CMD" < "$f" 2>&1)
  EXIT_CODE=$?
  END_S=$(date +%s)
  DURATION_MS=$(( (END_S - START_S) * 1000 ))

  if [ $EXIT_CODE -eq 0 ]; then
    DESC=$(echo "$FNAME" | sed 's/^V[0-9]*__//; s/\.sql$//; s/_/ /g')
    CHECKSUM=$(sha256sum "$f" | cut -d' ' -f1)

    # Upsert into schema_changelog (force mode may re-run)
    ssh "${VPS_HOST}" "$MYSQL_CMD -e \"REPLACE INTO schema_changelog (version, description, filename, applied_by, checksum, execution_ms) VALUES ('$VERSION', '$DESC', '$FNAME', 'manual', '$CHECKSUM', $DURATION_MS)\"" 2>/dev/null

    echo -e "${GREEN}OK${NC} (${DURATION_MS}ms)"
    echo "$OUTPUT" | grep -E '^\[OK\]|^\[SKIP\]|^result' | sed 's/^/    /'
    ((PASS++))
  else
    echo -e "${RED}FAILED${NC}"
    echo "$OUTPUT" | tail -5 | sed 's/^/    /'
    ((FAIL++))
  fi
done

echo ""
echo "=== Done: ${PASS} applied, ${SKIP} skipped, ${FAIL} failed ==="
