#!/usr/bin/env bash
# Étape 4 : Flux + Terraform Controller
set -euo pipefail
echo "==> Installation de Flux (source-controller)"
kubectl apply -f https://github.com/fluxcd/flux2/releases/latest/download/install.yaml
echo "==> Installation du Terraform Controller (tf-controller)"
kubectl apply -f https://raw.githubusercontent.com/flux-iac/tofu-controller/main/docs/release.yaml
kubectl -n flux-system rollout status deploy/tf-controller --timeout=180s || true
echo "==> Application des ressources IaC"
kubectl apply -f gitops/infrastructure/terraform/gitrepository.yaml
kubectl apply -f gitops/infrastructure/terraform/terraform.yaml
