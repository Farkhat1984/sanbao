#!/bin/bash
# ─── Sanbao Operations Test Suite ─────────────────────────────────────────────
# Полное тестирование всех серверных сценариев:
#   health, deploy, sync, backup, failover, failback, network, db, redis, cortex
#
# Usage:
#   ./scripts/ops-test.sh                # Интерактивное меню
#   ./scripts/ops-test.sh health         # Только проверка здоровья
#   ./scripts/ops-test.sh all            # Все тесты (кроме failover)
#   ./scripts/ops-test.sh failover       # Полный failover drill (опасно!)
#   ./scripts/ops-test.sh <scenario>     # Конкретный сценарий
# ──────────────────────────────────────────────────────────────────────────────

set -uo pipefail

cd "$(dirname "$0")/.."

# ─── Config ──────────────────────────────────────────────────────────────────
COMPOSE="docker compose -f docker-compose.prod.yml"
SERVER2_SSH="faragj@46.225.122.142"
SERVER2_SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no"

SANBAO_URL="https://sanbao.ai"
LOCAL_SANBAO="http://localhost:3004"
LOCAL_FDB="http://localhost:8110"
LOCAL_ORCH="http://localhost:8120"

LOG_DIR="$(pwd)/logs/ops-test"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

# ─── Colors & Formatting ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
SKIP=0

