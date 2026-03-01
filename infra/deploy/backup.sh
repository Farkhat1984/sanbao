#!/usr/bin/env bash
# =============================================================================
# Professional SaaS Backup System
#
# Retention policy:
#   - Daily:   7 backups
#   - Weekly:  4 backups (Sundays)
#   - Monthly: 3 backups (1st of month)
#
# What's backed up:
#   1. PostgreSQL (sanbao) — pg_dump compressed + integrity verified
#   2. FragmentDB data — tar.gz of data directory
#   3. Deploy configs — .env files and compose
#
# Improvements (Feb 2026):
#   - docker compose exec instead of image-based container discovery
#   - gzip -t integrity verification of dump
#   - Detailed Telegram error messages per step
#
# Runs daily at 03:00 via cron.
# Sends Telegram alerts on success/failure.
#
# Usage: ./backup.sh
# Cron:  0 3 * * * /home/metadmin/faragj/deploy/backup.sh
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load config (works on both servers)
if [ -f "${SCRIPT_DIR}/.env" ]; then
    source "${SCRIPT_DIR}/.env"
fi

# ── Config ──────────────────────────────────────────────────────────────────
BACKUP_ROOT="/backups"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
MONTHLY_DIR="${BACKUP_ROOT}/monthly"

KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=3

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
DATE_DAY=$(date '+%d')
DATE_DOW=$(date '+%u')  # 1=Mon, 7=Sun

LOG_FILE="/var/log/backup.log"
ERRORS=0
BACKUP_SIZE_TOTAL=0

TG_BOT_TOKEN="${TG_BOT_TOKEN:-}"
TG_CHAT_ID="${TG_CHAT_ID:-}"

# Docker compose file for Server 2
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.failover.yml"

# Track per-step errors for Telegram
STEP_ERRORS=""

# ── Helpers ─────────────────────────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "${LOG_FILE}" >&2
    ERRORS=$((ERRORS + 1))
}

track_error() {
    local step="$1"
    local detail="$2"
    STEP_ERRORS="${STEP_ERRORS}\n❌ <b>${step}:</b> ${detail}"
    log_error "${step}: ${detail}"
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

human_size() {
    local bytes=$1
    if [ "${bytes}" -ge 1073741824 ]; then
        echo "$(echo "scale=1; ${bytes}/1073741824" | bc)G"
    elif [ "${bytes}" -ge 1048576 ]; then
        echo "$(echo "scale=1; ${bytes}/1048576" | bc)M"
    elif [ "${bytes}" -ge 1024 ]; then
        echo "$(echo "scale=0; ${bytes}/1024" | bc)K"
    else
        echo "${bytes}B"
    fi
}

file_size_bytes() {
    stat -c%s "$1" 2>/dev/null || echo 0
}

# ── Find PostgreSQL container reliably ────────────────────────────────────
find_pg_container() {
    local container=""

    # Method 1: docker compose exec (most reliable — uses compose project + service name)
    if [ -f "${COMPOSE_FILE}" ]; then
        # Check if db service is running in the compose project
        container=$(docker compose -f "${COMPOSE_FILE}" ps -q db 2>/dev/null || true)
        if [ -n "${container}" ]; then
            # Verify it's actually running and healthy
            local health
            health=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "unknown")
            if [ "${health}" = "healthy" ]; then
                echo "compose"
                return 0
            fi
            log "WARNING: Compose db container found but health=${health}"
        fi
    fi

    # Method 2: filter by compose project label (avoids catching unrelated postgres)
    container=$(docker ps \
        --filter 'label=com.docker.compose.service=db' \
        --filter 'health=healthy' \
        --format '{{.Names}}' 2>/dev/null | grep -E 'sanbao.*db|deploy.*db' | head -1)
    if [ -n "${container}" ]; then
        echo "${container}"
        return 0
    fi

    # Method 3: fallback — name pattern (excludes pgbouncer, fragmentdb)
    container=$(docker ps --format '{{.Names}}' 2>/dev/null \
        | grep -E 'sanbao.*db|deploy.*db' \
        | grep -v pgbouncer \
        | grep -v fragment \
        | head -1)
    if [ -n "${container}" ]; then
        echo "${container}"
        return 0
    fi

    echo ""
    return 1
}

# ── Setup dirs ──────────────────────────────────────────────────────────────
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}" "${MONTHLY_DIR}"
log "========== Backup started (${TIMESTAMP}) =========="

