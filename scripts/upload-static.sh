#!/bin/bash
# Upload Next.js static assets to S3/CDN after build.
# Run after `npm run build` in CI.
#
# Required env:
#   CDN_BUCKET — S3 bucket name
#   CDN_ENDPOINT — S3 endpoint (optional, for MinIO/Yandex Object Storage)
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

set -e

STATIC_DIR=".next/static"

if [ ! -d "$STATIC_DIR" ]; then
  echo "[cdn] Error: $STATIC_DIR not found. Run npm run build first."
  exit 1
fi

S3_URI="s3://${CDN_BUCKET}/_next/static"
ENDPOINT_ARG=""

if [ -n "$CDN_ENDPOINT" ]; then
  ENDPOINT_ARG="--endpoint-url $CDN_ENDPOINT"
fi

echo "[cdn] Uploading static assets to ${S3_URI}..."

# Upload with long cache headers (immutable)
aws s3 sync "$STATIC_DIR" "$S3_URI" \
  $ENDPOINT_ARG \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

echo "[cdn] Upload complete."

# Also upload public/ directory
if [ -d "public" ]; then
  echo "[cdn] Uploading public/ assets..."
  aws s3 sync "public" "s3://${CDN_BUCKET}/public" \
    $ENDPOINT_ARG \
    --cache-control "public, max-age=86400"
  echo "[cdn] Public assets uploaded."
fi