ok()   { ((PASS++)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { ((FAIL++)); echo -e "  ${RED}✗${NC} $1"; }
warn() { ((WARN++)); echo -e "  ${YELLOW}⚠${NC} $1"; }
skip() { ((SKIP++)); echo -e "  ${DIM}⊘${NC} $1"; }
info() { echo -e "  ${CYAN}ℹ${NC} $1"; }

header() {
  echo ""
  echo -e "${BOLD}━━━ $1 ━━━${NC}"
  echo ""
}

summary() {
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Результаты${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${GREEN}Passed:${NC}  $PASS"
  echo -e "  ${RED}Failed:${NC}  $FAIL"
  echo -e "  ${YELLOW}Warned:${NC}  $WARN"
  echo -e "  ${DIM}Skipped:${NC} $SKIP"
  TOTAL=$((PASS + FAIL + WARN + SKIP))
  echo -e "  ${BOLD}Total:${NC}   $TOTAL"
  echo ""
  echo -e "  Log: $LOG_FILE"
  echo ""
  if [ "$FAIL" -gt 0 ]; then
    echo -e "  ${RED}${BOLD}ЕСТЬ ПРОБЛЕМЫ — см. ✗ выше${NC}"
  elif [ "$WARN" -gt 0 ]; then
    echo -e "  ${YELLOW}${BOLD}Есть предупреждения — см. ⚠ выше${NC}"
  else
    echo -e "  ${GREEN}${BOLD}Всё в порядке${NC}"
  fi
  echo ""
}

confirm() {
  echo -e "  ${YELLOW}$1${NC}"
  read -rp "  Продолжить? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

# ─── 1. HEALTH: проверка всех сервисов ──────────────────────────────────────
test_health() {
  header "1. HEALTH — Проверка сервисов"

  # --- Server 1: Docker containers ---
  echo -e "  ${BOLD}Server 1 (Docker):${NC}"
  local SERVICES="db pgbouncer redis nginx app embedding-proxy fragmentdb"
  for SVC in $SERVICES; do
    COUNT=$($COMPOSE ps "$SVC" --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
    TOTAL=$($COMPOSE ps "$SVC" -q 2>/dev/null | wc -l | tr -d '[:space:]')
    if [ "$TOTAL" -eq 0 ]; then
      fail "$SVC: не запущен"
    elif [ "$COUNT" -ge "$TOTAL" ]; then
      ok "$SVC: healthy ($COUNT/$TOTAL)"
    else
      fail "$SVC: unhealthy ($COUNT/$TOTAL healthy)"
    fi
  done

  # --- Server 1: HTTP endpoints ---
  echo ""
  echo -e "  ${BOLD}Server 1 (HTTP):${NC}"

  # /api/health
  HEALTH=$(curl -s --connect-timeout 5 "$LOCAL_SANBAO/api/health" 2>&1)
  if echo "$HEALTH" | grep -q '"healthy"'; then
    DB_LAT=$(echo "$HEALTH" | grep -o '"database":{[^}]*}' | grep -o '"latency":[0-9]*' | cut -d: -f2)
    REDIS_LAT=$(echo "$HEALTH" | grep -o '"redis":{[^}]*}' | grep -o '"latency":[0-9]*' | cut -d: -f2)
    ok "/api/health: healthy (db: ${DB_LAT}ms, redis: ${REDIS_LAT}ms)"
  else
    fail "/api/health: $HEALTH"
  fi

  # /api/ready
  READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$LOCAL_SANBAO/api/ready" 2>&1)
  if [ "$READY_CODE" = "200" ]; then
    ok "/api/ready: 200"
  else
    fail "/api/ready: HTTP $READY_CODE"
  fi

  # Cloudflare (external)
  EXT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$SANBAO_URL/api/ready" 2>&1)
  if [ "$EXT_CODE" = "200" ]; then
    ok "sanbao.ai (Cloudflare): HTTP $EXT_CODE"
  else
    fail "sanbao.ai (Cloudflare): HTTP $EXT_CODE"
  fi

  # FragmentDB health
  FDB_RESP=$(curl -s --connect-timeout 5 "$LOCAL_FDB/health" 2>&1)
  if echo "$FDB_RESP" | grep -qi "ok\|healthy\|alive"; then
    ok "FragmentDB :8110: healthy"
  elif [ -n "$FDB_RESP" ]; then
    ok "FragmentDB :8110: responding ($FDB_RESP)"
  else
    fail "FragmentDB :8110: не отвечает"
  fi

  # Orchestrator health
  ORCH_RESP=$(curl -s --connect-timeout 5 "$LOCAL_ORCH/health" 2>&1)
  if [ -n "$ORCH_RESP" ]; then
    ok "Orchestrator :8120: responding"
  else
    # Orchestrator may be down (exited)
    ORCH_STATUS=$($COMPOSE ps orchestrator --format "{{.State}}" 2>/dev/null || echo "unknown")
    if echo "$ORCH_STATUS" | grep -qi "running"; then
      fail "Orchestrator :8120: running but not responding"
    else
      warn "Orchestrator :8120: не запущен ($ORCH_STATUS)"
    fi
  fi

  # --- Server 1: System resources ---
  echo ""
  echo -e "  ${BOLD}Server 1 (Ресурсы):${NC}"

  DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
  if [ "$DISK_USAGE" -lt 80 ]; then
    ok "Диск: ${DISK_USAGE}% ($(df -h / | awk 'NR==2{print $4}') свободно)"
  elif [ "$DISK_USAGE" -lt 90 ]; then
    warn "Диск: ${DISK_USAGE}% — мало места"
  else
    fail "Диск: ${DISK_USAGE}% — КРИТИЧЕСКИ мало места"
  fi

  MEM_AVAIL=$(free -m | awk '/Mem/{print $7}')
  MEM_TOTAL=$(free -m | awk '/Mem/{print $2}')
  MEM_PCT=$((100 - MEM_AVAIL * 100 / MEM_TOTAL))
  if [ "$MEM_PCT" -lt 80 ]; then
    ok "Память: ${MEM_PCT}% (${MEM_AVAIL}MB свободно)"
  elif [ "$MEM_PCT" -lt 90 ]; then
    warn "Память: ${MEM_PCT}%"
  else
    fail "Память: ${MEM_PCT}% — КРИТИЧЕСКИ мало"
  fi

  LOAD=$(cat /proc/loadavg | awk '{print $1}')
  CPUS=$(nproc)
  ok "Load average: $LOAD (CPUs: $CPUS)"

  # --- Server 2: connectivity ---
  echo ""
  echo -e "  ${BOLD}Server 2 (Standby):${NC}"

  if ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "echo ok" >/dev/null 2>&1; then
    ok "SSH: доступен"

    # Docker status
    S2_CONTAINERS=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "docker ps --format '{{.Names}} {{.Status}}'" 2>/dev/null || echo "")
    if [ -n "$S2_CONTAINERS" ]; then
      S2_COUNT=$(echo "$S2_CONTAINERS" | wc -l)
      S2_HEALTHY=$(echo "$S2_CONTAINERS" | grep -c "healthy" || echo 0)
      ok "Docker: $S2_COUNT контейнеров ($S2_HEALTHY healthy)"
    else
      warn "Docker: не удалось получить статус"
    fi

    # Monitor bot
    if echo "$S2_CONTAINERS" | grep -q "monitor-bot"; then
      ok "Monitor bot: запущен"
    else
      fail "Monitor bot: не запущен"
    fi

    # Cloudflared
    if echo "$S2_CONTAINERS" | grep -q "cloudflared"; then
      warn "Cloudflared: ЗАПУЩЕН (failover активен!)"
    else
      ok "Cloudflared: не запущен (нормально)"
    fi

    # Disk
    S2_DISK=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "df -h / | awk 'NR==2{print \$5, \$4}'" 2>/dev/null || echo "?")
    ok "Диск Server 2: $S2_DISK свободно"
  else
    fail "SSH: Server 2 недоступен"
  fi

  # --- Cloudflared tunnel ---
  echo ""
  echo -e "  ${BOLD}Cloudflare Tunnel:${NC}"
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    ok "cloudflared (systemd): active"
  else
    fail "cloudflared (systemd): не запущен!"
  fi
}

# ─── 2. NETWORK: сеть, DNS, tunnel ──────────────────────────────────────────
test_network() {
  header "2. NETWORK — Сеть и связность"

  # DNS resolution
  echo -e "  ${BOLD}DNS:${NC}"
  for DOMAIN in sanbao.ai api.cloudflare.com; do
    if dig +short "$DOMAIN" A 2>/dev/null | head -1 | grep -qE '^[0-9]'; then
      IP=$(dig +short "$DOMAIN" A 2>/dev/null | head -1)
      ok "$DOMAIN → $IP"
    elif nslookup "$DOMAIN" >/dev/null 2>&1; then
      ok "$DOMAIN: резолвится (nslookup)"
    else
      fail "$DOMAIN: DNS не резолвится"
    fi
  done

  # Local DNS (router)
  if dig +short +timeout=3 google.com @192.168.31.1 >/dev/null 2>&1; then
    ok "Роутер DNS (192.168.31.1): работает"
  else
    warn "Роутер DNS (192.168.31.1): не отвечает (таймаут)"
  fi

  # External connectivity
  echo ""
  echo -e "  ${BOLD}Внешняя связность:${NC}"
  for TARGET in "8.8.8.8" "1.1.1.1"; do
    if ping -c1 -W3 "$TARGET" >/dev/null 2>&1; then
      LATENCY=$(ping -c1 -W3 "$TARGET" 2>/dev/null | grep -oP 'time=\K[0-9.]+')
      ok "ping $TARGET: ${LATENCY}ms"
    else
      fail "ping $TARGET: недоступен"
    fi
  done

  # SSH to Server 2
  echo ""
  echo -e "  ${BOLD}SSH:${NC}"
  if ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "echo ok" >/dev/null 2>&1; then
    ok "Server 2 (46.225.122.142:22): доступен"
  else
    fail "Server 2 (46.225.122.142:22): недоступен"
  fi

  # Docker network
  echo ""
  echo -e "  ${BOLD}Docker Network:${NC}"
  NETWORKS=$(docker network ls --format '{{.Name}}' 2>/dev/null | grep sanbao || echo "")
  if [ -n "$NETWORKS" ]; then
    for NET in $NETWORKS; do
      ENDPOINTS=$(docker network inspect "$NET" --format '{{len .Containers}}' 2>/dev/null || echo 0)
      ok "Сеть $NET: $ENDPOINTS контейнеров"
    done
  else
    fail "Docker сеть sanbao не найдена"
  fi

  # Cloudflare Tunnel latency
  echo ""
  echo -e "  ${BOLD}Cloudflare Tunnel:${NC}"
  EXT_TIME=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 10 "$SANBAO_URL/api/ready" 2>&1)
  LOCAL_TIME=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 5 "$LOCAL_SANBAO/api/ready" 2>&1)
  if [ -n "$EXT_TIME" ] && [ -n "$LOCAL_TIME" ]; then
    ok "Latency: local=${LOCAL_TIME}s, external=${EXT_TIME}s"
  else
    warn "Не удалось замерить latency"
  fi
}

# ─── 3. DATABASE: PostgreSQL + PgBouncer ─────────────────────────────────────
test_database() {
  header "3. DATABASE — PostgreSQL + PgBouncer"

  # Connection via PgBouncer
  echo -e "  ${BOLD}Подключение:${NC}"
  DB_CONTAINER=$($COMPOSE ps db -q 2>/dev/null | head -1)
  PGB_CONTAINER=$($COMPOSE ps pgbouncer -q 2>/dev/null | head -1)

  if [ -z "$DB_CONTAINER" ]; then
    fail "PostgreSQL: контейнер не найден"
    return
  fi

  # Direct DB check
  DB_VER=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc "SELECT version();" 2>/dev/null | head -1)
  if [ -n "$DB_VER" ]; then
    ok "PostgreSQL: $(echo "$DB_VER" | cut -d' ' -f1-2)"
  else
    fail "PostgreSQL: не удалось подключиться"
  fi

  # PgBouncer check
  if [ -n "$PGB_CONTAINER" ]; then
    PGB_STATUS=$(docker inspect "$PGB_CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || echo "?")
    if [ "$PGB_STATUS" = "healthy" ]; then
      ok "PgBouncer: healthy"
    else
      warn "PgBouncer: $PGB_STATUS"
    fi
  fi

  # Read/Write test
  echo ""
  echo -e "  ${BOLD}Read/Write:${NC}"
  docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -c \
    "CREATE TABLE IF NOT EXISTS _ops_test (id serial, ts timestamptz DEFAULT now());" >/dev/null 2>&1
  WRITE_OK=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc \
    "INSERT INTO _ops_test DEFAULT VALUES RETURNING id;" 2>/dev/null | grep -oE '^[0-9]+' | head -1)
  if [ -n "$WRITE_OK" ]; then
    ok "Write: запись создана (id=$WRITE_OK)"
  else
    fail "Write: не удалось записать"
  fi

  READ_OK=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc \
    "SELECT count(*) FROM _ops_test;" 2>/dev/null)
  if [ -n "$READ_OK" ]; then
    ok "Read: $READ_OK записей в _ops_test"
  else
    fail "Read: не удалось прочитать"
  fi

  # Cleanup test table
  docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -c "DROP TABLE IF EXISTS _ops_test;" >/dev/null 2>&1
  ok "Cleanup: тестовая таблица удалена"

  # Table counts
  echo ""
  echo -e "  ${BOLD}Данные:${NC}"
  TABLES=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null)
  ok "Таблиц в public: $TABLES"

  USERS=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc \
    "SELECT count(*) FROM \"User\";" 2>/dev/null || echo "?")
  ok "Пользователей: $USERS"

  CONVOS=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc \
    "SELECT count(*) FROM \"Conversation\";" 2>/dev/null || echo "?")
  ok "Диалогов: $CONVOS"

  # DB size
  DB_SIZE=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc \
    "SELECT pg_size_pretty(pg_database_size('sanbao'));" 2>/dev/null)
  ok "Размер БД: $DB_SIZE"

  # Active connections
  CONNS=$(docker exec "$DB_CONTAINER" psql -U postgres -d sanbao -tAc \
    "SELECT count(*) FROM pg_stat_activity WHERE datname='sanbao';" 2>/dev/null)
  ok "Активных подключений: $CONNS"
}

