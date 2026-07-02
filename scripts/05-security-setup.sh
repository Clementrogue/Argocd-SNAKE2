#!/usr/bin/env bash
# Étape 5 : Sécurité — Sealed Secrets + RBAC ArgoCD + Network Policies
set -euo pipefail

echo "==> Installation du controller Sealed Secrets"
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/controller.yaml
kubectl -n kube-system rollout status deploy/sealed-secrets-controller --timeout=120s

echo "==> Installation du CLI kubeseal (si absent)"
if ! command -v kubeseal &> /dev/null; then
  KUBESEAL_VERSION=$(curl -s https://api.github.com/repos/bitnami-labs/sealed-secrets/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  curl -OL "https://github.com/bitnami-labs/sealed-secrets/releases/download/v${KUBESEAL_VERSION}/kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz"
  tar -xvzf "kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz" kubeseal
  sudo install -m 755 kubeseal /usr/local/bin/kubeseal
  rm -f kubeseal "kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz"
fi

echo "==> Génération d'un vrai Sealed Secret (namespace snake-prod)"
kubectl create namespace snake-prod --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic snake-secret \
  --namespace snake-prod \
  --from-literal=API_TOKEN="${API_TOKEN:-changeme-token}" \
  --dry-run=client -o yaml \
  | kubeseal --format yaml --controller-namespace kube-system \
  > gitops/security/sealed-secret-generated.yaml

echo "==> Sealed Secret généré : gitops/security/sealed-secret-generated.yaml"
echo "    -> committe-le dans Git, il est chiffré donc safe à versionner."

echo "==> Application du RBAC ArgoCD"
kubectl apply -f gitops/security/argocd-rbac-cm.yaml
kubectl -n argocd rollout restart deploy/argocd-server

echo "==> Application des Network Policies (dev + prod)"
kubectl create namespace snake-dev --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f gitops/security/networkpolicy-default-deny.yaml
kubectl apply -f gitops/security/networkpolicy-default-deny-dev.yaml

echo "==> Sécurité en place : Sealed Secrets, RBAC ArgoCD, Network Policies deny-all."
