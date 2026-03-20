#!/bin/bash
# Deploy Sanbao to K3s cluster
# Usage: ./deploy-k3s.sh [init|secrets|app|all]

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANBAO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

case "${1:-all}" in
  init)
    echo "=== Creating namespace and base resources ==="
    kubectl apply -f "$SCRIPT_DIR/namespace.yml"
    kubectl apply -f "$SCRIPT_DIR/cluster-issuer.yml"
    kubectl apply -f "$SCRIPT_DIR/network-policies.yml"
    echo "Done."
    ;;

  secrets)
    echo "=== Creating secrets from .env ==="
    if [ ! -f "$SANBAO_DIR/.env" ]; then
      echo "ERROR: $SANBAO_DIR/.env not found"
      exit 1
    fi
    kubectl create secret generic sanbao-secrets \
      --from-env-file="$SANBAO_DIR/.env" \
      -n sanbao \
      --dry-run=client -o yaml | kubectl apply -f -
    echo "Secrets created."
    ;;

  app)
    echo "=== Deploying application ==="
    kubectl apply -f "$SCRIPT_DIR/configmap.yml"
    kubectl apply -f "$SCRIPT_DIR/postgres.yml"
    kubectl apply -f "$SCRIPT_DIR/redis.yml"
    kubectl apply -f "$SCRIPT_DIR/pgbouncer.yml"
    kubectl apply -f "$SCRIPT_DIR/app-deployment.yml"
    kubectl apply -f "$SCRIPT_DIR/hpa.yml"
    kubectl apply -f "$SCRIPT_DIR/pdb.yml"
    kubectl apply -f "$SCRIPT_DIR/ingress.yml"

    echo "=== Waiting for rollout ==="
    kubectl rollout status deployment/sanbao-app -n sanbao --timeout=120s || true
    kubectl get pods -n sanbao
    echo "Done."
    ;;

  status)
    echo "=== Cluster Status ==="
    kubectl get nodes
    echo ""
    echo "=== Sanbao Pods ==="
    kubectl get pods -n sanbao -o wide
    echo ""
    echo "=== Services ==="
    kubectl get svc -n sanbao
    echo ""
    echo "=== Ingress ==="
    kubectl get ingress -n sanbao
    ;;

  all)
    $0 init
    $0 secrets
    $0 app
    echo ""
    echo "=== Full deployment complete ==="
    $0 status
    ;;

  *)
    echo "Usage: $0 [init|secrets|app|status|all]"
    exit 1
    ;;
esac