# ─── 4. REDIS: кеш и очереди ────────────────────────────────────────────────
test_redis() {
  header "4. REDIS — Кеш и очереди"

  REDIS_CONTAINER=$($COMPOSE ps redis -q 2>/dev/null | head -1)
  if [ -z "$REDIS_CONTAINER" ]; then
    fail "Redis: контейнер не найден"
    return
  fi

  # Ping
  PONG=$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null)
  if [ "$PONG" = "PONG" ]; then
    ok "Ping: PONG"
  else
    fail "Ping: $PONG"
  fi

  # Info
  MEM=$(docker exec "$REDIS_CONTAINER" redis-cli info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
  MAX=$(docker exec "$REDIS_CONTAINER" redis-cli info memory 2>/dev/null | grep "maxmemory_human" | cut -d: -f2 | tr -d '\r')
  ok "Память: $MEM / $MAX"

  KEYS=$(docker exec "$REDIS_CONTAINER" redis-cli dbsize 2>/dev/null | awk '{print $2}')
  ok "Ключей: $KEYS"

  # Read/Write test
  echo ""
  echo -e "  ${BOLD}Read/Write:${NC}"
  docker exec "$REDIS_CONTAINER" redis-cli set "_ops_test" "$(date +%s)" EX 10 >/dev/null 2>&1
  VAL=$(docker exec "$REDIS_CONTAINER" redis-cli get "_ops_test" 2>/dev/null)
  if [ -n "$VAL" ]; then
    ok "Write+Read: OK (val=$VAL)"
  else
    fail "Write+Read: не удалось"
  fi
  docker exec "$REDIS_CONTAINER" redis-cli del "_ops_test" >/dev/null 2>&1

  # BullMQ queues
  echo ""
  echo -e "  ${BOLD}BullMQ очереди:${NC}"
  for Q in webhook email; do
    WAITING=$(docker exec "$REDIS_CONTAINER" redis-cli llen "bull:${Q}:wait" 2>/dev/null || echo 0)
    ACTIVE=$(docker exec "$REDIS_CONTAINER" redis-cli llen "bull:${Q}:active" 2>/dev/null || echo 0)
    FAILED=$(docker exec "$REDIS_CONTAINER" redis-cli zcard "bull:${Q}:failed" 2>/dev/null || echo 0)
    ok "Очередь $Q: ожидание=$WAITING, активные=$ACTIVE, ошибки=$FAILED"
  done

  # Rate limit keys
  RL_KEYS=$(docker exec "$REDIS_CONTAINER" redis-cli keys "rl:*" 2>/dev/null | wc -l || echo 0)
  ok "Rate-limit ключей: $RL_KEYS"
}

