#!/usr/bin/env bash
# =============================================================================
# Health Monitor + Auto-Failover
#
# Runs as a systemd service on the standby server.
# Checks Server 1 health every 30 seconds.
# After 3 consecutive failures (~90s), triggers automatic failover.
# When Server 1 recovers, sends alert but does NOT auto-failback.
#
# Usage: ./healthcheck.sh (run via systemd, not directly)
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"

LOG_FILE="/var/log/failover-monitor.log"
STATE_FILE="/tmp/failover-state"
CHECK_INTERVAL=30
FAIL_THRESHOLD=3
CURL_TIMEOUT=10

COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.failover.yml"

# ---- State tracking ----
FAIL_COUNT=0
FAILOVER_ACTIVE=false
RECOVERY_NOTIFIED=false

# Load previous state if exists
if [ -f "${STATE_FILE}" ]; then
    source "${STATE_FILE}"
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

save_state() {
    cat > "${STATE_FILE}" <<EOF
FAIL_COUNT=${FAIL_COUNT}
FAILOVER_ACTIVE=${FAILOVER_ACTIVE}
RECOVERY_NOTIFIED=${RECOVERY_NOTIFIED}
EOF
}

send_telegram() {
    local message="$1"
    curl -sf -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TG_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        >/dev/null 2>&1 || log "WARNING: Telegram notification failed"
}

check_primary_health() {
    local sanbao_ok=false
    local fragmentdb_ok=false

    # Check via reverse SSH tunnel (Server 1 → Server 2)
    # Tunnel maps: localhost:13004 → Server1:3004, localhost:18110 → Server1:8110
    if curl -sf --max-time "${CURL_TIMEOUT}" \
        "http://localhost:13004/api/health" >/dev/null 2>&1; then
        sanbao_ok=true
    fi

    if curl -sf --max-time "${CURL_TIMEOUT}" \
        "http://localhost:18110/health" >/dev/null 2>&1; then
        fragmentdb_ok=true
    fi

    if [ "${sanbao_ok}" = true ] && [ "${fragmentdb_ok}" = true ]; then
        return 0
    fi

    log "Health check failed: sanbao=${sanbao_ok} fragmentdb=${fragmentdb_ok}"
    return 1
}

check_local_services() {
    # Verify local stack is running and healthy
    local ok=true

    if ! curl -sf --max-time 5 "http://localhost:${SANBAO_PORT:-3004}/api/health" >/dev/null 2>&1; then
        ok=false
    fi
    if ! curl -sf --max-time 5 "http://localhost:${FRAGMENTDB_PORT:-8110}/health" >/dev/null 2>&1; then
        ok=false
    fi

    [ "${ok}" = true ]
}

do_failover() {
    log "=== FAILOVER TRIGGERED ==="
    send_telegram "$(cat <<EOF
<b>FAILOVER TRIGGERED</b>

Server 1 (${PRIMARY_IP}) is DOWN.
Activating Server 2 (${STANDBY_IP}).

Starting services...
EOF
)"

    # 1. Запускаем все сервисы + cloudflared tunnel
    log "Starting local Docker Compose stack + cloudflared..."
    cd "${SCRIPT_DIR}"
    docker compose -f "${COMPOSE_FILE}" --profile failover up -d 2>>"${LOG_FILE}"

    # 2. Ждём пока сервисы станут healthy (макс 120с)
    log "Waiting for local services to become healthy..."
    local wait_count=0
    local max_wait=24  # 24 * 5s = 120s
    while [ ${wait_count} -lt ${max_wait} ]; do
        sleep 5
        if check_local_services; then
            log "Local services are healthy."
            break
        fi
        wait_count=$((wait_count + 1))
        log "Waiting for services... (${wait_count}/${max_wait})"
    done

    if [ ${wait_count} -ge ${max_wait} ]; then
        log "WARNING: Local services did not become healthy within 120s"
        send_telegram "<b>WARNING:</b> Сервисы запущены, но health checks ещё не проходят."
    fi

    # 3. cloudflared уже запущен в compose с профилем failover
    #    Cloudflare автоматически направит трафик на активный connector
    log "cloudflared запущен. Cloudflare направит трафик на Server 2."

    FAILOVER_ACTIVE=true
    RECOVERY_NOTIFIED=false
    save_state

    send_telegram "$(cat <<EOF
<b>FAILOVER COMPLETE</b>

sanbao.ai now points to Server 2 (${STANDBY_IP}).
Services are running.

Manual failback required when Server 1 recovers.
Run: <code>./failback.sh</code>
EOF
)"

    log "=== FAILOVER COMPLETE ==="
}

# ---- Main loop ----
log "Health monitor started. Checking ${PRIMARY_IP} every ${CHECK_INTERVAL}s (threshold: ${FAIL_THRESHOLD} failures)"

while true; do
    if check_primary_health; then
        # Primary is healthy
        if [ ${FAIL_COUNT} -gt 0 ]; then
            log "Primary recovered after ${FAIL_COUNT} failure(s)."
        fi
        FAIL_COUNT=0

        # If we're in failover mode and primary came back
        if [ "${FAILOVER_ACTIVE}" = true ]; then
            # Check if local failover services are still running
            # If not — failback already happened, reset state
            if ! docker compose -f "${COMPOSE_FILE}" ps --status running 2>/dev/null | grep -q "running"; then
                log "Failover services stopped (failback completed). Resetting state."
                FAILOVER_ACTIVE=false
                RECOVERY_NOTIFIED=false
                save_state
            elif [ "${RECOVERY_NOTIFIED}" = false ]; then
                # Notify once that primary is back
                log "Primary is back online while failover is active."
                send_telegram "$(cat <<EOF
<b>Server 1 is BACK</b>

Server 1 (${PRIMARY_IP}) is responding again.
Failover is still active on Server 2.

When ready, run manual failback:
<code>cd ~/faragj/deploy && ./failback.sh</code>
EOF
)"
                RECOVERY_NOTIFIED=true
            fi
        fi
    else
        # Primary failed
        FAIL_COUNT=$((FAIL_COUNT + 1))
        log "Primary check failed (${FAIL_COUNT}/${FAIL_THRESHOLD})"

        if [ ${FAIL_COUNT} -ge ${FAIL_THRESHOLD} ] && [ "${FAILOVER_ACTIVE}" = false ]; then
            do_failover
        fi
    fi

    save_state
    sleep "${CHECK_INTERVAL}"
done
