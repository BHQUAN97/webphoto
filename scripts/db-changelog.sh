#!/bin/bash
# ============================================================
# DB CHANGELOG RUNNER
# Chay tat ca file changelog theo thu tu version tren VPS
#
# Usage:
#   bash scripts/db-changelog.sh <vps-ip>
#   bash scripts/db-changelog.sh <vps-ip> V005  # chi chay 1 file
# ============================================================

set -e

VPS_IP="${1:?Usage: bash scripts/db-changelog.sh <vps-ip> [version]}"
SINGLE="${2:-}"
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_USER}@${VPS_IP}"
APP_DIR="/opt/webphoto"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CHANGELOG_DIR="$ROOT_DIR/db/changelog"

if [ ! -d "$CHANGELOG_DIR" ]; then
  echo -e "${RED}[ERR]${NC} Khong tim thay thu muc db/changelog/"
  exit 1
fi

# Get MySQL password from .env
MYSQL_PWD=$(ssh "${VPS_HOST}" "grep '^MYSQL_PASSWORD=' ${APP_DIR}/.env | cut -d= -f2-")
if [ -z "$MYSQL_PWD" ]; then
  echo -e "${RED}[ERR]${NC} Khong doc duoc MYSQL_PASSWORD tu .env tren VPS"
  exit 1
fi

echo ""
echo "=== DB Changelog Runner ==="
echo "  VPS: ${VPS_HOST}"
echo ""

# Collect files — sorted by name (V001, V002, ...)
FILES=()
if [ -n "$SINGLE" ]; then
  # Run single version
  for f in "$CHANGELOG_DIR"/${SINGLE}__*.sql; do
    [ -f "$f" ] && FILES+=("$f")
  done
  if [ ${#FILES[@]} -eq 0 ]; then
    echo -e "${RED}[ERR]${NC} Khong tim thay file changelog cho version: $SINGLE"
    exit 1
  fi
else
  # Run all, sorted
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find "$CHANGELOG_DIR" -name 'V*.sql' -type f | sort)
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "Khong co file changelog nao."
  exit 0
fi

echo "  Files: ${#FILES[@]}"
echo ""

PASS=0
FAIL=0

for f in "${FILES[@]}"; do
  FNAME=$(basename "$f")
  echo -ne "${CYAN}[RUN]${NC} $FNAME ... "

  OUTPUT=$(ssh "${VPS_HOST}" "docker exec -i photo-mysql mysql -u photo_user -p${MYSQL_PWD} photo_storage" < "$f" 2>&1)
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
    # Show verify output (last lines)
    echo "$OUTPUT" | grep -E '^\[OK\]|^\[SKIP\]|^result' | sed 's/^/    /'
    ((PASS++))
  else
    echo -e "${RED}FAILED${NC}"
    echo "$OUTPUT" | tail -5 | sed 's/^/    /'
    ((FAIL++))
  fi
done

echo ""
echo "=== Done: ${PASS} passed, ${FAIL} failed ==="