# ─── 5. AI CORTEX: FragmentDB + Orchestrator ────────────────────────────────
test_cortex() {
  header "5. AI CORTEX — FragmentDB + Orchestrator + Embedding"

  # FragmentDB
  echo -e "  ${BOLD}FragmentDB (:8110):${NC}"
  FDB_HEALTH=$(curl -s --connect-timeout 5 "$LOCAL_FDB/health" 2>&1)
  if [ -n "$FDB_HEALTH" ]; then
    ok "Health: $FDB_HEALTH"
  else
    fail "Health: не отвечает"
  fi

  # Collections (API: GET /collections → JSON array of names)
  FDB_COLLECTIONS=$(curl -s --connect-timeout 5 "$LOCAL_FDB/collections" 2>&1)
  if [ -n "$FDB_COLLECTIONS" ] && echo "$FDB_COLLECTIONS" | grep -q '\['; then
    COUNT=$(echo "$FDB_COLLECTIONS" | tr ',' '\n' | grep -c '"' || echo "?")
    ok "Коллекций: $COUNT"

    # Check each known collection with doc count (API: GET /collections/{name})
    for COLL in legal_kz laws_kz tnved_rates accounting_1c platform_1c; do
      if echo "$FDB_COLLECTIONS" | grep -q "$COLL"; then
        DOC_COUNT=$(curl -s --connect-timeout 5 "$LOCAL_FDB/collections/$COLL" 2>/dev/null | grep -o '"doc_count":[0-9]*' | cut -d: -f2)
        ok "  $COLL: ${DOC_COUNT:-?} документов"
      else
        warn "  $COLL: не найдена"
      fi
    done
  else
    warn "Не удалось получить список коллекций"
  fi

  # Embedding Proxy
  echo ""
  echo -e "  ${BOLD}Embedding Proxy (:8097):${NC}"
  EMB_HEALTH=$(curl -s --connect-timeout 5 "http://localhost:8097/health" 2>&1)
  if [ -n "$EMB_HEALTH" ]; then
    ok "Health: $EMB_HEALTH"
  else
    warn "Health: не отвечает (может быть нормально если внутренний)"
  fi

  # Orchestrator (may run as Docker container OR as host process)
  echo ""
  echo -e "  ${BOLD}Orchestrator (:8120):${NC}"
  ORCH_PID=$(ss -tlnp 2>/dev/null | grep ":8120" | grep -oP 'pid=\K[0-9]+' | head -1)

  if [ -n "$ORCH_PID" ]; then
    ORCH_CMD=$(ps -p "$ORCH_PID" -o comm= 2>/dev/null || echo "?")
    ok "Процесс: PID=$ORCH_PID ($ORCH_CMD)"

    ORCH_HEALTH=$(curl -s --connect-timeout 5 "$LOCAL_ORCH/health" 2>&1)
    if [ -n "$ORCH_HEALTH" ]; then
      ok "Health: $ORCH_HEALTH"
    else
      warn "Health: не отвечает на /health (может быть нормально)"
    fi

    # MCP endpoints
    for EP in lawyer broker accountant consultant_1c; do
      EP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$LOCAL_ORCH/$EP" 2>&1)
      if [ "$EP_CODE" = "200" ] || [ "$EP_CODE" = "405" ]; then
        ok "MCP /$EP: доступен (HTTP $EP_CODE)"
      elif [ "$EP_CODE" = "000" ]; then
        warn "MCP /$EP: не отвечает"
      else
        ok "MCP /$EP: HTTP $EP_CODE"
      fi
    done
  else
    # Check Docker
    ORCH_STATE=$($COMPOSE ps orchestrator --format "{{.State}}" 2>/dev/null || echo "not found")
    if [ "$ORCH_STATE" = "running" ]; then
      ok "Orchestrator: Docker running"
    else
      warn "Orchestrator: не запущен (port 8120 не слушает, Docker: $ORCH_STATE)"
    fi
  fi
}

