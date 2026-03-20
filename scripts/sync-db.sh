#!/usr/bin/env bash
# sync-db.sh — Sync PostgreSQL from primary (home) to standby (VPS)
# Usage: ./scripts/sync-db.sh [--force]
# Cron:  */5 * * * * /home/metadmin/faragj/SANBAO_PROJECT/sanbao/scripts/sync-db.sh >> /home/metadmin/faragj/SANBAO_PROJECT/sanbao/logs/sync-db.log 2>&1

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
PRIMARY_DB_CONTAINER="sanbao-db-1"
PRIMARY_DB_USER="${DB_USER:-postgres}"
PRIMARY_DB_NAME="${DB_NAME:-sanbao}"

VPS_HOST="46.225.122.142"
VPS_SSH_PORT="22"
VPS_SSH_USER="faragj"
VPS_DB_CONTAINER="sanbao-db-1"

DUMP_DIR="/tmp/sanbao-sync"
DUMP_FILE="${DUMP_DIR}/sanbao_sync.sql.gz"
LOCK_FILE="/tmp/sanbao-sync.lock"
LOG_PREFIX="[sync-db]"

MAX_DUMP_AGE_SEC=600  # skip if dump is <10min old (unless --force)
# ────────────────────────────────────────────────────────────────────

log() { echo "$(date -Iseconds) ${LOG_PREFIX} $*"; }
die() { log "ERROR: $*"; cleanup; exit 1; }

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# ── Locking ─────────────────────────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
  lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || true)
  if kill -0 "$lock_pid" 2>/dev/null; then
    log "Another sync is running (PID $lock_pid), skipping"
    exit 0
  fi
  log "Stale lock found (PID $lock_pid), removing"
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"

# ── Pre-checks ──────────────────────────────────────────────────────
mkdir -p "$DUMP_DIR"
mkdir -p "$(dirname "$0")/../logs"

docker inspect "$PRIMARY_DB_CONTAINER" > /dev/null 2>&1 || die "Primary DB container not running"
ssh -p "$VPS_SSH_PORT" -o ConnectTimeout=5 "$VPS_SSH_USER@$VPS_HOST" "true" 2>/dev/null || die "Cannot SSH to VPS"

# ── Step 1: Dump primary ────────────────────────────────────────────
log "Dumping primary database..."
start_ts=$(date +%s)

docker exec "$PRIMARY_DB_CONTAINER" \
  pg_dump -U "$PRIMARY_DB_USER" "$PRIMARY_DB_NAME" \
    --no-owner --no-acl --clean --if-exists \
  | gzip > "$DUMP_FILE" || die "pg_dump failed"

dump_size=$(stat -c%s "$DUMP_FILE" 2>/dev/null || echo 0)
elapsed=$(( $(date +%s) - start_ts ))
log "Dump complete: $(numfmt --to=iec "$dump_size") in ${elapsed}s"

[ "$dump_size" -lt 1000 ] && die "Dump suspiciously small (${dump_size} bytes), aborting"

# ── Step 2: Transfer to VPS ─────────────────────────────────────────
log "Transferring to VPS..."
start_ts=$(date +%s)

scp -P "$VPS_SSH_PORT" -o ConnectTimeout=10 -q \
  "$DUMP_FILE" "$VPS_SSH_USER@$VPS_HOST:/tmp/sanbao_sync.sql.gz" \
  || die "SCP transfer failed"

elapsed=$(( $(date +%s) - start_ts ))
log "Transfer complete in ${elapsed}s"

# ── Step 3: Restore on VPS ──────────────────────────────────────────
log "Restoring on VPS..."
start_ts=$(date +%s)

ssh -p "$VPS_SSH_PORT" "$VPS_SSH_USER@$VPS_HOST" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail

DB_CONTAINER="sanbao-db-1"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-sanbao}"

# Terminate active connections
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

# Restore (--clean in dump handles DROP/CREATE of objects)
gunzip -c /tmp/sanbao_sync.sql.gz | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q > /dev/null 2>&1

rm -f /tmp/sanbao_sync.sql.gz
echo "RESTORE_OK"
REMOTE_SCRIPT

elapsed=$(( $(date +%s) - start_ts ))
log "Restore complete in ${elapsed}s"

# ── Cleanup ─────────────────────────────────────────────────────────
rm -f "$DUMP_FILE"
log "Sync completed successfully"
