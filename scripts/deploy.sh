#!/bin/bash
set -e

# ─── Sanbao Deploy Script ───────────────────────────────────────────────────
# Zero-downtime deploy for production Docker environment.
# See docs/DEVOPS.md for full infrastructure docs.
#
# Usage:
#   ./scripts/deploy.sh              # Full rebuild (build + restart all + AI Cortex)
#   ./scripts/deploy.sh app          # Rebuild only app (rolling restart, no AI Cortex)
#   ./scripts/deploy.sh cortex       # Rebuild AI Cortex stack (fragmentdb, orchestrator, embedding)
#   ./scripts/deploy.sh restart      # Restart without rebuild
#   ./scripts/deploy.sh status       # Show container status
#   ./scripts/deploy.sh logs [svc]   # Tail logs (default: app)
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"

# Cloudflare cache purge
CF_API_TOKEN="${CF_API_TOKEN:-ympF_5OJdcmeFAZCrb3As2ArTQhg_5lYQ4nCCxDS}"
CF_ZONE_ID="${CF_ZONE_ID:-73025f5522d28a0111fb6afaf39e8c31}"

# Server 2 SSH (for cloudflared check)
SERVER2_SSH="faragj@46.225.122.142"

purge_cf_cache() {
  echo "=== Purging Cloudflare cache ==="
  RESP=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' 2>&1)
  if echo "$RESP" | grep -q '"success":\s*true'; then
    echo "  Cloudflare cache purged"
  else
    echo "  WARNING: CF cache purge failed: $RESP"
  fi
}

# Check and stop cloudflared on Server 2 if running (prevents 503 from LB split)
check_server2_cloudflared() {
  echo "=== Checking Server 2 cloudflared ==="
  S2_CF=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$SERVER2_SSH" \
    "docker ps --format '{{.Names}}' 2>/dev/null | grep cloudflared" 2>/dev/null || true)
  if [ -n "$S2_CF" ]; then
    echo "  WARNING: cloudflared running on Server 2 ($S2_CF)"
    echo "  Stopping to prevent Cloudflare load-balancing split..."
    ssh -o ConnectTimeout=5 "$SERVER2_SSH" \
      "cd ~/faragj/deploy && docker compose -f docker-compose.failover.yml stop cloudflared" 2>/dev/null || true
    echo "  Server 2 cloudflared stopped"
    sleep 3
  else
    echo "  OK — Server 2 cloudflared not running"
  fi
}