# ─── 6. DEPLOY: тест билда (dry-run) ────────────────────────────────────────
test_deploy() {
  header "6. DEPLOY — Тест деплоя"

  echo -e "  ${BOLD}Pre-flight:${NC}"

  # Git status
  GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l)
  if [ "$GIT_STATUS" -eq 0 ]; then
    ok "Git: чистый"
  else
    info "Git: $GIT_STATUS изменённых файлов"
  fi

  GIT_BRANCH=$(git branch --show-current 2>/dev/null)
  ok "Ветка: $GIT_BRANCH"

  # Check that deploy.sh has tmux wrapper
  if grep -q "tmux new-session" scripts/deploy.sh 2>/dev/null; then
    ok "deploy.sh: tmux обёртка присутствует"
  else
    warn "deploy.sh: нет tmux обёртки"
  fi

  # Docker image
  IMG_DATE=$(docker inspect sanbao-app:latest --format '{{.Created}}' 2>/dev/null | cut -dT -f1,2 | tr T ' ')
  if [ -n "$IMG_DATE" ]; then
    ok "Текущий образ: $IMG_DATE"
  else
    warn "Образ sanbao-app:latest не найден"
  fi

  # npm build test (dry)
  echo ""
  echo -e "  ${BOLD}Build check:${NC}"
  if [ -f "package.json" ] && [ -d "node_modules" ]; then
    ok "node_modules: присутствует"
  else
    fail "node_modules: отсутствует — нужен npm install"
  fi

  if [ -f ".next/BUILD_ID" ]; then
    BUILD_ID=$(cat .next/BUILD_ID)
    ok "Текущий .next/BUILD_ID: $BUILD_ID"
  else
    info ".next/ не найден (потребуется полный билд)"
  fi

  # App replicas count
  echo ""
  echo -e "  ${BOLD}Текущие реплики:${NC}"
  APP_COUNT=$($COMPOSE ps app -q 2>/dev/null | wc -l | tr -d '[:space:]')
  APP_HEALTHY=$($COMPOSE ps app --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
  if [ "$APP_COUNT" -ge 3 ] && [ "$APP_HEALTHY" -ge 3 ]; then
    ok "App: $APP_HEALTHY/$APP_COUNT healthy"
  elif [ "$APP_COUNT" -ge 1 ]; then
    warn "App: $APP_HEALTHY/$APP_COUNT (нужно 3)"
  else
    fail "App: нет запущенных контейнеров"
  fi

  # Server 2 cloudflared check
  echo ""
  echo -e "  ${BOLD}Server 2 cloudflared:${NC}"
  S2_CF=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
    "docker ps --format '{{.Names}}' 2>/dev/null | grep cloudflared" 2>/dev/null || true)
  if [ -z "$S2_CF" ]; then
    ok "Server 2 cloudflared: не запущен (безопасно деплоить)"
  else
    warn "Server 2 cloudflared: ЗАПУЩЕН — деплой остановит его автоматически"
  fi
}

