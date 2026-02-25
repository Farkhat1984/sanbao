#!/usr/bin/env bash
# =============================================================================
# Data Synchronization: Primary (Server 1) → Standby (Server 2)
# Runs via cron every 5 minutes on the standby server.
#
# Syncs:
#   1. PostgreSQL (sanbao DB) via pg_dump over SSH
#   2. FragmentDB data directory via rsync over SSH
#
# Improvements (Feb 2026):
#   - docker compose exec instead of hardcoded container names
#   - Retry with exponential backoff (3 attempts)
#   - Docker readiness check before pg_dump
#   - rsync --timeout + retries
#   - Specific Telegram error messages per failed step
#
# Usage: ./sync.sh
# Cron:  */5 * * * * /home/metadmin/faragj/deploy/sync.sh
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env"

LOG_FILE="/var/log/failover-sync.log"
LOCK_FILE="/tmp/failover-sync.lock"

# Docker compose on Server 2 (standby)
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.failover.yml"

# Sanbao compose on Server 1 (primary)
REMOTE_SANBAO_DIR="/home/metadmin/faragj/sanbao"
REMOTE_COMPOSE_FILE="docker-compose.prod.yml"

# Retry config
MAX_RETRIES=3
RETRY_BASE_DELAY=5  # seconds, doubles each retry

# SSH config
SSH_PORT="${SYNC_SSH_PORT:-22222}"
SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=no -o ServerAliveInterval=5 -o ServerAliveCountMax=2 -p ${SSH_PORT}"
SSH_TARGET="${SYNC_SSH_USER}@${SYNC_SSH_HOST}"

# Telegram config
TG_BOT_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT_ID="${TG_CHAT_ID:-}"

# Track errors per step
PG_ERROR=""
FDB_ERROR=""

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "${LOG_FILE}" >&2
}

send_telegram() {
    [ -z "${TG_BOT_TOKEN}" ] && return
    local message="$1"
    curl -sf -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TG_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        >/dev/null 2>&1 || log "WARNING: Telegram notification failed"
}

# Prevent concurrent runs
if [ -f "${LOCK_FILE}" ]; then
    LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || true)
    if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
        log "Sync already running (PID ${LOCK_PID}), skipping."
        exit 0
    fi
    rm -f "${LOCK_FILE}"
fi
echo $$ > "${LOCK_FILE}"
trap 'rm -f "${LOCK_FILE}"' EXIT

# Only run on standby
if [ "${SERVER_ROLE}" != "standby" ]; then
    log "Not a standby server (role=${SERVER_ROLE}), skipping sync."
    exit 0
fi

# ---- Pre-flight: Check Server 1 Docker is ready ----
log "Checking Server 1 Docker readiness..."

wait_for_docker() {
    local attempt=1
    while [ ${attempt} -le ${MAX_RETRIES} ]; do
        if ssh ${SSH_OPTS} "${SSH_TARGET}" \
            "docker info >/dev/null 2>&1 && \
             cd ${REMOTE_SANBAO_DIR} && \
             docker compose -f ${REMOTE_COMPOSE_FILE} ps db --format '{{.Health}}' 2>/dev/null | grep -q healthy" 2>/dev/null; then
            log "Server 1 Docker + PostgreSQL healthy."
            return 0
        fi
        local delay=$((RETRY_BASE_DELAY * attempt))
        log "Server 1 Docker not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}s..."
        sleep ${delay}
        attempt=$((attempt + 1))
    done
    return 1
}

if ! wait_for_docker; then
    PG_ERROR="Server 1 Docker/PostgreSQL не готов после ${MAX_RETRIES} попыток"
    FDB_ERROR="Пропущено (Server 1 недоступен)"
    log_error "${PG_ERROR}"

    send_telegram "$(cat <<EOF
❌ <b>Синхронизация прервана</b>

Server 1 Docker не готов после ${MAX_RETRIES} попыток.
PostgreSQL контейнер не healthy.

Возможная причина: Server 1 ещё загружается после сбоя питания.
EOF
)"
    exit 1
fi

# ---- 1. PostgreSQL Sync (with retry) ----
log "Syncing PostgreSQL..."

