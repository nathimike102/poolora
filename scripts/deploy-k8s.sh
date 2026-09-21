#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Poolora Platform — Kubernetes Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

echo "═══════════════════════════════════════════════════"
echo "  Poolora Platform — K8s Deployment"
echo "═══════════════════════════════════════════════════"

# Namespace
echo "→ Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Secrets & ConfigMap
echo "→ Applying secrets and config..."
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# Registry credentials for the private GHCR images. GHCR_TOKEN is a GitHub
# personal access token with the read:packages scope.
echo "→ Applying GHCR pull secret..."
if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  kubectl -n poolora create secret docker-registry ghcr-pull \
    --docker-server=ghcr.io \
    --docker-username="$GHCR_USER" \
    --docker-password="$GHCR_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f -
else
  echo "  ! GHCR_USER / GHCR_TOKEN not set; skipping. Backend and ML pods cannot pull"
  echo "    private images until the ghcr-pull secret exists."
fi

# PVC & Resource Quota
echo "→ Setting up storage and quotas..."
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/resource-quota.yaml

# Network Policies
echo "→ Applying network policies..."
kubectl apply -f k8s/network-policy.yaml

# Stateful Services (DB, Cache, Message Queue)
echo "→ Deploying MongoDB..."
kubectl apply -f k8s/mongodb-statefulset.yaml

echo "→ Deploying Redis..."
kubectl apply -f k8s/redis-statefulset.yaml

echo "→ Deploying Kafka..."
kubectl apply -f k8s/kafka-statefulset.yaml

echo "→ Deploying Elasticsearch..."
kubectl apply -f k8s/elasticsearch-statefulset.yaml

# Services
echo "→ Creating services..."
kubectl apply -f k8s/services.yaml

# Wait for stateful services
echo "→ Waiting for stateful services to be ready..."
kubectl -n poolora rollout status statefulset/mongodb --timeout=120s 2>/dev/null || true
kubectl -n poolora rollout status statefulset/redis --timeout=60s 2>/dev/null || true

# Application Deployments
echo "→ Deploying Backend..."
kubectl apply -f k8s/backend-deployment.yaml

echo "→ Deploying ML Engine..."
kubectl apply -f k8s/ml-deployment.yaml

echo "→ Deploying Monitoring (Prometheus + Grafana)..."
kubectl apply -f k8s/monitoring.yaml

# HPA & PDB
echo "→ Setting up autoscaling and disruption budgets..."
kubectl apply -f k8s/backend-hpa.yaml
kubectl apply -f k8s/pdb.yaml

# DB Init Job
echo "→ Running database initialization..."
kubectl apply -f k8s/db-init-job.yaml

# Backup CronJob
echo "→ Setting up backup schedule..."
kubectl apply -f k8s/backup-cronjob.yaml

# Ingress (last — depends on services)
echo "→ Configuring ingress..."
kubectl apply -f k8s/ingress.yaml

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Deployment complete"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  API:         \$(kubectl -n poolora get ingress -o jsonpath='{.items[0].spec.rules[0].host}')"
echo "  Grafana:     kubectl -n poolora port-forward svc/grafana 3000:3000"
echo ""
echo "  Check status: kubectl -n poolora get pods"
echo "═══════════════════════════════════════════════════"