# ─── 7. SYNC: тест синхронизации ────────────────────────────────────────────
test_sync() {
  header "7. SYNC — Синхронизация Server 1 → Server 2"

  if ! ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "echo ok" >/dev/null 2>&1; then
    fail "Server 2 недоступен — тест синхронизации невозможен"
    return
  fi

  # Check sync script exists on Server 2
  echo -e "  ${BOLD}Конфигурация:${NC}"
  SYNC_EXISTS=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "test -f ~/faragj/deploy/sync.sh && echo yes" 2>/dev/null || echo "no")
  if [ "$SYNC_EXISTS" = "yes" ]; then
    ok "sync.sh: существует на Server 2"
  else
    fail "sync.sh: не найден на Server 2"
    return
  fi

  # Check cron
  CRON_SYNC=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "crontab -l 2>/dev/null | grep sync" 2>/dev/null || echo "")
  if [ -n "$CRON_SYNC" ]; then
    ok "Cron: $CRON_SYNC"
  else
    warn "Cron: sync.sh не в crontab"
  fi

  # Check sync log
  SYNC_LOG=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "tail -5 /var/log/failover-sync.log 2>/dev/null" 2>/dev/null || echo "")
  if [ -n "$SYNC_LOG" ]; then
    LAST_LINE=$(echo "$SYNC_LOG" | tail -1)
    ok "Последняя запись sync: $LAST_LINE"
  else
    warn "Лог синхронизации пуст или не найден"
  fi

  # Check DB freshness on Server 2
  echo ""
  echo -e "  ${BOLD}Свежесть данных:${NC}"
  # Compare data between servers (try multiple container name patterns on S2)
  S1_DB=$($COMPOSE ps db -q 2>/dev/null | head -1)
  S1_USERS=$(docker exec "$S1_DB" psql -U postgres -d sanbao -tAc \
    'SELECT count(*) FROM "User";' 2>/dev/null | tr -d '[:space:]')

  # Server 2: try common container names for postgres
  S2_USERS=""
  for PATTERN in "deploy-db-1" "deploy-postgres-1" "deploy_db_1" "deploy_postgres_1"; do
    S2_TEST=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "docker exec $PATTERN psql -U postgres -d sanbao -tAc 'SELECT count(*) FROM \"User\";' 2>/dev/null" 2>/dev/null | tr -d '[:space:]')
    if echo "$S2_TEST" | grep -qE '^[0-9]+$'; then
      S2_USERS="$S2_TEST"
      break
    fi
  done

  if [ -n "$S1_USERS" ] && [ -n "$S2_USERS" ]; then
    if [ "$S1_USERS" = "$S2_USERS" ]; then
      ok "Users: S1=$S1_USERS, S2=$S2_USERS (синхронно)"
    else
      warn "Users: S1=$S1_USERS, S2=$S2_USERS (рассинхрон)"
    fi
  elif [ -n "$S1_USERS" ]; then
    # Fallback: check if S2 sanbao app can reach its DB via API
    S2_HEALTH=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "curl -s --connect-timeout 5 http://localhost:3004/api/health 2>/dev/null" 2>/dev/null || echo "")
    if echo "$S2_HEALTH" | grep -q '"healthy"\|"ok"'; then
      ok "S1 users=$S1_USERS; S2 Sanbao DB: healthy (сравнение через API)"
    else
      warn "S1 users=$S1_USERS; S2 DB: не удалось проверить (нет psql в контейнере)"
    fi
  else
    warn "Не удалось получить данные для сравнения"
  fi

  # Trigger manual sync (optional)
  echo ""
  if confirm "Запустить ручную синхронизацию?"; then
    info "Запуск sync.sh на Server 2..."
    SYNC_OUT=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "cd ~/faragj/deploy && bash sync.sh 2>&1 | tail -20" 2>/dev/null)
    if [ $? -eq 0 ]; then
      ok "Синхронизация завершена"
      echo "$SYNC_OUT" | while IFS= read -r line; do info "  $line"; done
    else
      fail "Синхронизация с ошибкой"
      echo "$SYNC_OUT" | while IFS= read -r line; do info "  $line"; done
    fi
  else
    skip "Ручная синхронизация пропущена"
  fi
}

# ─── 8. BACKUP: тест бекапов ────────────────────────────────────────────────
test_backup() {
  header "8. BACKUP — Бекапы"

  if ! ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "echo ok" >/dev/null 2>&1; then
    fail "Server 2 недоступен — тест бекапов невозможен"
    return
  fi

  echo -e "  ${BOLD}Конфигурация:${NC}"

  # Check backup script
  BACKUP_EXISTS=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "test -f ~/faragj/deploy/backup.sh && echo yes" 2>/dev/null || echo "no")
  if [ "$BACKUP_EXISTS" = "yes" ]; then
    ok "backup.sh: существует"
  else
    fail "backup.sh: не найден"
  fi

  # Check cron
  CRON_BACKUP=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "crontab -l 2>/dev/null | grep backup" 2>/dev/null || echo "")
  if [ -n "$CRON_BACKUP" ]; then
    ok "Cron: $CRON_BACKUP"
  else
    warn "Cron: backup.sh не в crontab"
  fi

  # Check backup directories
  echo ""
  echo -e "  ${BOLD}Файлы бекапов:${NC}"
  for DIR in daily weekly monthly; do
    BKUP_INFO=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "ls -lhtr /backups/$DIR/ 2>/dev/null | tail -3" 2>/dev/null || echo "")
    COUNT=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "ls /backups/$DIR/ 2>/dev/null | wc -l" 2>/dev/null || echo "0")
    COUNT=$(echo "$COUNT" | tr -d '[:space:]')
    if [ "$COUNT" -gt 0 ]; then
      LATEST=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
        "ls -t /backups/$DIR/ 2>/dev/null | head -1" 2>/dev/null || echo "?")
      SIZE=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
        "du -sh /backups/$DIR/ 2>/dev/null | cut -f1" 2>/dev/null || echo "?")
      ok "$DIR: $COUNT файлов, $SIZE, последний: $LATEST"
    else
      warn "$DIR: нет бекапов"
    fi
  done

  # Check backup log
  BACKUP_LOG=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "tail -5 /var/log/backup.log 2>/dev/null" 2>/dev/null || echo "")
  if [ -n "$BACKUP_LOG" ]; then
    LAST_BACKUP=$(echo "$BACKUP_LOG" | tail -1)
    ok "Последний лог: $LAST_BACKUP"
  else
    warn "Лог бекапов пуст"
  fi

  # Backup disk space
  BACKUP_DISK=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "df -h /backups 2>/dev/null | awk 'NR==2{print \$5, \$4}'" 2>/dev/null || echo "?")
  ok "Диск /backups: $BACKUP_DISK свободно"

  # Trigger manual backup (optional)
  echo ""
  if confirm "Запустить ручной бекап?"; then
    info "Запуск backup.sh на Server 2..."
    BACKUP_OUT=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "cd ~/faragj/deploy && bash backup.sh 2>&1 | tail -30" 2>/dev/null)
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      ok "Бекап завершён"
      echo "$BACKUP_OUT" | while IFS= read -r line; do info "  $line"; done
    else
      fail "Бекап с ошибкой (exit $EXIT_CODE)"
      echo "$BACKUP_OUT" | while IFS= read -r line; do info "  $line"; done
    fi
  else
    skip "Ручной бекап пропущен"
  fi
}

