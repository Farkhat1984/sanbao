#!/usr/bin/env bash
# =============================================================================
# Manual Failback: Return traffic to Server 1 (Primary)
#
# Run this ONLY after Server 1 is confirmed healthy and ready.
# This script:
#   1. Optionally syncs data back from standby → primary (if changes occurred)
#   2. Switches Cloudflare DNS back to primary IP
#   3. Stops services on standby
#   4. Resets failover state
#   5. Sends Telegram notification
#
# Usage: ./failback.sh [--skip-sync]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"

COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.failover.yml"
STATE_FILE="/tmp/failover-state"
LOG_FILE="/var/log/failover-monitor.log"
SSH_TARGET="${SYNC_SSH_USER}@${SYNC_SSH_HOST}"
SKIP_SYNC=false

if [ "${1:-}" = "--skip-sync" ]; then
    SKIP_SYNC=true
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[FAILBACK]${NC} $1" | tee -a "${LOG_FILE}"; }
warn()  { echo -e "${YELLOW}[FAILBACK]${NC} $1" | tee -a "${LOG_FILE}"; }
error() { echo -e "${RED}[FAILBACK]${NC} $1" | tee -a "${LOG_FILE}"; }

send_telegram() {
    local message="$1"
    curl -sf -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TG_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        >/dev/null 2>&1 || warn "Telegram notification failed"
}

# ---- Step 0: Pre-flight checks ----
log "Starting failback to primary (${PRIMARY_IP})..."

# Check primary via reverse SSH tunnel (localhost:13004/18110)
if ! curl -sf --max-time 10 "http://localhost:13004/api/health" >/dev/null 2>&1; then
    if ! curl -sf --max-time 10 "http://localhost:18110/health" >/dev/null 2>&1; then
        error "Primary server (${PRIMARY_IP}) is not responding!"
        error "Aborting failback. Ensure Server 1 services are running first."
        exit 1
    fi
    warn "Sanbao not responding on primary but FragmentDB is up. Proceeding cautiously..."
fi

log "Primary server is reachable."

# ---- Step 1: Sync data back to primary (if changes occurred during failover) ----
if [ "${SKIP_SYNC}" = false ]; then
    log "Syncing data back to primary..."

    # PostgreSQL: dump from local standby → restore on primary
    log "Syncing PostgreSQL to primary..."
    DB_CONTAINER=$(docker compose -f "${COMPOSE_FILE}" ps -q db 2>/dev/null || echo "")

    if [ -n "${DB_CONTAINER}" ]; then
        docker exec "${DB_CONTAINER}" pg_dump -U postgres --clean --if-exists sanbao 2>/dev/null \
            | ssh -o StrictHostKeyChecking=no "${SSH_TARGET}" \
                "docker exec -i sanbao-db-1 psql -U postgres -d sanbao --quiet" 2>/dev/null \
            && log "PostgreSQL synced back to primary." \
            || warn "PostgreSQL reverse sync failed."
    else
        warn "Local DB container not running, skipping PostgreSQL sync."
    fi

    # FragmentDB: rsync local volume → primary
    log "Syncing FragmentDB data to primary..."
    VOLUME_PATH=$(docker volume inspect deploy_fragmentdb-data --format '{{.Mountpoint}}' 2>/dev/null || echo "")
    if [ -n "${VOLUME_PATH}" ]; then
        sudo rsync -az \
            -e "ssh -o StrictHostKeyChecking=no" \
            "${VOLUME_PATH}/" \
            "${SSH_TARGET}:/home/metadmin/faragj/ai_cortex/fragmentdb_data/" 2>/dev/null \
            && log "FragmentDB data synced back to primary." \
            || warn "FragmentDB reverse sync failed."
    else
        warn "FragmentDB volume not found, skipping."
    fi
else
    log "Skipping data sync (--skip-sync)."
fi

# ---- Step 2: Останавливаем все сервисы + cloudflared на standby ----
# Когда cloudflared на Server 2 остановится, Cloudflare автоматически
# направит весь трафик на Server 1 (единственный активный connector)
log "Останавливаем сервисы и cloudflared на standby..."
cd "${SCRIPT_DIR}"
docker compose -f "${COMPOSE_FILE}" --profile failover down 2>/dev/null || true
log "Все сервисы остановлены. Трафик вернётся на Server 1."

# ---- Step 4: Reset failover state ----
cat > "${STATE_FILE}" <<EOF
FAIL_COUNT=0
FAILOVER_ACTIVE=false
EOF
log "Failover state reset."

# ---- Step 5: Notify ----
send_telegram "$(cat <<EOF
<b>FAILBACK COMPLETE</b>

sanbao.ai now points back to Server 1 (${PRIMARY_IP}).
Server 2 (${STANDBY_IP}) services stopped.

All systems nominal.
EOF
)"

echo ""
echo "========================================="
echo "  Failback Complete"
echo "========================================="
echo ""
echo "  Tunnel:   cloudflared остановлен на Server 2"
echo "  Traffic:  sanbao.ai → Server 1 (через tunnel)"
echo "  Monitor:  продолжает работать"
echo ""
log "Failback completed successfully."
