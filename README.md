# 🐍 Argocd-SNAKE — Projet fil rouge GitOps

Déploiement d'un jeu **Snake** (Node.js / Express + API REST de scores) sur **Kubernetes**, piloté 100 % en **GitOps** avec **ArgoCD**. Le dépôt Git est l'unique source de vérité : tout changement mergé sur `main` est synchronisé automatiquement sur le cluster.

Stack : **k3d · ArgoCD · Helm · Kustomize · Argo Rollouts · Flux + Terraform Controller · Sealed Secrets**.

---

## 🏗️ Architecture

### Vue d'ensemble

```
        git push (main)
             │
             ▼
   ┌───────────────────┐        watch & sync         ┌────────────────────────┐
   │   Dépôt GitHub     │ ──────────────────────────► │        ArgoCD          │
   │  (source de vérité)│                             │   (namespace argocd)   │
   └───────────────────┘                             └───────────┬────────────┘
                                                                 │ applique
                                          ┌──────────────────────┼──────────────────────┐
                                          ▼                                              ▼
                                  ┌───────────────┐                            ┌───────────────┐
                                  │  snake-dev    │                            │  snake-prod   │
                                  │  1 replica    │                            │  3 replicas   │
                                  │  Deployment   │                            │  Argo Rollout │
                                  │  v1 · vert    │                            │  v2 · canary  │
                                  └───────────────┘                            └───────────────┘
```

### Deux environnements, une seule base de code

| | **dev** (`snake-dev`) | **prod** (`snake-prod`) |
|---|---|---|
| Replicas | 1 | 3 |
| Type de déploiement | `Deployment` classique | **Argo Rollout** (canary) |
| Version applicative | `v1` | `v2` |
| Couleur du serpent | 🟢 `#39ff14` | 🔵 `#00d4ff` |
| Fichier de valeurs Helm | `values-dev.yaml` | `values-prod.yaml` |
| Sync ArgoCD | automatique (prune + selfHeal) | automatique (prune + selfHeal) |

La bascule `Deployment ↔ Rollout` se fait via un simple flag Helm `rollout.enabled` — c'est le même chart qui sert les deux environnements.

### L'application

Serveur Express minimal (Node ≥ 20), écoutant sur le port `3000` :

| Endpoint | Rôle |
|---|---|
| `GET /` | Le jeu Snake (HTML/CSS/JS statique) |
| `GET /healthz` | Liveness probe |
| `GET /readyz` | Readiness probe |
| `GET /api/version` | Version + couleur actives (sert à visualiser le canary) |
| `GET /api/scores` | Top 10 des scores |
| `POST /api/scores` | Enregistrer un score |
| `DELETE /api/scores/:id` | Supprimer un score |

### Stratégie de déploiement canary (prod)

Le rollout progresse par paliers de trafic avec des pauses d'observation :

```
10 %  ──(pause 30s)──►  50 %  ──(pause 30s)──►  100 %
```

C'est ce qui permet la démo **v1 (vert) → v2 (bleu)** : on pousse la v2, ArgoCD la synchronise, et Argo Rollouts la déploie progressivement sans coupure.

---

## 📁 Structure du dépôt

```
Argocd-SNAKE2/
├── app/                              # Application Node.js
│   ├── src/
│   │   ├── server.js                 # Point d'entrée (port 3000)
│   │   ├── app.js                    # Routes Express (health, version, scores)
│   │   ├── scores.js                 # Store des scores en mémoire
│   │   └── public/                   # Front du jeu (index.html, snake.js, style.css)
│   ├── tests/                        # Tests Jest + Supertest
│   └── Dockerfile                    # Image publiée sur ghcr.io/clementrogue/argocd-snake
│
├── gitops/                           # Tout le déclaratif GitOps
│   ├── argocd/applications/          # Les Applications ArgoCD (App = point d'entrée du sync)
│   │   ├── project.yaml              #   AppProject "snake"
│   │   ├── snake-dev.yaml            #   App dev  → helm + values-dev.yaml
│   │   └── snake-prod.yaml           #   App prod → helm + values-prod.yaml
│   │
│   ├── helm/snake/                   # Chart Helm (utilisé par les deux envs)
│   │   ├── Chart.yaml
│   │   ├── values.yaml               #   valeurs par défaut
│   │   ├── values-dev.yaml           #   surcharge dev
│   │   ├── values-prod.yaml          #   surcharge prod (rollout activé)
│   │   └── templates/                #   deployment / rollout / service / helpers
│   │
│   ├── apps/snake/                   # Variante Kustomize (base + overlays dev/prod)
│   │   ├── base/
│   │   └── overlays/{dev,prod}/
│   │
│   ├── rollouts/                     # Définitions Argo Rollouts
│   │   ├── rollout-canary.yaml
│   │   ├── rollout-bluegreen.yaml
│   │   └── analysis-success-rate.yaml
│   │
│   ├── infrastructure/terraform/     # IaC via Flux + Terraform Controller
│   │   ├── main.tf
│   │   ├── terraform.yaml            #   ressource Terraform (CRD)
│   │   ├── gitrepository.yaml        #   source Git suivie par Flux
│   │   └── tf-runner-rbac.yaml
│   │
│   └── security/                     # Durcissement
│       ├── argocd-rbac-cm.yaml       #   RBAC ArgoCD
│       ├── networkpolicy-*.yaml      #   Network Policies default-deny (dev + prod)
│       └── sealed-secret-example.yaml#   secret chiffré versionnable
│
└── scripts/                          # Scripts d'installation numérotés
    ├── 01-setup-cluster.sh
    ├── 02-install-rollouts.sh
    ├── 03-bootstrap-apps.sh
    ├── 04-install-terraform-controller.sh
    ├── 05-security-setup.sh
    └── 99-teardown.sh
```