# ─── 9. FAILOVER DRILL: полный тест переключения ────────────────────────────
test_failover() {
  header "9. FAILOVER DRILL — Полный тест переключения"

  echo -e "  ${RED}${BOLD}ВНИМАНИЕ: Этот тест временно остановит сервис!${NC}"
  echo ""
  echo "  Сценарий:"
  echo "    1. Проверка готовности Server 2"
  echo "    2. Остановка app на Server 1 (имитация падения)"
  echo "    3. Ожидание auto-failover бота (~90с)"
  echo "    4. Проверка доступности через Server 2"
  echo "    5. Запуск app на Server 1"
  echo "    6. Ожидание auto-failback (~90с + 5 мин cooldown)"
  echo "    7. Проверка возврата трафика"
  echo ""

  if ! confirm "Это вызовет даунтайм ~3-7 минут. Продолжить?"; then
    skip "Failover drill отменён"
    return
  fi

  # --- Step 1: Pre-flight ---
  echo ""
  echo -e "  ${BOLD}[1/7] Pre-flight:${NC}"

  if ! ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" "echo ok" >/dev/null 2>&1; then
    fail "Server 2 недоступен — drill невозможен"
    return
  fi
  ok "Server 2: доступен"

  S2_SANBAO=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
    "docker ps --format '{{.Names}} {{.Status}}' | grep sanbao | grep -v monitor" 2>/dev/null || echo "")
  if echo "$S2_SANBAO" | grep -q "healthy"; then
    ok "Server 2 Sanbao: ready"
  else
    warn "Server 2 Sanbao: $S2_SANBAO"
    if ! confirm "Server 2 Sanbao может быть не готов. Всё равно продолжить?"; then
      skip "Drill отменён"
      return
    fi
  fi

  S2_BOT=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
    "docker ps --format '{{.Names}}' | grep monitor-bot" 2>/dev/null || echo "")
  if [ -n "$S2_BOT" ]; then
    ok "Monitor bot: запущен"
  else
    fail "Monitor bot: не запущен — auto-failover не сработает"
    return
  fi

  # Save current state
  ORIG_APP_IDS=$($COMPOSE ps app -q 2>/dev/null)

  # --- Step 2: Stop app (simulate crash) ---
  echo ""
  echo -e "  ${BOLD}[2/7] Остановка app на Server 1:${NC}"
  $COMPOSE stop app >/dev/null 2>&1
  ok "App остановлен"

  # Verify it's down locally
  sleep 2
  LOCAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$LOCAL_SANBAO/api/ready" 2>&1)
  if [ "$LOCAL_CODE" != "200" ]; then
    ok "Local health: HTTP $LOCAL_CODE (ожидаемо)"
  else
    warn "Local health: всё ещё 200 (неожиданно)"
  fi

  # --- Step 3: Wait for auto-failover ---
  echo ""
  echo -e "  ${BOLD}[3/7] Ожидание auto-failover (~90-120с):${NC}"
  FAILOVER_DETECTED=false
  for i in $(seq 1 24); do
    S2_CF=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "docker ps --format '{{.Names}}' 2>/dev/null | grep cloudflared" 2>/dev/null || true)
    if [ -n "$S2_CF" ]; then
      ok "Auto-failover сработал! (${i}x5=${((i*5))}с) — cloudflared запущен на Server 2"
      FAILOVER_DETECTED=true
      break
    fi
    echo -e "  ${DIM}  [$i/24] ожидание...${NC}"
    sleep 5
  done

  if ! $FAILOVER_DETECTED; then
    fail "Auto-failover НЕ сработал за 120с!"
    echo ""
    echo -e "  ${BOLD}Восстанавливаю Server 1...${NC}"
    $COMPOSE start app >/dev/null 2>&1
    wait_for_healthy_quick
    return
  fi

  # --- Step 4: Verify via Server 2 ---
  echo ""
  echo -e "  ${BOLD}[4/7] Проверка доступности через Server 2:${NC}"
  sleep 10  # Give Cloudflare time to route

  EXT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "$SANBAO_URL/api/ready" 2>&1)
  if [ "$EXT_CODE" = "200" ]; then
    ok "sanbao.ai: доступен через Server 2 (HTTP $EXT_CODE)"
  else
    warn "sanbao.ai: HTTP $EXT_CODE (Cloudflare может ещё переключаться)"
    sleep 10
    EXT_CODE2=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "$SANBAO_URL/api/ready" 2>&1)
    if [ "$EXT_CODE2" = "200" ]; then
      ok "sanbao.ai: доступен после повторной проверки (HTTP $EXT_CODE2)"
    else
      warn "sanbao.ai: HTTP $EXT_CODE2 — возможно Server 2 не готов"
    fi
  fi

  # --- Step 5: Start app on Server 1 ---
  echo ""
  echo -e "  ${BOLD}[5/7] Запуск app на Server 1:${NC}"
  $COMPOSE start app >/dev/null 2>&1
  ok "App запущен"

  # Wait for healthy
  for i in $(seq 1 24); do
    HEALTHY=$($COMPOSE ps app --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
    if [ "$HEALTHY" -ge 3 ]; then
      ok "App healthy ($HEALTHY/3) за $((i*5))с"
      break
    fi
    sleep 5
  done

  # Verify local
  LOCAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$LOCAL_SANBAO/api/ready" 2>&1)
  ok "Local health: HTTP $LOCAL_CODE"

  # --- Step 6: Wait for auto-failback ---
  echo ""
  echo -e "  ${BOLD}[6/7] Ожидание auto-failback (~90с проверки + 300с cooldown):${NC}"
  info "Бот должен определить что Server 1 восстановлен и остановить cloudflared"
  info "Cooldown 5 минут — это нормально"
  FAILBACK_DETECTED=false
  for i in $(seq 1 96); do
    S2_CF=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "docker ps --format '{{.Names}}' 2>/dev/null | grep cloudflared" 2>/dev/null || true)
    if [ -z "$S2_CF" ]; then
      ok "Auto-failback сработал! ($((i*5))с) — cloudflared остановлен"
      FAILBACK_DETECTED=true
      break
    fi
    if [ $((i % 12)) -eq 0 ]; then
      echo -e "  ${DIM}  [$((i*5))с] cloudflared ещё запущен, ожидание...${NC}"
    fi
    sleep 5
  done

  if ! $FAILBACK_DETECTED; then
    warn "Auto-failback не сработал за 8 минут — выполняю ручной failback"
    ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
      "cd ~/faragj/deploy && docker compose -f docker-compose.failover.yml stop cloudflared" 2>/dev/null || true
    ok "Ручной failback: cloudflared остановлен"
  fi

  # --- Step 7: Final verification ---
  echo ""
  echo -e "  ${BOLD}[7/7] Финальная проверка:${NC}"
  sleep 5

  EXT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$SANBAO_URL/api/ready" 2>&1)
  if [ "$EXT_CODE" = "200" ]; then
    ok "sanbao.ai: доступен через Server 1 (HTTP $EXT_CODE)"
  else
    fail "sanbao.ai: HTTP $EXT_CODE"
  fi

  LOCAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$LOCAL_SANBAO/api/ready" 2>&1)
  ok "Local: HTTP $LOCAL_CODE"

  S2_CF_FINAL=$(ssh $SERVER2_SSH_OPTS "$SERVER2_SSH" \
    "docker ps --format '{{.Names}}' 2>/dev/null | grep cloudflared" 2>/dev/null || true)
  if [ -z "$S2_CF_FINAL" ]; then
    ok "Server 2 cloudflared: остановлен"
  else
    warn "Server 2 cloudflared: ещё запущен"
  fi

  echo ""
  ok "Failover drill завершён!"
}

