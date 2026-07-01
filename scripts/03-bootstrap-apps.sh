#!/usr/bin/env bash
# Étape 1/2 : on déclare les Applications ArgoCD (elles se sync toutes seules ensuite)
set -euo pipefail
kubectl apply -f gitops/argocd/applications/project.yaml
kubectl apply -f gitops/argocd/applications/snake-dev.yaml
kubectl apply -f gitops/argocd/applications/snake-prod.yaml
echo "==> Applications créées. ArgoCD synchronise depuis Git."
kubectl -n argocd get applications
