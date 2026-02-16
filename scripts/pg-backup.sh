#!/bin/sh
# PostgreSQL backup to S3
# Used by k8s/backup-cronjob.yml
#
# Required env:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE
#   S3_BUCKET, S3_ENDPOINT (optional), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="sanbao-backup-${TIMESTAMP}.sql.gz"
LOCAL_PATH="/tmp/${FILENAME}"

echo "[backup] Starting PostgreSQL backup at ${TIMESTAMP}"

# Dump and compress
pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip > "$LOCAL_PATH"

SIZE=$(du -h "$LOCAL_PATH" | cut -f1)
echo "[backup] Dump complete: ${FILENAME} (${SIZE})"

# Upload to S3
S3_URI="s3://${S3_BUCKET}/backups/postgres/${FILENAME}"

if [ -n "$S3_ENDPOINT" ]; then
  aws s3 cp "$LOCAL_PATH" "$S3_URI" --endpoint-url "$S3_ENDPOINT" || { echo "[backup] ERROR: S3 upload failed"; exit 1; }
else
  aws s3 cp "$LOCAL_PATH" "$S3_URI" || { echo "[backup] ERROR: S3 upload failed"; exit 1; }
fi

echo "[backup] Uploaded to ${S3_URI}"

# Clean up local file
rm -f "$LOCAL_PATH"

# Delete backups older than 30 days
echo "[backup] Cleaning old backups (>30 days)..."

# POSIX-compatible date calculation (works on Alpine BusyBox)
# Calculate cutoff as seconds since epoch minus 30 days, then format
CUTOFF_EPOCH=$(( $(date +%s) - 2592000 ))
# BusyBox date supports @epoch format
CUTOFF=$(date -d "@${CUTOFF_EPOCH}" +%Y%m%d 2>/dev/null || date -r "${CUTOFF_EPOCH}" +%Y%m%d 2>/dev/null || echo "")

if [ -z "$CUTOFF" ]; then
  echo "[backup] WARNING: Could not compute cutoff date, skipping cleanup"
  echo "[backup] Done."
  exit 0
fi

if [ -n "$S3_ENDPOINT" ]; then
  aws s3 ls "s3://${S3_BUCKET}/backups/postgres/" --endpoint-url "$S3_ENDPOINT" \
    | while read -r line; do
        FILE=$(echo "$line" | awk '{print $4}')
        FILE_DATE=$(echo "$FILE" | grep -oE '[0-9]{8}' | head -1)
        if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF" ]; then
          echo "[backup] Deleting old backup: $FILE"
          aws s3 rm "s3://${S3_BUCKET}/backups/postgres/${FILE}" --endpoint-url "$S3_ENDPOINT"
        fi
      done
else
  aws s3 ls "s3://${S3_BUCKET}/backups/postgres/" \
    | while read -r line; do
        FILE=$(echo "$line" | awk '{print $4}')
        FILE_DATE=$(echo "$FILE" | grep -oE '[0-9]{8}' | head -1)
        if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF" ]; then
          echo "[backup] Deleting old backup: $FILE"
          aws s3 rm "s3://${S3_BUCKET}/backups/postgres/${FILE}"
        fi
      done
fi

echo "[backup] Done."