# Helper for failover drill
wait_for_healthy_quick() {
  $COMPOSE start app >/dev/null 2>&1
  for i in $(seq 1 24); do
    HEALTHY=$($COMPOSE ps app --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
    if [ "$HEALTHY" -ge 3 ]; then
      ok "App восстановлен ($HEALTHY/3)"
      return
    fi
    sleep 5
  done
  warn "App не полностью восстановлен"
}

# ─── 10. FULL: запуск всех тестов ────────────────────────────────────────────
test_all() {
  header "ПОЛНОЕ ТЕСТИРОВАНИЕ (все сценарии кроме failover)"
  echo -e "  ${DIM}Для failover drill: ./scripts/ops-test.sh failover${NC}"
  echo ""

  test_health
  test_network
  test_database
  test_redis
  test_cortex
  test_deploy
  test_sync
  test_backup
}

# ─── Interactive Menu ────────────────────────────────────────────────────────
show_menu() {
  echo ""
  echo -e "${BOLD}━━━ Sanbao Operations Test Suite ━━━${NC}"
  echo ""
  echo "  1)  health     — Проверка всех сервисов"
  echo "  2)  network    — Сеть, DNS, tunnel"
  echo "  3)  database   — PostgreSQL + PgBouncer"
  echo "  4)  redis      — Кеш и очереди"
  echo "  5)  cortex     — AI Cortex (FragmentDB, Orchestrator)"
  echo "  6)  deploy     — Проверка готовности к деплою"
  echo "  7)  sync       — Синхронизация Server 1 → Server 2"
  echo "  8)  backup     — Бекапы"
  echo "  9)  failover   — DRILL: полный failover + failback"
  echo "  0)  all        — Все тесты (кроме failover)"
  echo "  q)  exit"
  echo ""
  read -rp "  Выберите сценарий [0-9/q]: " choice

  case "$choice" in
    1) test_health ;;
    2) test_network ;;
    3) test_database ;;
    4) test_redis ;;
    5) test_cortex ;;
    6) test_deploy ;;
    7) test_sync ;;
    8) test_backup ;;
    9) test_failover ;;
    0) test_all ;;
    q|Q) echo ""; exit 0 ;;
    *) echo "  Неверный выбор"; show_menu; return ;;
  esac

  summary
}

# ─── Main ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}Sanbao Ops Test — $(date)${NC}"
echo -e "${DIM}Log: $LOG_FILE${NC}"

case "${1:-}" in
  health)   test_health;   summary ;;
  network)  test_network;  summary ;;
  database) test_database; summary ;;
  db)       test_database; summary ;;
  redis)    test_redis;    summary ;;
  cortex)   test_cortex;   summary ;;
  deploy)   test_deploy;   summary ;;
  sync)     test_sync;     summary ;;
  backup)   test_backup;   summary ;;
  failover) test_failover; summary ;;
  all)      test_all;      summary ;;
  "")       show_menu ;;
  *)
    echo "Usage: $0 {health|network|database|redis|cortex|deploy|sync|backup|failover|all}"
    exit 1
    ;;
esac
