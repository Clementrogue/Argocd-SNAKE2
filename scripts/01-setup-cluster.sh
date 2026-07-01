#!/usr/bin/env bash
# Étape 1 : cluster K8s local (k3d) + ArgoCD
set -euo pipefail

CLUSTER=${CLUSTER:-snake}

echo "==> Création du cluster k3d '$CLUSTER'"
k3d cluster create "$CLUSTER" \
  --agents 2 \
  --port "8080:80@loadbalancer" \
  --wait

echo "==> Installation d'ArgoCD"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "==> Attente du démarrage d'ArgoCD..."
kubectl -n argocd rollout status deploy/argocd-server --timeout=180s

echo "==> Mot de passe admin initial :"
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo
echo
echo "==> UI ArgoCD : kubectl -n argocd port-forward svc/argocd-server 8081:443"
echo "    puis https://localhost:8081  (user: admin)"