# ── 1. PostgreSQL Backup ────────────────────────────────────────────────────
PG_FILE="${DAILY_DIR}/postgres-${TIMESTAMP}.sql.gz"
log "Backing up PostgreSQL..."

PG_TARGET=$(find_pg_container)

if [ -n "${PG_TARGET}" ]; then
    PG_DUMP_OK=false

    if [ "${PG_TARGET}" = "compose" ]; then
        # Use docker compose exec (most reliable)
        log "Using docker compose exec for pg_dump..."
        if docker compose -f "${COMPOSE_FILE}" exec -T db \
            pg_dump -U postgres --clean --if-exists sanbao 2>>"${LOG_FILE}" \
            | gzip > "${PG_FILE}"; then
            PG_DUMP_OK=true
        fi
    else
        # Use direct container name
        log "Using container ${PG_TARGET} for pg_dump..."
        if docker exec "${PG_TARGET}" \
            pg_dump -U postgres --clean --if-exists sanbao 2>>"${LOG_FILE}" \
            | gzip > "${PG_FILE}"; then
            PG_DUMP_OK=true
        fi
    fi

    if [ "${PG_DUMP_OK}" = true ]; then
        PG_SIZE=$(file_size_bytes "${PG_FILE}")
        BACKUP_SIZE_TOTAL=$((BACKUP_SIZE_TOTAL + PG_SIZE))

        # Verify size
        if [ "${PG_SIZE}" -lt 1024 ]; then
            track_error "PostgreSQL" "дамп слишком маленький ($(human_size ${PG_SIZE})) — возможно пустой"
            rm -f "${PG_FILE}"
        # Verify gzip integrity
        elif ! gzip -t "${PG_FILE}" 2>/dev/null; then
            track_error "PostgreSQL" "повреждённый gzip-архив ($(human_size ${PG_SIZE})), не прошёл gzip -t"
            rm -f "${PG_FILE}"
        else
            log "PostgreSQL: OK ($(human_size ${PG_SIZE}), integrity verified)"
        fi
    else
        track_error "PostgreSQL" "pg_dump вернул ошибку"
        rm -f "${PG_FILE}"
    fi
else
    track_error "PostgreSQL" "контейнер не найден (compose/label/name)"
fi

# ── 2. FragmentDB Data Backup ───────────────────────────────────────────────
FDB_FILE="${DAILY_DIR}/fragmentdb-${TIMESTAMP}.tar.gz"
log "Backing up FragmentDB data..."

# Check possible locations (ordered by likelihood)
FDB_DATA=""
for path in \
    "/home/metadmin/faragj/ai_cortex/fragmentdb_data" \
    "/home/faragj/faragj/fragmentdb/fragmentdb_data" \
    "/home/metadmin/faragj/fragmentdb/fragmentdb_data"; do
    if [ -d "${path}" ] && [ "$(ls -A "${path}" 2>/dev/null)" ]; then
        FDB_DATA="${path}"
        break
    fi
done

# Check Docker volume
if [ -z "${FDB_DATA}" ]; then
    for vol_name in deploy_fragmentdb-data fragmentdb-data; do
        vol_path=$(docker volume inspect "${vol_name}" --format '{{.Mountpoint}}' 2>/dev/null || true)
        if [ -n "${vol_path}" ] && [ -d "${vol_path}" ] && [ "$(ls -A "${vol_path}" 2>/dev/null)" ]; then
            FDB_DATA="${vol_path}"
            break
        fi
    done
fi

if [ -n "${FDB_DATA}" ]; then
    log "FragmentDB data found at ${FDB_DATA}"
    if tar czf "${FDB_FILE}" -C "$(dirname "${FDB_DATA}")" "$(basename "${FDB_DATA}")" 2>>"${LOG_FILE}"; then
        FDB_SIZE=$(file_size_bytes "${FDB_FILE}")
        BACKUP_SIZE_TOTAL=$((BACKUP_SIZE_TOTAL + FDB_SIZE))

        if [ "${FDB_SIZE}" -lt 1024 ]; then
            track_error "FragmentDB" "архив слишком маленький ($(human_size ${FDB_SIZE}))"
            rm -f "${FDB_FILE}"
        # Verify tar.gz integrity
        elif ! gzip -t "${FDB_FILE}" 2>/dev/null; then
            track_error "FragmentDB" "повреждённый архив, не прошёл gzip -t"
            rm -f "${FDB_FILE}"
        else
            log "FragmentDB: OK ($(human_size ${FDB_SIZE}), integrity verified)"
        fi
    else
        track_error "FragmentDB" "tar создание архива не удалось (permissions?)"
        rm -f "${FDB_FILE}"
    fi
