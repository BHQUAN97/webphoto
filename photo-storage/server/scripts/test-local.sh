#!/bin/bash
# ============================================
# PHOTO STORAGE — LOCAL TEST SCRIPT
# Kiểm tra nhanh các endpoint chính
# ============================================

API_URL="${API_URL:-http://localhost:4000}"
echo "Testing API at: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass=0
fail=0

test_endpoint() {
  local method=$1
  local path=$2
  local expected_status=$3
  local data=$4
  local desc=$5
  local extra_headers=$6

  if [ -n "$data" ]; then
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_URL$path" \
      -H "Content-Type: application/json" \
      $extra_headers \
      -d "$data" 2>/dev/null)
  else
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_URL$path" \
      $extra_headers 2>/dev/null)
  fi

  if [ "$response" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓${NC} $desc ($method $path → $response)"
    ((pass++))
  else
    echo -e "  ${RED}✗${NC} $desc ($method $path → $response, expected $expected_status)"
    ((fail++))
  fi
}

echo "=== Health Check ==="
test_endpoint GET "/api/health" 200 "" "Health check"

echo ""
echo "=== Public Endpoints ==="
test_endpoint GET "/api/albums" 200 "" "Public albums feed"
test_endpoint GET "/api/plans" 200 "" "Public plans list"
test_endpoint GET "/api/payment-methods" 200 "" "Public payment methods"

echo ""
echo "=== Auth ==="
test_endpoint POST "/api/auth/register" 400 '{}' "Register (missing fields → 400)"
test_endpoint POST "/api/auth/login" 400 '{}' "Login (missing fields → 400)"
test_endpoint POST "/api/auth/login" 401 '{"email":"wrong@test.com","password":"Wrong1234"}' "Login (wrong creds → 401)"

echo ""
echo "=== Protected Endpoints (no token → 401) ==="
test_endpoint GET "/api/users/me" 401 "" "Profile without auth"
test_endpoint POST "/api/albums" 401 '{"title":"test"}' "Create album without auth"
test_endpoint POST "/api/images/upload-url" 401 '{}' "Upload without auth"

echo ""
echo "=== Admin (no token → 401/403) ==="
test_endpoint GET "/api/admin/dashboard/stats" 403 "" "Admin stats without auth"
test_endpoint GET "/api/admin/users" 403 "" "Admin users without auth"

echo ""
echo "=== Cron (no secret → 401) ==="
test_endpoint GET "/api/cron/expire-images" 401 "" "Cron without secret"

echo ""
echo "=== Register + Login Flow ==="
REGISTER_RESP=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-'$RANDOM'@test.com","password":"Test1234","displayName":"Test User"}' 2>/dev/null)

TOKEN=$(echo "$REGISTER_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo -e "  ${GREEN}✓${NC} Register + get token"
  ((pass++))

  test_endpoint GET "/api/users/me" 200 "" "Profile with token" "-H \"Authorization: Bearer $TOKEN\""
  test_endpoint GET "/api/users/me/storage" 200 "" "Storage with token" "-H \"Authorization: Bearer $TOKEN\""
  test_endpoint GET "/api/users/me/stats" 200 "" "Stats with token" "-H \"Authorization: Bearer $TOKEN\""
  test_endpoint GET "/api/users/me/albums" 200 "" "My albums with token" "-H \"Authorization: Bearer $TOKEN\""
else
  echo -e "  ${RED}✗${NC} Register failed (no token returned)"
  ((fail++))
fi

echo ""
echo "=========================================="
echo -e "  Results: ${GREEN}$pass passed${NC}, ${RED}$fail failed${NC}"
echo "=========================================="

if [ $fail -gt 0 ]; then
  exit 1
fi
