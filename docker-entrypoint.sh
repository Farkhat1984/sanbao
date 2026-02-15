#!/bin/sh
set -e

echo "[entrypoint] Syncing database schema..."
NODE_PATH=/app/prisma-cli/node_modules:/app/node_modules \
  node /app/prisma-cli/node_modules/prisma/build/index.js db push \
    --schema=prisma/schema.prisma --skip-generate 2>&1 || {
  echo "[entrypoint] WARNING: prisma db push failed, continuing..."
}

echo "[entrypoint] Running seed..."
node prisma/seed.js 2>&1 || {
  echo "[entrypoint] WARNING: seed failed, continuing..."
}

echo "[entrypoint] Starting server as nextjs user..."
exec su nextjs -s /bin/sh -c "exec node server.js"
