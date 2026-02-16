#!/bin/sh
set -e

# Skip migrations when using k8s migration Job or init container
if [ "${SKIP_MIGRATIONS}" = "true" ]; then
  echo "[entrypoint] SKIP_MIGRATIONS=true, skipping schema sync and seed"
else
  # Use direct DB connection for schema sync (bypasses PgBouncer)
  MIGRATE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"

  # Prefer prisma migrate deploy (if migrations exist), fallback to db push
  if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "[entrypoint] Running prisma migrate deploy..."
    DATABASE_URL="$MIGRATE_URL" \
      NODE_PATH=/app/prisma-cli/node_modules:/app/node_modules \
      node /app/prisma-cli/node_modules/prisma/build/index.js migrate deploy \
        --schema=prisma/schema.prisma 2>&1 || {
      echo "[entrypoint] WARNING: prisma migrate deploy failed, falling back to db push..."
      DATABASE_URL="$MIGRATE_URL" \
        NODE_PATH=/app/prisma-cli/node_modules:/app/node_modules \
        node /app/prisma-cli/node_modules/prisma/build/index.js db push \
          --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || {
        echo "[entrypoint] WARNING: prisma db push also failed, continuing..."
      }
    }
  else
    echo "[entrypoint] No migrations found, using prisma db push..."
    DATABASE_URL="$MIGRATE_URL" \
      NODE_PATH=/app/prisma-cli/node_modules:/app/node_modules \
      node /app/prisma-cli/node_modules/prisma/build/index.js db push \
        --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || {
      echo "[entrypoint] WARNING: prisma db push failed, continuing..."
    }
  fi

  echo "[entrypoint] Running seed..."
  DATABASE_URL="$MIGRATE_URL" node prisma/seed.js 2>&1 || {
    echo "[entrypoint] WARNING: seed failed, continuing..."
  }
fi

echo "[entrypoint] Starting server..."
exec node server.js
