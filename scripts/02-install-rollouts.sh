#!/usr/bin/env bash
# Étape 3 : Argo Rollouts
set -euo pipefail
echo "==> Installation d'Argo Rollouts"
kubectl create namespace argo-rollouts --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
kubectl -n argo-rollouts rollout status deploy/argo-rollouts --timeout=180s
echo "==> Plugin kubectl (dashboard canary) :"
echo "    kubectl argo rollouts dashboard   # http://localhost:3100"