pg_sync() {
    local attempt=1
    while [ ${attempt} -le ${MAX_RETRIES} ]; do
        log "PostgreSQL sync attempt ${attempt}/${MAX_RETRIES}..."

        # Remote: use docker compose exec on Server 1 (finds correct container reliably)
        # Local: use docker compose exec on Server 2
        if ssh ${SSH_OPTS} "${SSH_TARGET}" \
            "cd ${REMOTE_SANBAO_DIR} && docker compose -f ${REMOTE_COMPOSE_FILE} exec -T db pg_dump -U postgres --clean --if-exists sanbao" 2>>"${LOG_FILE}" \
            | docker compose -f "${COMPOSE_FILE}" exec -T db psql -U postgres -d sanbao --quiet 2>>"${LOG_FILE}"; then
            log "PostgreSQL sync completed (attempt ${attempt})."
            return 0
        fi

        local delay=$((RETRY_BASE_DELAY * attempt))
        log_error "PostgreSQL sync failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}s..."
        sleep ${delay}
        attempt=$((attempt + 1))
    done
    return 1
}

if pg_sync; then
    PG_ERROR=""
    # Ensure local postgres password matches .env after restore
    # (pg_dump --clean can reset role passwords from Server 1's SCRAM hash,
    # which breaks PgBouncer authentication on Server 2)
    docker compose -f "${COMPOSE_FILE}" exec -T db \
        psql -U postgres -c "ALTER USER postgres PASSWORD '${POSTGRES_PASSWORD:-postgres}';" \
        >/dev/null 2>&1 \
        && log "PostgreSQL password re-synced for PgBouncer compatibility." \
        || log "WARNING: Failed to reset postgres password after sync."
else
    PG_ERROR="pg_dump/psql не удался после ${MAX_RETRIES} попыток"
    log_error "PostgreSQL sync failed after ${MAX_RETRIES} retries!"
fi

# ---- 2. FragmentDB Data Sync (with retry + timeout) ----
log "Syncing FragmentDB data..."

# Determine local volume path
VOLUME_PATH=$(docker volume inspect deploy_fragmentdb-data --format '{{.Mountpoint}}' 2>/dev/null || true)
if [ -z "${VOLUME_PATH}" ]; then
    VOLUME_PATH="/data/fragmentdb"
    mkdir -p "${VOLUME_PATH}"
fi

fdb_sync() {
    local attempt=1
    while [ ${attempt} -le ${MAX_RETRIES} ]; do
        log "FragmentDB rsync attempt ${attempt}/${MAX_RETRIES}..."

        # sudo for Docker volume write access; -i passes user's SSH key to root's ssh
        if sudo rsync -az --delete \
            --timeout=30 \
            -e "ssh ${SSH_OPTS} -i ${HOME}/.ssh/id_ed25519" \
            "${SSH_TARGET}:/home/metadmin/faragj/ai_cortex/nexuscore_data/" \
            "${VOLUME_PATH}/" 2>>"${LOG_FILE}"; then
            log "FragmentDB data sync completed (attempt ${attempt})."
            return 0
        fi

        local delay=$((RETRY_BASE_DELAY * attempt))
        log_error "FragmentDB rsync failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}s..."
        sleep ${delay}
        attempt=$((attempt + 1))
    done
    return 1
}

if fdb_sync; then
    FDB_ERROR=""
else
    FDB_ERROR="rsync не удался после ${MAX_RETRIES} попыток (timeout/permission denied?)"
    log_error "FragmentDB sync failed after ${MAX_RETRIES} retries!"
fi

# ---- Summary + Telegram ----
if [ -z "${PG_ERROR}" ] && [ -z "${FDB_ERROR}" ]; then
    log "All syncs completed successfully."
    exit 0
fi

# Build detailed error message
FAILED_STEPS=""
if [ -n "${PG_ERROR}" ]; then
    FAILED_STEPS="${FAILED_STEPS}\n❌ <b>PostgreSQL:</b> ${PG_ERROR}"
fi
if [ -n "${FDB_ERROR}" ]; then
    FAILED_STEPS="${FAILED_STEPS}\n❌ <b>FragmentDB:</b> ${FDB_ERROR}"
fi

log_error "Sync completed with errors."

send_telegram "$(cat <<EOF
⚠️ <b>Синхронизация с ошибками</b>

$(date '+%Y-%m-%d %H:%M:%S')
${FAILED_STEPS}

Лог: <code>tail -30 /var/log/failover-sync.log</code>
Или: /logs в боте
EOF
)"

exit 1