else
    track_error "FragmentDB" "директория данных не найдена"
fi

# ── 3. Config Backup ───────────────────────────────────────────────────────
CFG_FILE="${DAILY_DIR}/configs-${TIMESTAMP}.tar.gz"
log "Backing up configs..."

CONFIG_FILES=""
for f in \
    "${SCRIPT_DIR}/.env" \
    "${SCRIPT_DIR}/.env.sanbao" \
    "${SCRIPT_DIR}/docker-compose.failover.yml"; do
    [ -f "${f}" ] && CONFIG_FILES="${CONFIG_FILES} ${f}"
done

if [ -n "${CONFIG_FILES}" ]; then
    # shellcheck disable=SC2086
    tar czf "${CFG_FILE}" ${CONFIG_FILES} 2>/dev/null
    CFG_SIZE=$(file_size_bytes "${CFG_FILE}")
    BACKUP_SIZE_TOTAL=$((BACKUP_SIZE_TOTAL + CFG_SIZE))
    log "Configs: OK ($(human_size ${CFG_SIZE}))"
fi

# ── 4. Weekly copy (Sundays) ───────────────────────────────────────────────
if [ "${DATE_DOW}" = "7" ]; then
    log "Creating weekly copies (Sunday)..."
    for f in "${DAILY_DIR}"/*-"${TIMESTAMP}".*; do
        [ -f "${f}" ] && cp "${f}" "${WEEKLY_DIR}/"
    done
    log "Weekly copies created."
fi

# ── 5. Monthly copy (1st of month) ─────────────────────────────────────────
if [ "${DATE_DAY}" = "01" ]; then
    log "Creating monthly copies (1st)..."
    for f in "${DAILY_DIR}"/*-"${TIMESTAMP}".*; do
        [ -f "${f}" ] && cp "${f}" "${MONTHLY_DIR}/"
    done
    log "Monthly copies created."
fi

# ── 6. Rotation ────────────────────────────────────────────────────────────
log "Rotating old backups..."

rotate_dir() {
    local dir=$1
    local keep=$2
    local count
    count=$(ls -1t "${dir}"/postgres-*.sql.gz 2>/dev/null | wc -l)
    if [ "${count}" -gt "${keep}" ]; then
        ls -1t "${dir}"/postgres-*.sql.gz | tail -n +$((keep + 1)) | xargs rm -f
        ls -1t "${dir}"/fragmentdb-*.tar.gz 2>/dev/null | tail -n +$((keep + 1)) | xargs rm -f
        ls -1t "${dir}"/configs-*.tar.gz 2>/dev/null | tail -n +$((keep + 1)) | xargs rm -f
        log "Rotated ${dir}: kept ${keep}, removed $((count - keep))"
    fi
}

rotate_dir "${DAILY_DIR}" "${KEEP_DAILY}"
rotate_dir "${WEEKLY_DIR}" "${KEEP_WEEKLY}"
rotate_dir "${MONTHLY_DIR}" "${KEEP_MONTHLY}"

# ── 7. Summary ──────────────────────────────────────────────────────────────
DISK_FREE=$(df -h /backups 2>/dev/null | tail -1 | awk '{print $4}' || echo "?")
TOTAL_BACKUPS=$(find "${BACKUP_ROOT}" -name "*.gz" 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_ROOT}" 2>/dev/null | cut -f1 || echo "?")

if [ ${ERRORS} -eq 0 ]; then
    log "========== Backup completed successfully =========="
    send_telegram "$(cat <<EOF
✅ <b>Бекап выполнен</b>

📅 ${TIMESTAMP}
📦 Размер: $(human_size ${BACKUP_SIZE_TOTAL})
💾 Всего бекапов: ${TOTAL_BACKUPS} (${TOTAL_SIZE})
📊 Свободно: ${DISK_FREE}

✔ PostgreSQL (gzip verified)
✔ FragmentDB (gzip verified)
✔ Configs
EOF
)"
else
    log "========== Backup completed with ${ERRORS} error(s) =========="
    send_telegram "$(cat <<EOF
⚠️ <b>Бекап с ошибками (${ERRORS})</b>

📅 ${TIMESTAMP}
${STEP_ERRORS}

📦 Размер: $(human_size ${BACKUP_SIZE_TOTAL})
📊 Свободно: ${DISK_FREE}

Лог: <code>tail -30 /var/log/backup.log</code>
Или: /logs в боте
EOF
)"
fi

exit ${ERRORS}
