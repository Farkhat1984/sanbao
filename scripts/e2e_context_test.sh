#!/bin/bash
# E2E Context Management Test — runs against live production
# Tests: manual compaction, dialog export endpoints
#
# Strategy: uses direct DB + localhost API (no auth needed for DB setup,
# auth session obtained via production HTTPS)
set -uo pipefail

LOCAL="http://localhost:3004"
PROD="https://www.sanbao.ai"
COOKIE_JAR="/tmp/e2e_context_cookies.txt"
PASS=0
FAIL=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

assert_eq() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "$3" ]; then
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (expected: $2, got: $3)"; FAIL=$((FAIL + 1))
  fi
}
assert_not_empty() {
  TOTAL=$((TOTAL + 1))
  if [ -n "$2" ] && [ "$2" != "null" ]; then
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (empty/null)"; FAIL=$((FAIL + 1))
  fi
}
assert_contains() {
  TOTAL=$((TOTAL + 1))
  if echo "$3" | grep -qi "$2"; then
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (expected to contain: '$2')"; FAIL=$((FAIL + 1))
  fi
}
assert_http() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "$3" ]; then
    echo -e "  ${GREEN}✓${NC} $1 (HTTP $3)"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (expected HTTP $2, got $3)"; FAIL=$((FAIL + 1))
  fi
}
assert_gte() {
  TOTAL=$((TOTAL + 1))
  if [ -n "$3" ] && [ "$3" -ge "$2" ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $1 (=$3)"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (expected >= $2, got: $3)"; FAIL=$((FAIL + 1))
  fi
}
db() { docker exec sanbao-db-1 psql -U postgres -d sanbao -t -A -c "$1" 2>/dev/null; }

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  E2E CONTEXT MANAGEMENT TEST — $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ── Phase 1: Health ──

echo -e "${YELLOW}Phase 1: Health Check${NC}"
READY=$(curl -sf "$LOCAL/api/ready" 2>/dev/null | python3 -c "import sys,json; print(str(json.load(sys.stdin).get('ready',False)).lower())" 2>/dev/null)
assert_eq "App ready" "true" "$READY"
echo ""

# ── Phase 2: Auth (via production HTTPS) ──

echo -e "${YELLOW}Phase 2: Admin Authentication${NC}"

# E2E test admin (created by setup)
ADMIN_EMAIL="e2e-context@test.local"
ADMIN_PASS="E2eTest2026!"
ADMIN_ID=$(db "SELECT id FROM \"User\" WHERE email = '$ADMIN_EMAIL';")
assert_not_empty "E2E admin in DB" "$ADMIN_ID"

# Auth via CSRF flow
rm -f "$COOKIE_JAR"
CSRF=$(curl -s -c "$COOKIE_JAR" "$PROD/api/auth/csrf" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null)
assert_not_empty "CSRF token" "$CSRF"

curl -s -L -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "$PROD/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$ADMIN_EMAIL" \
  --data-urlencode "password=$ADMIN_PASS" \
  -o /dev/null 2>/dev/null

SESSION_EMAIL=$(curl -s -b "$COOKIE_JAR" "$PROD/api/auth/session" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('email',''))" 2>/dev/null)
HAS_AUTH=false
if [ "$SESSION_EMAIL" = "$ADMIN_EMAIL" ]; then
  HAS_AUTH=true
fi
assert_eq "Admin session" "$ADMIN_EMAIL" "$SESSION_EMAIL"
echo ""

# ── Phase 3: Create test conversation + messages via DB ──

echo -e "${YELLOW}Phase 3: Create Test Data (via DB)${NC}"

# Create conversation directly in DB
CONV_ID=$(db "INSERT INTO \"Conversation\" (id, title, \"userId\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), 'E2E Context Test', '$ADMIN_ID', now(), now()) RETURNING id;" | head -1)
assert_not_empty "Conversation created" "$CONV_ID"

# Insert 10 messages (5 user + 5 assistant)
for i in $(seq 1 5); do
  OFFSET=$((i * 10))
  db "INSERT INTO \"Message\" (id, \"conversationId\", role, content, \"createdAt\") VALUES (gen_random_uuid(), '${CONV_ID}', 'USER', 'Test question ${i} about context management and auto-compaction in sanbao platform. This is a longer message to simulate real conversation with enough tokens for testing the compaction system.', now() - interval '${OFFSET} minutes');" >/dev/null
  db "INSERT INTO \"Message\" (id, \"conversationId\", role, content, \"createdAt\") VALUES (gen_random_uuid(), '${CONV_ID}', 'ASSISTANT', 'This is test answer ${i}. The context management system handles automatic compaction when context window usage exceeds 70 percent. It uses LLM-based summarization to preserve key facts while reducing token count. The system supports both automatic and manual compaction triggers.', now() - interval '${OFFSET} minutes' + interval '30 seconds');" >/dev/null
done

DB_MSG_COUNT=$(db "SELECT COUNT(*) FROM \"Message\" WHERE \"conversationId\" = '$CONV_ID';")
assert_eq "10 messages in DB" "10" "$DB_MSG_COUNT"
echo ""

# ── Phase 4: Test Export API ──

echo -e "${YELLOW}Phase 4: Export API${NC}"

if [ "$HAS_AUTH" = "true" ]; then
  # Test TXT export
  TXT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$PROD/api/conversations/$CONV_ID/export?format=txt" 2>/dev/null)
  assert_http "Export TXT status" "200" "$TXT_STATUS"

  TXT_CONTENT=$(curl -s -b "$COOKIE_JAR" "$PROD/api/conversations/$CONV_ID/export?format=txt" 2>/dev/null)
  assert_contains "TXT has title" "E2E Context Test" "$TXT_CONTENT"
  assert_contains "TXT has user label" "Пользователь" "$TXT_CONTENT"
  assert_contains "TXT has assistant label" "Ассистент" "$TXT_CONTENT"

  # Test MD export
  MD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$PROD/api/conversations/$CONV_ID/export?format=md" 2>/dev/null)
  assert_http "Export MD status" "200" "$MD_STATUS"

  MD_CONTENT=$(curl -s -b "$COOKIE_JAR" "$PROD/api/conversations/$CONV_ID/export?format=md" 2>/dev/null)
  assert_contains "MD has heading" "# E2E Context Test" "$MD_CONTENT"

  # Test invalid format
  BAD_FORMAT=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$PROD/api/conversations/$CONV_ID/export?format=pdf" 2>/dev/null)
  assert_http "Invalid format → 400" "400" "$BAD_FORMAT"

  # Test non-existent conversation
  FAKE_EXPORT=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$PROD/api/conversations/00000000-0000-0000-0000-000000000000/export?format=txt" 2>/dev/null)
  assert_http "Non-existent conv → 404" "404" "$FAKE_EXPORT"
else
  echo -e "  ${YELLOW}SKIP${NC} Export API (no auth session)"
fi
echo ""

# ── Phase 5: Test Compact API ──

echo -e "${YELLOW}Phase 5: Compact API${NC}"

if [ "$HAS_AUTH" = "true" ]; then
  # Compact with 10 messages (> 4 minimum)
  COMPACT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$PROD/api/conversations/$CONV_ID/compact" -H "Content-Type: application/json" -H "Origin: $PROD" 2>/dev/null)
  assert_http "Compact status" "200" "$COMPACT_STATUS"

  COMPACT_RESP=$(curl -s -b "$COOKIE_JAR" -X POST "$PROD/api/conversations/$CONV_ID/compact" -H "Content-Type: application/json" -H "Origin: $PROD" 2>/dev/null)
  SUCCESS=$(python3 -c "import sys,json; d=json.loads(sys.argv[1]); print(str(d.get('success',False)).lower())" "$COMPACT_RESP" 2>/dev/null)
  SUMMARIZED=$(python3 -c "import sys,json; d=json.loads(sys.argv[1]); print(d.get('messagesSummarized',0))" "$COMPACT_RESP" 2>/dev/null)
  KEPT=$(python3 -c "import sys,json; d=json.loads(sys.argv[1]); print(d.get('messagesKept',0))" "$COMPACT_RESP" 2>/dev/null)
  assert_eq "Compact success" "true" "$SUCCESS"
  assert_gte "Messages summarized >= 1" 1 "$SUMMARIZED"
  echo "  Summarized: $SUMMARIZED, kept: $KEPT"

  # Wait for background compaction (LLM call can take 10-20s)
  echo "  Waiting for background compaction..."
  for _w in $(seq 1 6); do
    sleep 5
    _sc=$(db "SELECT COUNT(*) FROM \"ConversationSummary\" WHERE \"conversationId\" = '$CONV_ID';")
    [ "$_sc" = "1" ] && break
    echo "    [$_w/6] not yet..."
  done

  # Verify summary created (soft — depends on external LLM API availability)
  SUMMARY_EXISTS=$(db "SELECT COUNT(*) FROM \"ConversationSummary\" WHERE \"conversationId\" = '$CONV_ID';")
  if [ "$SUMMARY_EXISTS" = "1" ]; then
    SUMMARY_LEN=$(db "SELECT LENGTH(content) FROM \"ConversationSummary\" WHERE \"conversationId\" = '$CONV_ID';")
    SUMMARY_VER=$(db "SELECT version FROM \"ConversationSummary\" WHERE \"conversationId\" = '$CONV_ID';")
    assert_gte "Summary content length >= 10" 10 "$SUMMARY_LEN"
    assert_not_empty "Summary version" "$SUMMARY_VER"
    echo "  Summary: ${SUMMARY_LEN} chars, version $SUMMARY_VER"
  else
    echo -e "  ${YELLOW}⚠${NC} Summary not created (LLM API may be unavailable — background compaction is async)"
  fi

  # Small conversation — should fail
  CONV2_ID=$(db "INSERT INTO \"Conversation\" (id, title, \"userId\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), 'E2E Small', '$ADMIN_ID', now(), now()) RETURNING id;" | head -1)
  db "INSERT INTO \"Message\" (id, \"conversationId\", role, content, \"createdAt\") VALUES (gen_random_uuid(), '$CONV2_ID', 'USER', 'hi', now()), (gen_random_uuid(), '$CONV2_ID', 'ASSISTANT', 'hello', now());" >/dev/null
  SMALL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$PROD/api/conversations/$CONV2_ID/compact" -H "Content-Type: application/json" -H "Origin: $PROD" 2>/dev/null)
  assert_http "Too few messages → 400" "400" "$SMALL_STATUS"

  # Non-existent conversation
  FAKE_COMPACT=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$PROD/api/conversations/00000000-0000-0000-0000-000000000000/compact" -H "Content-Type: application/json" -H "Origin: $PROD" 2>/dev/null)
  assert_http "Non-existent conv → 404" "404" "$FAKE_COMPACT"
else
  echo -e "  ${YELLOW}SKIP${NC} Compact API (no auth session)"
  CONV2_ID=""
fi
echo ""

# ── Phase 6: Auth Guard ──

echo -e "${YELLOW}Phase 6: Auth Guard${NC}"
UNAUTH_EXPORT=$(curl -s -o /dev/null -w "%{http_code}" "$PROD/api/conversations/$CONV_ID/export?format=txt" 2>/dev/null)
assert_http "Export requires auth" "401" "$UNAUTH_EXPORT"

# POST without session returns 401 (auth) or 403 (CSRF) — both mean access denied
UNAUTH_COMPACT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$PROD/api/conversations/$CONV_ID/compact" -H "Content-Type: application/json" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ "$UNAUTH_COMPACT" = "401" ] || [ "$UNAUTH_COMPACT" = "403" ]; then
  echo -e "  ${GREEN}✓${NC} Compact requires auth (HTTP $UNAUTH_COMPACT)"; PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Compact requires auth (expected 401/403, got $UNAUTH_COMPACT)"; FAIL=$((FAIL + 1))
fi
echo ""

# ── Phase 7: Cleanup ──

echo -e "${YELLOW}Phase 7: Cleanup${NC}"
db "DELETE FROM \"Message\" WHERE \"conversationId\" = '$CONV_ID';" >/dev/null
db "DELETE FROM \"ConversationSummary\" WHERE \"conversationId\" = '$CONV_ID';" >/dev/null
db "DELETE FROM \"Conversation\" WHERE id = '$CONV_ID';" >/dev/null
if [ -n "${CONV2_ID:-}" ]; then
  db "DELETE FROM \"Message\" WHERE \"conversationId\" = '$CONV2_ID';" >/dev/null
  db "DELETE FROM \"Conversation\" WHERE id = '$CONV2_ID';" >/dev/null
fi
echo -e "  ${GREEN}✓${NC} Test data cleaned up"
echo ""

# ── Results ──

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}  FAILED: $FAIL / $TOTAL tests${NC}"
  echo -e "${GREEN}  PASSED: $PASS / $TOTAL tests${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  exit 1
else
  echo -e "${GREEN}  ALL $TOTAL TESTS PASSED ✓${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  exit 0
fi