---

## 🚀 Lancer le projet

### Prérequis (macOS)

Docker Desktop doit être démarré. Le reste s'installe via Homebrew :

```bash
brew install k3d kubectl helm
brew install argoproj/tap/kubectl-argo-rollouts
```

### Étape 0 — Cloner

```bash
git clone https://github.com/Clementrogue/Argocd-SNAKE2.git
cd Argocd-SNAKE2
chmod +x scripts/*.sh
```

### Étape 1 — Installation (dans l'ordre)

Chaque script est idempotent et affiche ce qu'il fait.

```bash
# 1. Cluster k3d "snake" (2 agents) + installation d'ArgoCD
#    Affiche le mot de passe admin ArgoCD à la fin — note-le.
./scripts/01-setup-cluster.sh

# 2. Argo Rollouts (nécessaire avant le sync prod : la prod utilise un Rollout)
./scripts/02-install-rollouts.sh

# 3. Déclaration des Applications ArgoCD (dev + prod)
#    ArgoCD prend le relais et synchronise tout depuis Git.
./scripts/03-bootstrap-apps.sh

# 4. (optionnel) Flux + Terraform Controller pour la partie IaC
./scripts/04-install-terraform-controller.sh

# 5. (optionnel) Sécurité : Sealed Secrets + RBAC ArgoCD + Network Policies
./scripts/05-security-setup.sh
```

> ⚠️ L'ordre **02 avant 03** est important : la prod déploie un Argo Rollout, donc le CRD `Rollout` doit exister avant qu'ArgoCD ne tente de synchroniser `snake-prod`, sinon le premier sync échoue.

### Étape 2 — Vérifier que tout est sync

```bash
kubectl -n argocd get applications
```

Résultat attendu :

```
NAME         SYNC STATUS   HEALTH STATUS
snake-dev    Synced        Healthy
snake-prod   Synced        Progressing   (puis Healthy, ou Suspended pendant une pause canary)
```

---

## 🌐 Accéder aux interfaces

> Chaque commande ci-dessous est **bloquante** : elle occupe le terminal tant qu'elle tourne. Ouvre **un onglet par service** (`Cmd+T`) et laisse-les tournés.

### Le jeu Snake

```bash
# dev
kubectl -n snake-dev port-forward svc/snake 3000:80
# → http://localhost:3000
```

### L'UI ArgoCD

> Le port `8080` est déjà pris par le load balancer k3d → on utilise **8081**.

```bash
# Récupérer le mot de passe admin (user: admin)
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d; echo

kubectl -n argocd port-forward svc/argocd-server 8081:443
# → https://localhost:8081
```

### Le dashboard Argo Rollouts

> Ce n'est **pas** un port-forward : la commande lance son propre serveur web sur le port `3100`. Elle doit tourner dans **son propre terminal**. Le namespace se choisit dans le menu déroulant de l'UI.

```bash
kubectl argo rollouts dashboard
# → http://localhost:3100
```

---

## 🎬 Démo canary (v1 vert → v2 bleu)

```bash
# Suivre le rollout en direct
kubectl argo rollouts get rollout snake -n snake-prod --watch

# Si le rollout est en pause (Suspended) : promouvoir l'étape suivante
kubectl argo rollouts promote snake -n snake-prod

# Tout promouvoir d'un coup (skip les pauses)
kubectl argo rollouts promote snake -n snake-prod --full

# En cas de souci : rollback immédiat
kubectl argo rollouts undo snake -n snake-prod
```

Pendant la bascule, rafraîchir `http://localhost:3000` (ou l'onglet prod) montre le serpent passer progressivement du vert au bleu, au rythme des paliers 10 % → 50 % → 100 %.

---

## 🧹 Nettoyage

```bash
./scripts/99-teardown.sh          # supprime le cluster k3d "snake"
```

---

## 🐛 Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| `localhost:3100` — connexion échouée | Le dashboard Rollouts n'est pas lancé (ou tué par une commande suivante) | Le lancer dans **son propre terminal** et l'y laisser |
| Pod en `ImagePullBackOff` | L'image GHCR est privée | Rendre le package `ghcr.io/clementrogue/argocd-snake` **public** |
| `snake-prod` reste `OutOfSync` / erreur `no matches for kind Rollout` | Argo Rollouts pas installé | Lancer `./scripts/02-install-rollouts.sh` **avant** le bootstrap |
| Port 8080 déjà utilisé pour l'UI ArgoCD | Occupé par le load balancer k3d | Utiliser `8081:443` pour le port-forward |
| App reste `Progressing` sans jamais finir | Rollout en pause canary (attend une validation) | `kubectl argo rollouts promote snake -n snake-prod` |
