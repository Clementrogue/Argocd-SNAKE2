# Répartition du travail (équipe de 2)

Le dépôt est découpé en **deux lanes qui ne se marchent pas dessus**, pour que
chacun puisse committer et pousser en parallèle sans conflit de merge.

## Principe : chacun son dossier

| | **Personne A — App & CI/CD** | **Personne B — GitOps & Infra** |
|---|---|---|
| Dossiers | `app/`, `.github/workflows/` | `gitops/`, `scripts/` |
| Responsabilité | le code du jeu, l'image Docker, la pipeline | le cluster, ArgoCD, Helm, Rollouts, IaC, sécu |

Tant que chacun reste dans SON dossier, il n'y a **aucun fichier partagé** →
aucun conflit git. Le seul point de contact est le **tag d'image**, et il est
géré automatiquement (voir plus bas).

## Découpage étape par étape

### Étape 1 — Fondations
- **A** : écrit l'app Snake (`app/src`), le `Dockerfile`, les tests jest.
  Build l'image en local, la pousse une première fois sur GHCR.
- **B** : `scripts/01-setup-cluster.sh` (k3d + ArgoCD), les manifests de base
  (`gitops/apps/snake/base` **ou** `gitops/helm/snake`), l'Application ArgoCD
  `snake-dev`, et `scripts/03-bootstrap-apps.sh`.
- **Objectif commun** : ArgoCD déploie Snake depuis Git automatiquement.

### Étape 2 — Helm, multi-env, CI → GitOps
- **A** : la pipeline `.github/workflows/ci-app.yml` (test → build → push →
  écrit le tag dans `gitops/helm/snake/values-*.yaml` → commit).
- **B** : Helm chart + `values-dev.yaml` (1 replica) vs `values-prod.yaml`
  (3 replicas), Application ArgoCD `snake-prod`.
- **Objectif commun** : push de code → déploiement auto sans intervention.

### Étape 3 — Déploiements progressifs
- **A** : prépare une **v2** de l'app (change `APP_COLOR`/`APP_VERSION`) pour
  qu'on VOIE le canary. Rebuild → nouveau tag.
- **B** : `scripts/02-install-rollouts.sh`, bascule vers `Rollout`
  (`rollout.enabled: true`), configure canary et blue/green
  (`gitops/rollouts/`), observe dans le dashboard.
- **Objectif commun** : déployer la v2 en canary sans casser la prod.

### Étape 4 — IaC
- **B** (principal) : Terraform Controller
  (`scripts/04-install-terraform-controller.sh`), module Terraform
  (`gitops/infrastructure/terraform/main.tf` : namespaces, RBAC, network
  policies), CRD `Terraform` + `GitRepository`.
- **A** (support) : rien de bloquant — peut aider à la relecture / démo.
- **Objectif** : une ressource infra créée et gérée 100% via Git.

### Étape 5 — Sécurité
- **A** : active le scan **Trivy** dans la CI (déjà branché, passer `exit-code`
  à `1` pour bloquer), commits signés (`git config commit.gpgsign true`).
- **B** : **Sealed Secrets** (`gitops/security/sealed-secret-example.yaml`),
  **RBAC ArgoCD** (`argocd-rbac-cm.yaml`), network policy deny-all.
- **Objectif commun** : livrable rendu, démo fonctionnelle.

## Le seul point de contact : le tag d'image

La CI de **A** écrit le nouveau tag dans les fichiers de **B**
(`values-dev.yaml`, `values-prod.yaml`) — mais **uniquement la ligne
`image.tag`**, via `yq`. C'est un `ci-bot` qui commit, pas vous. Donc :

- **B ne modifie jamais `image.tag` à la main** (sinon conflit avec la CI).
- **B modifie tout le reste** des values (replicas, rollout, resources…).

Résultat : A et B ne touchent jamais la même ligne. Zéro conflit.

## Stratégie git recommandée

```bash
# Chacun sur sa branche
git checkout -b feat/app-snake      # Personne A
git checkout -b feat/gitops-argocd  # Personne B

# On pousse sur sa branche, PR vers main, review croisée
git push -u origin feat/app-snake
```

- **1 branche par personne / par feature**, PR vers `main`, review par l'autre.
- **Messages de commit propres** (l'énoncé pénalise `fix`, `wip`, `test`) :
  utiliser des messages conventionnels — `feat(app): …`, `feat(gitops): …`,
  `ci: …`, `docs: …`.
- **Ne pas rebase/force-push sur `main`** : ArgoCD suit `main`, un historique
  cassé = un déploiement cassé.

## Qui répond à quoi à l'oral (tout le monde doit savoir)

- **A** sait expliquer : structure de l'image, la pipeline, pourquoi versionner
  par SHA, le scan Trivy.
- **B** sait expliquer : Helm vs Kustomize, canary vs blue/green, le flux de
  réconciliation ArgoCD, le drift Terraform, Sealed Secrets vs Secret en clair.
- **Les deux** savent lancer la démo from scratch avec les scripts.
