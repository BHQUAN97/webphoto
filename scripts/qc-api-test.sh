#!/bin/bash
# scripts/qc-api-test.sh
# Chạy trước khi deploy — test các API endpoint thực tế
# Usage: bash scripts/qc-api-test.sh [localhost:4000 hoặc https://bhquan.site]

BASE_URL=${1:-"http://localhost:4000"}
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}✓ PASS${NC} — $1"; ((PASS++)); }
log_fail() { echo -e "${RED}✗ FAIL${NC} — $1"; echo "  Expected: $2 | Got: $3"; ((FAIL++)); }
log_section() { echo -e "\n${YELLOW}══ $1 ══${NC}"; }

# ─── Auth ─────────────────────────────────────────────────────────────────────
log_section "AUTH"

# Register test user (có thể fail nếu đã tồn tại — OK)
TIMESTAMP=$(date +%s)
TEST_EMAIL="qc_test_${TIMESTAMP}@test.com"

REGISTER=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123!\",\"name\":\"QC Test\"}")
echo "Register response: $REGISTER"

# Login
LOGIN=$(curl -s -c /tmp/qc_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123!\"}")

USER_TOKEN=$(echo $LOGIN | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
if [ -n "$USER_TOKEN" ]; then
  log_pass "Login → 200 + token"
else
  log_fail "Login" "accessToken in response" "no token"
fi

# Login sai password
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@photostorage.com","password":"wrongpassword"}')
[ "$STATUS" = "401" ] && log_pass "Login sai password → 401" || log_fail "Login sai password" "401" "$STATUS"

# Refresh token không có cookie
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/refresh")
[ "$STATUS" = "401" ] && log_pass "Refresh không có cookie → 401" || log_fail "Refresh không có cookie" "401" "$STATUS"

# ─── Auth Guard ───────────────────────────────────────────────────────────────
log_section "AUTH GUARD"

# Truy cập route cần auth mà không có token
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users/me")
[ "$STATUS" = "401" ] && log_pass "GET /users/me không có token → 401" || log_fail "GET /users/me không có token" "401" "$STATUS"

# Truy cập admin route với user token (nếu có)
if [ -n "$USER_TOKEN" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/dashboard/stats" \
    -H "Authorization: Bearer $USER_TOKEN")
  [ "$STATUS" = "403" ] && log_pass "Admin route với user token → 403" || log_fail "Admin route với user token" "403" "$STATUS"
fi

# ─── Albums ───────────────────────────────────────────────────────────────────
log_section "ALBUMS"

# Public feed không cần auth
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/albums")
[ "$STATUS" = "200" ] && log_pass "GET /albums public → 200" || log_fail "GET /albums public" "200" "$STATUS"

if [ -n "$USER_TOKEN" ]; then
  # Tạo album thiếu name
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/albums" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  [ "$STATUS" = "400" ] && log_pass "POST /albums thiếu name → 400" || log_fail "POST /albums thiếu name" "400" "$STATUS"

  # Tạo album hợp lệ
  CREATE=$(curl -s -X POST "$BASE_URL/api/albums" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"QC Test Album\",\"isPublic\":false}")
  ALBUM_ID=$(echo $CREATE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$ALBUM_ID" ]; then
    log_pass "POST /albums tạo thành công → 201"
  else
    log_fail "POST /albums" "album id in response" "no id"
  fi

  # Cleanup
  if [ -n "$ALBUM_ID" ]; then
    curl -s -X DELETE "$BASE_URL/api/albums/$ALBUM_ID" \
      -H "Authorization: Bearer $USER_TOKEN" > /dev/null
  fi
fi

# ─── Upload ───────────────────────────────────────────────────────────────────
log_section "UPLOAD"

if [ -n "$USER_TOKEN" ]; then
  # Upload URL không có albumId
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/images/upload-url" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"filename":"test.jpg","mimeType":"image/jpeg","fileSize":1000}')
  [ "$STATUS" = "400" ] && log_pass "POST /images/upload-url thiếu albumId → 400" || log_fail "POST /images/upload-url thiếu albumId" "400" "$STATUS"

  # Upload loại file không được phép
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/images/upload-url" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"filename":"malware.exe","mimeType":"application/octet-stream","fileSize":1000,"albumId":"fake"}')
  [ "$STATUS" = "400" ] && log_pass "Upload file type không hợp lệ → 400" || log_fail "Upload file type không hợp lệ" "400" "$STATUS"
fi

# ─── Plans & Payment Methods (Public) ────────────────────────────────────────
log_section "PUBLIC ENDPOINTS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/plans")
[ "$STATUS" = "200" ] && log_pass "GET /plans public → 200" || log_fail "GET /plans public" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/payment-methods")
[ "$STATUS" = "200" ] && log_pass "GET /payment-methods public → 200" || log_fail "GET /payment-methods public" "200" "$STATUS"

# ─── Input Validation ─────────────────────────────────────────────────────────
log_section "INPUT VALIDATION"

# ULID format check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/albums/not-a-valid-ulid")
[ "$STATUS" = "400" ] || [ "$STATUS" = "404" ] && \
  log_pass "GET /albums/:id với ID không hợp lệ → 400/404" || \
  log_fail "GET /albums/:id với ID không hợp lệ" "400 or 404" "$STATUS"

# XSS in query
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/albums?search=<script>alert(1)</script>")
[ "$STATUS" = "200" ] || [ "$STATUS" = "400" ] && \
  log_pass "Search với XSS payload không crash server" || \
  log_fail "XSS trong search" "200 or 400" "$STATUS"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════"
echo -e "QC API Result: ${GREEN}$PASS PASS${NC} | ${RED}$FAIL FAIL${NC}"
echo "════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}QC_API_PASSED${NC}"
  exit 0
else
  echo -e "${RED}QC_API_BUG_REPORT — $FAIL tests failed${NC}"
  exit 1
fi
