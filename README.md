# 🐍 Argocd-SNAKE

Projet fil rouge **GitOps** — déploiement d'un jeu **Snake** (Node.js/Express) sur
Kubernetes, piloté de bout en bout par **ArgoCD**, avec CI/CD, déploiements
progressifs (Argo Rollouts), Infrastructure as Code (Terraform Controller) et
sécurité GitOps.

> Le jeu Snake remplace la todo-api de l'énoncé. L'API REST des scores
> (`GET/POST/DELETE /api/scores`) joue le rôle des endpoints demandés.

---

## Architecture

```
Développeur ──push──> GitHub (app/)
                          │
                 GitHub Actions (CI)
             build → test → scan Trivy
                → push image (GHCR)
                → écrit le tag dans gitops/
                          │
                       git commit
                          │
                        ArgoCD  ◄── surveille gitops/helm/snake
                          │
                    sync automatique
                          ▼
                 ┌──────────────────┐
                 │   Cluster k3d    │
                 │  snake-dev (1)   │
                 │  snake-prod (3)  │ ← Argo Rollouts (canary / blue-green)
                 └──────────────────┘
```

## Structure du dépôt

```
Argocd-SNAKE/
├── app/                       # 🅰️ APPLICATION (lane Personne A)
│   ├── src/                   #   Express + jeu Snake (canvas) + API scores
│   ├── tests/                 #   tests jest (11 tests)
│   └── Dockerfile             #   image multi-stage, non-root
├── gitops/                    # 🅱️ GITOPS (lane Personne B)
│   ├── apps/snake/            #   Kustomize (base + overlays dev/prod)
│   ├── helm/snake/            #   Helm chart (Deployment ou Rollout)
│   ├── argocd/applications/   #   AppProject + Applications ArgoCD
│   ├── rollouts/              #   Rollout canary / blue-green (Étape 3)
│   ├── infrastructure/        #   Terraform + TF Controller (Étape 4)
│   └── security/              #   Sealed Secrets, RBAC ArgoCD (Étape 5)
├── .github/workflows/         # 🅰️ CI (lane Personne A)
├── scripts/                   # 🅱️ setup cluster / argocd / rollouts (Personne B)
├── README.md
└── REPARTITION.md             # découpage du travail à 2 + stratégie git
```

## Prérequis

- Docker, `k3d`, `kubectl`, `helm`
- (Étape 3) plugin `kubectl-argo-rollouts`
- Un compte GitHub (image publiée sur **GHCR** = GitHub Container Registry)

> ⚠️ Remplacer partout `OWNER` par votre utilisateur/organisation GitHub
> (recherche-remplace global). Concerne : manifests, values Helm, ArgoCD apps.

## Démarrage rapide (from scratch — c'est ce qu'on montre en démo)

```bash
# 1. Cluster local + ArgoCD
./scripts/01-setup-cluster.sh

# 2. Déclarer les applications ArgoCD (elles se synchronisent seules)
./scripts/03-bootstrap-apps.sh

# 3. (Étape 3) Argo Rollouts pour les déploiements progressifs
./scripts/02-install-rollouts.sh

# 4. (Étape 4) Terraform Controller pour l'IaC
./scripts/04-install-terraform-controller.sh

# Accéder au jeu (dev)
kubectl -n snake-dev port-forward svc/snake 3000:80
# → http://localhost:3000
```

## Les 5 étapes

| Étape | Objectif | Lane |
|-------|----------|------|
| 1 — Fondations | ArgoCD déploie Snake depuis Git | A: app · B: cluster + ArgoCD + manifests |
| 2 — Helm + multi-env + CI | Push code → déploiement auto | A: CI · B: Helm/Kustomize dev vs prod |
| 3 — Déploiements progressifs | Canary sans casser la prod | A: nouvelle version · B: Rollouts |
| 4 — IaC | Ressource infra 100% via Git | B: Terraform Controller |
| 5 — Sécurité | Livrable + démo | A: scan image · B: Sealed Secrets + RBAC |

Détail du découpage et de la stratégie git dans **[REPARTITION.md](./REPARTITION.md)**.

## Choix techniques (à défendre à l'oral)

- **Helm _et_ Kustomize fournis.** Kustomize (`gitops/apps/snake`) pour du
  patch simple sans templating ; Helm (`gitops/helm/snake`) retenu pour ArgoCD
  car il gère proprement la bascule `Deployment ↔ Rollout` via un flag
  (`rollout.enabled`) et les valeurs par environnement (`values-dev/prod.yaml`).
- **Canary par défaut, blue/green en option.** Canary (10% → 50% → 100% avec
  pauses) pour valider progressivement sous vrai trafic ; blue/green
  (`rollout-bluegreen.yaml`) quand on veut une bascule instantanée + rollback
  1 clic sans période de cohabitation des versions.
- **Image versionnée par SHA** (`sha-xxxxxxx`), jamais `latest` en prod : ArgoCD
  détecte le changement de tag et resynchronise.
- **Sécurité intégrée** : conteneur non-root + `readOnlyRootFilesystem`, scan
  Trivy en CI, secrets chiffrés (Sealed Secrets), RBAC ArgoCD par rôle.

## Démo « voir » le canary

Le badge de version et la couleur du serpent sont pilotés par `APP_VERSION` /
`APP_COLOR`. En passant prod de `v1` (vert) à `v2` (ex. orange), on observe
visuellement la montée en charge du canary dans le dashboard Argo Rollouts.

## API REST des scores

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/scores` | top 10 des scores |
| POST | `/api/scores` | `{ "player": "brubru", "score": 42 }` |
| DELETE | `/api/scores/:id` | supprime un score |
| GET | `/healthz` `/readyz` | probes Kubernetes |
| GET | `/api/version` | version + couleur (démo canary) |
