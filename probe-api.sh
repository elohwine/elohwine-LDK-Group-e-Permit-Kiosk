#!/usr/bin/env bash
set -euo pipefail

BASE="https://www.ldkgroup.co.uk/api"
KIOSK_KEY="c88ea0a21ca2dbdc72987b58f9d693f4658e579bf93ca7572b5600c1418a9534"
EMAIL="elowine.tauro@ldkgroup.co.uk"
PASS="Test123!"
VRM="RT45TYU"
SITE_ID="SC4zaW84A9m1vB9Maz0X"

echo "========================================"
echo " LDK Kiosk API Probe"
echo "========================================"

# ── 1. Auth ─────────────────────────────────
echo ""
echo "── 1. POST /kiosk/auth ──"
AUTH_RESP=$(curl -s -X POST "$BASE/kiosk/auth" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  -w "\n__HTTP__%{http_code}")
AUTH_BODY=$(echo "$AUTH_RESP" | sed '$d')
AUTH_CODE=$(echo "$AUTH_RESP" | tail -1 | sed 's/__HTTP__//')
echo "HTTP $AUTH_CODE"
echo "$AUTH_BODY" | python3 -m json.tool 2>/dev/null || echo "$AUTH_BODY"
TOKEN=$(echo "$AUTH_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || echo "")
echo "Token extracted: ${TOKEN:0:40}..."

# ── 2. VRM lookup (with Bearer) ──────────────
echo ""
echo "── 2. GET /permits/by-vrm?vrm=$VRM&siteId=$SITE_ID (Bearer) ──"
curl -s "$BASE/permits/by-vrm?vrm=$VRM&siteId=$SITE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 3. VRM lookup (kiosk key only, no Bearer) ──
echo ""
echo "── 3. GET /permits/by-vrm?vrm=$VRM&siteId=$SITE_ID (kiosk key only) ──"
curl -s "$BASE/permits/by-vrm?vrm=$VRM&siteId=$SITE_ID" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 4. VRM lookup without siteId ────────────
echo ""
echo "── 4. GET /permits/by-vrm?vrm=$VRM (no siteId, Bearer) ──"
curl -s "$BASE/permits/by-vrm?vrm=$VRM" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 5. GET /permits?vrm=... (alternative list endpoint) ──
echo ""
echo "── 5. GET /permits?vrm=$VRM&siteId=$SITE_ID (Bearer) ──"
curl -s "$BASE/permits?vrm=$VRM&siteId=$SITE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 6. POST /permits (issue) ─────────────────
PAYLOAD='{"vrm":"KIOSK_TEST","siteId":"'"$SITE_ID"'","start":"2099-01-01T10:00:00Z","end":"2099-01-01T12:00:00Z","hours":2,"email":"test@kiosk.local"}'
DISPATCH_PAYLOAD='{"vrm":"KIOSK_TEST","siteId":"'"$SITE_ID"'","siteName":"RT45YUI","startDate":"2099-01-01","endDate":"2099-01-01","startTime":"08:00","endTime":"18:00","permitType":"temporary","holderType":"visitor","recipientName":"Probe User","recipientEmail":"test@kiosk.local","recipientPhone":"07123456789","notes":"","createdBy":"probe-script","createdByName":"Kiosk","source":"kiosk"}'
echo ""
echo "── 6. POST /permits (Bearer) ──"
curl -s -X POST "$BASE/permits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -d "$PAYLOAD" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 7. POST /epermits (issue) ────────────────
echo ""
echo "── 7. POST /epermits (Bearer) ──"
curl -s -X POST "$BASE/epermits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -d "$PAYLOAD" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 8. POST /epermits/dispatch ───────────────
echo ""
echo "── 8. POST /epermits/dispatch (Bearer) ──"
curl -s -X POST "$BASE/epermits/dispatch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -d "$DISPATCH_PAYLOAD" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 9. POST /kiosk/issue ─────────────────────
echo ""
echo "── 9. POST /kiosk/issue (Bearer) ──"
curl -s -X POST "$BASE/kiosk/issue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -d "$PAYLOAD" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

# ── 10. POST /kiosk/permit ───────────────────
echo ""
echo "── 10. POST /kiosk/permit (Bearer) ──"
curl -s -X POST "$BASE/kiosk/permit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Kiosk-Key: $KIOSK_KEY" \
  -d "$PAYLOAD" \
  -w "\nHTTP %{http_code}\n" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "========================================"
echo " Done"
echo "========================================"