# Wait for N healthy app containers (max wait ~3 min)
wait_for_app_healthy() {
  local NEED=${1:-3}
  local MAX_WAIT=${2:-36}  # 36 * 5s = 180s = 3 min
  echo "=== Waiting for $NEED healthy app container(s) ==="
  for i in $(seq 1 "$MAX_WAIT"); do
    HEALTHY=$($COMPOSE ps app --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
    HEALTHY=$(echo "$HEALTHY" | tr -d '[:space:]')
    TOTAL=$($COMPOSE ps app -q 2>/dev/null | wc -l | tr -d '[:space:]')
    if [ "$HEALTHY" -ge "$NEED" ]; then
      echo "  App healthy! ($HEALTHY/$TOTAL containers)"
      return 0
    fi
    echo "  [$i/$MAX_WAIT] healthy: $HEALTHY/$TOTAL, waiting..."
    sleep 5
  done
  echo "  WARNING: only $HEALTHY/$TOTAL app containers healthy after timeout"
  return 1
}

case "${1:-full}" in

  full)
    echo "=== Full rebuild & deploy (app + AI Cortex) ==="
    check_server2_cloudflared
    npm run build
    $COMPOSE build app embedding-proxy fragmentdb orchestrator
    $COMPOSE up -d
    wait_for_app_healthy 3 36
    purge_cf_cache
    $COMPOSE ps
    ;;

  cortex)
    echo "=== Rebuild AI Cortex stack ==="
    echo "--- Building AI Cortex images ---"
    $COMPOSE build embedding-proxy fragmentdb orchestrator

    echo "--- Restarting AI Cortex services ---"
    $COMPOSE up -d --no-deps embedding-proxy fragmentdb
    echo "  Waiting for FragmentDB to become healthy (this can take up to 10 min)..."
    for i in $(seq 1 120); do
      FRAG_HEALTHY=$($COMPOSE ps fragmentdb --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
      EMBED_HEALTHY=$($COMPOSE ps embedding-proxy --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
      if [ "$FRAG_HEALTHY" -ge 1 ] && [ "$EMBED_HEALTHY" -ge 1 ]; then
        echo "  FragmentDB + embedding-proxy healthy!"
        break
      fi
      echo "  [$i/120] fragmentdb=$FRAG_HEALTHY, embedding=$EMBED_HEALTHY, waiting..."
      sleep 5
    done

    echo "--- Starting orchestrator ---"
    $COMPOSE up -d --no-deps orchestrator
    for i in $(seq 1 12); do
      ORCH_HEALTHY=$($COMPOSE ps orchestrator --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
      if [ "$ORCH_HEALTHY" -ge 1 ]; then
        echo "  Orchestrator healthy!"
        break
      fi
      echo "  [$i/12] orchestrator=$ORCH_HEALTHY, waiting..."
      sleep 5
    done

    echo ""
    $COMPOSE ps embedding-proxy fragmentdb orchestrator
    ;;

  app)
    echo "=== Rebuild app (rolling restart) ==="
    check_server2_cloudflared
    npm run build

    # 1. Build new Docker image (no container changes yet)
    echo "--- Building Docker image ---"
    $COMPOSE build app

    # 2. Get current container IDs before recreating
    OLD_IDS=$($COMPOSE ps app -q 2>/dev/null || true)
    OLD_COUNT=$(echo "$OLD_IDS" | grep -c . || echo 0)

    if [ "$OLD_COUNT" -gt 1 ]; then
      # Rolling restart: scale down to 1, then scale back up
      # This keeps at least 1 container alive during the transition
      echo "--- Rolling restart: keeping service alive ---"

      # Scale to 1 old container (keep serving while we rebuild)
      KEEP=$(echo "$OLD_IDS" | head -1)
      REMOVE=$(echo "$OLD_IDS" | tail -n +2)
      for CID in $REMOVE; do
        docker stop "$CID" --time 15 >/dev/null 2>&1 || true
        docker rm "$CID" >/dev/null 2>&1 || true
      done
      echo "  Scaled down to 1 old container ($KEEP)"

      # Start 2 new containers with new image
      $COMPOSE up -d --no-deps --no-build --scale app=3 app 2>/dev/null
      echo "  Starting 2 new containers..."
      wait_for_app_healthy 2 24  # Wait for 2 new to be healthy

      # Now stop the last old container (new ones are healthy)
      docker stop "$KEEP" --time 15 >/dev/null 2>&1 || true
      docker rm "$KEEP" >/dev/null 2>&1 || true

      # Ensure we have 3 replicas running
      $COMPOSE up -d --no-deps --no-build --scale app=3 app 2>/dev/null
      wait_for_app_healthy 3 24
    else
      # Fresh start or single container — just bring up
      echo "--- Starting app containers ---"
      $COMPOSE up -d --no-deps --no-build app
      wait_for_app_healthy 1 24
    fi

    # 3. Reload nginx to pick up new upstreams (soft reload, no restart)
    echo "--- Reloading nginx ---"
    $COMPOSE exec -T nginx nginx -s reload 2>/dev/null || $COMPOSE restart nginx

    purge_cf_cache
    echo ""
    $COMPOSE ps
    ;;

  restart)
    echo "=== Restart (no rebuild) ==="
    check_server2_cloudflared
    $COMPOSE restart app
    wait_for_app_healthy 3 24
    $COMPOSE exec -T nginx nginx -s reload 2>/dev/null || true
    purge_cf_cache
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
    echo "Usage: $0 {full|app|cortex|restart|status|logs [service]}"
    exit 1
    ;;

esac
