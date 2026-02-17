#!/bin/bash
set -e

# ─── Sanbao Deploy Script ───────────────────────────────────────────────────
# Builds and deploys to production Docker on the current server.
# Reads DEVOPS.md for full infrastructure docs.
#
# Usage:
#   ./scripts/deploy.sh              # Full rebuild (build + restart all)
#   ./scripts/deploy.sh app          # Rebuild only app containers
#   ./scripts/deploy.sh restart      # Restart without rebuild
#   ./scripts/deploy.sh status       # Show container status
#   ./scripts/deploy.sh logs [svc]   # Tail logs (default: app)
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"

# Cloudflare cache purge (credentials from Server 2 deploy env)
CF_API_TOKEN="${CF_API_TOKEN:-ympF_5OJdcmeFAZCrb3As2ArTQhg_5lYQ4nCCxDS}"
CF_ZONE_ID="${CF_ZONE_ID:-73025f5522d28a0111fb6afaf39e8c31}"

purge_cf_cache() {
  echo "=== Purging Cloudflare cache ==="
  RESP=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' 2>&1)
  if echo "$RESP" | grep -q '"success":true'; then
    echo "  Cloudflare cache purged"
  else
    echo "  WARNING: CF cache purge failed: $RESP"
  fi
}

case "${1:-full}" in

  full)
    echo "=== Full rebuild & deploy ==="
    npm run build
    $COMPOSE up --build -d
    echo ""
    echo "=== Waiting for health checks ==="
    for i in $(seq 1 30); do
      HEALTHY=$($COMPOSE ps --format json 2>/dev/null | grep -c '"healthy"' || true)
      TOTAL=$($COMPOSE ps -q 2>/dev/null | wc -l)
      echo "  [$i/30] healthy: $HEALTHY / $TOTAL"
      if [ "$HEALTHY" -ge "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
        echo ""
        echo "=== All containers healthy ==="
        purge_cf_cache
        $COMPOSE ps
        exit 0
      fi
      sleep 5
    done
    echo ""
    echo "=== WARNING: Not all containers healthy ==="
    $COMPOSE ps
    exit 1
    ;;

  app)
    echo "=== Rebuild app only ==="
    npm run build
    $COMPOSE up --build -d app
    sleep 5
    $COMPOSE restart nginx
    echo ""
    echo "=== Waiting for app health ==="
    for i in $(seq 1 20); do
      if $COMPOSE ps app --format json 2>/dev/null | grep -q '"healthy"'; then
        echo "  App healthy!"
        purge_cf_cache
        $COMPOSE ps
        exit 0
      fi
      echo "  [$i/20] waiting..."
      sleep 5
    done
    echo "  WARNING: app not healthy yet"
    $COMPOSE ps
    ;;

  restart)
    echo "=== Restart (no rebuild) ==="
    $COMPOSE restart
    $COMPOSE ps
    ;;

  status)
    $COMPOSE ps
    ;;

  logs)
    SVC="${2:-app}"
    $COMPOSE logs "$SVC" --tail 50 -f
    ;;

  *)
    echo "Usage: $0 {full|app|restart|status|logs [service]}"
    exit 1
    ;;

esac
