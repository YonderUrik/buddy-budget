# Phase 6 — App in parallel — Runbook

> **Status (2026-09-27):** Tasks 1-8 executed (the checkboxes below were not ticked during execution; the real status is in the commits of the two repos and in the `CLAUDE.md` log). Umami tracking (Task 7 Steps 8-9) was fixed afterwards: route `/stats/script.js` + `/stats/api/send` with `stripPrefix`, not `/stats/script`. **Task 9** remains (manual user verification).

> **For the executor:** this is a plan in guided runbook format, not a TDD plan on application code — same format as Phases 1-5 (`docs/superpowers/plans/2026-09-26-fase-*.md`, `2026-09-27-fase-5-observability.md`), consistent with the project's explicit standard ("every phase becomes a plan in guided runbook format", `CLAUDE.md`). Every task produces manifests verifiable with real `kubectl`/`curl` via Tailscale, not automated tests — the only task with application code (Task 7, Umami script) is still minimal and verified live. **REQUIRED SUB-SKILL:** superpowers:executing-plans (inline execution in this session, consistent with the user's process constraint — actions on accounts/DNS/terminal remain theirs, Claude prepares and verifies).

**Goal:** run BuddyBudget inside the k3s cluster on `app.buddybudget.io` with real data (dump from Neon), CronJobs instead of Vercel Cron, Umami for analytics, and a fully automatic CI→GHCR→infra repo→ArgoCD loop — ready for the full manual verification before the cutover (Phase 7).

**Architecture:** new `app` namespace in the `buddy-budget-infra` repo (Deployment with 2 replicas + Service + Traefik IngressRoute + PreSync migration Job, managed by ArgoCD like all components since Phase 3), data copied from Neon to CloudNativePG with `pg_dump`/`pg_restore`, two k8s `CronJob`s instead of Vercel Cron, Umami as a second Deployment with a dedicated DB in the same CNPG cluster (`Database` CRD + declarative role), an extra step in the app repo's CI that updates the image tag in the infra repo via `kustomize edit set image`.

**Tech Stack:** Kubernetes (k3s) via ArgoCD, Kustomize + KSOPS (SOPS/age) for secrets, CloudNativePG (`Cluster`/`Database` CRDs), Traefik `IngressRoute`, GitHub Actions, Docker (images already built since Phase 0: `buddy-budget` target `runner`, `buddy-budget-migrate` target `migrator`), Umami (official image `ghcr.io/umami-software/umami:postgresql-latest`).

**Spec:** `docs/superpowers/specs/2026-09-27-fase-6-app-parallelo-design.md` (and reference `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md`, Phases section row 6 and architecture line 53 for the PreSync migration Job).

## Global Constraints

- No builds on the VPS: only images already built by GitHub Actions (`ghcr.io/YonderUrik/buddy-budget`, `ghcr.io/YonderUrik/buddy-budget-migrate`).
- Everything declarative and rebuildable: every manifest goes into the `buddy-budget-infra` repo, no manual `kubectl apply` outside annotated temporary debugging (principle already written in the main spec).
- Secrets always encrypted with SOPS/age in the repo (`*.enc.yaml` + KSOPS `kustomization.yaml`/`generator.yaml`), never in plain text on the filesystem longer than needed to encrypt them — same scheme already used for R2/tunnel/Slack/Grafana.
- Explicit `resources.requests`/`limits` on every new container (rule already in force in all previous phases).
- NetworkPolicy: only explicit `Ingress` rules (default-deny + targeted exceptions) — this repo has never introduced `Egress` rules, and we stay consistent with that choice here too rather than introducing a new pattern.
- Vercel crons disabled **before** activating the equivalent k8s CronJobs (shared GoCardless rate limit of ~4 calls/day/account — see Task 1).
- Dump/restore and the creation of real credentials (DB passwords, GitHub PAT, Google/GoCardless keys) remain user actions from the terminal: Claude prepares the exact commands, it does not run them with its own credentials.

## Review Focus

- **App unable to reach Redis/Postgres because of a forgotten NetworkPolicy**: the `data` namespace today only has `default-deny-ingress` with no exceptions (explicit comment in the repo: "the exception is added together with that namespace" — i.e. here). If Task 2 does not add `allow-app-to-data`, the app goes into a crash loop on `/api/health/ready` with a timeout, not an obvious error.
- **Migration Job running on an empty schema before the restore**: if Task 5 (app deploy + PreSync Job) is run before Task 4 (data restore), the migration Job creates the tables from scratch on the Drizzle baseline; the subsequent `pg_restore` of the Neon dump would fail on already existing tables (or overwrite them silently with `--clean`, losing the "already migrated" marking). The order Task 4 → Task 5 is binding and must be respected explicitly, not just by numbering.
- **Google OAuth broken on `app.buddybudget.io`**: better-auth builds the Google redirect from `BETTER_AUTH_URL`; if the redirect URI is not added in Google Cloud Console, Google login fails with `redirect_uri_mismatch` — not a k8s configuration problem, it must be done by hand outside the cluster (Task 5).
- **Double GoCardless sync because of an inverted order**: if the k8s CronJobs (Task 6) are applied before disabling the Vercel crons (Task 1), the two stacks sync the same real account in parallel, the first run exceeds the sandbox rate limit and blocks syncs for the rest of the day on both.
- **DATABASE_URL without an explicit `sslmode`**: `resolveDbSsl` (`lib/db/ssl.ts`) enforces TLS in production (`NODE_ENV=production`, already baked into the `runner` image) unless the URL specifies `sslmode`; CNPG here has no client-side TLS configured for these internal connections, so without an explicit `?sslmode=disable` the app does not start (connection refused) — debt already noted in Phase 0 ("to be decided in Phase 6 with explicit sslmode in the k8s manifests"), resolved here in Task 3.

---

## Order of steps

1. Disable the Vercel crons.
2. `app` namespace: NetworkPolicy + ResourceQuota/LimitRange (still without Deployment/Secret).
3. App secrets: GHCR pull secret + application Secret (with correct `DATABASE_URL`/`REDIS_URL`).
4. Data migration Neon → CNPG (dump/restore + row count check).
5. App deploy (Deployment with 2 replicas + Service + IngressRoute + PreSync migration Job) + DNS + Google OAuth redirect.
6. k8s CronJobs (`gocardless-sync`, `net-worth-snapshot`).
7. Umami (dedicated DB in CNPG, Deployment, Tailscale Ingress, tracking script in the app).
8. CI step: automatic update of the image tag in the infra repo.
9. End-to-end manual user verification.

---

### Task 1: Disable the Vercel crons

**Files:**
- Modify: `vercel.json` (app repo, `main` branch)

**Interfaces:**
- Consumes: none.
- Produces: no active cron on the Vercel side from this point on — precondition for Task 6.

- [ ] **Step 1: Remove the `crons` section**

Read `vercel.json`, remove the whole `"crons"` key (the `/api/cron/*` routes stay in the code, unchanged — from here on it is the k8s CronJobs of Task 6 that call them).

- [ ] **Step 2: Commit and push to `main`**

```bash
git add vercel.json
git commit -m "chore: disattiva Vercel Cron, sostituiti dai CronJob k8s (Fase 6)"
git push origin main
```

- [ ] **Step 3: Verify on Vercel**

The user checks in Vercel → Project → Settings → Cron Jobs that the list is empty after the automatic redeploy triggered by the push. Confirm explicitly before moving to Task 6 (no hurry: Tasks 2-5 do not touch GoCardless).

---

### Task 2: `app` namespace — NetworkPolicy and Quota

**Files:**
- Create: `argocd/manifests/app/namespace.yaml` (`buddy-budget-infra` repo)
- Create: `argocd/manifests/app/networkpolicy.yaml`
- Create: `argocd/manifests/app/quota.yaml`
- Create: `argocd/manifests/app/kustomization.yaml`
- Create: `argocd/apps/app.yaml`
- Modify: `argocd/manifests/security/networkpolicy-data.yaml` (adds the exception towards `data`)

**Interfaces:**
- Consumes: none (first manifest of the `app` namespace).
- Produces: existing `app` namespace with `default-deny-ingress` + exception from `ingress` (Traefik); exception in `data` that the following Tasks (Secret, Deployment) take for granted.

- [ ] **Step 1: Namespace + NetworkPolicy + Quota**

```yaml
# argocd/manifests/app/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: app
```

```yaml
# argocd/manifests/app/networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: app
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
# Traefik (ingress namespace) must be able to reach the app on port 3000.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-traefik-to-app
  namespace: app
spec:
  podSelector: {}
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress
          podSelector:
            matchLabels:
              app.kubernetes.io/name: traefik
      ports:
        - protocol: TCP
          port: 3000
```

```yaml
# argocd/manifests/app/quota.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: app
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 50m
        memory: 128Mi
      default:
        cpu: 500m
        memory: 512Mi
---
# Headroom above the RAM budget estimated in the main spec (300-600Mi for 2 Next.js replicas,
# + Umami in the same namespace).
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute
  namespace: app
spec:
  hard:
    requests.cpu: "1"
    requests.memory: 1.5Gi
    limits.cpu: "2"
    limits.memory: 3Gi
```

```yaml
# argocd/manifests/app/kustomization.yaml
resources:
  - namespace.yaml
  - networkpolicy.yaml
  - quota.yaml
```

- [ ] **Step 2: ArgoCD Application**

```yaml
# argocd/apps/app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: git@github.com:YonderUrik/buddy-budget-infra.git
    targetRevision: main
    path: argocd/manifests/app
  destination:
    server: https://kubernetes.default.svc
    namespace: app
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

- [ ] **Step 3: NetworkPolicy exception in `data`**

```yaml
# argocd/manifests/security/networkpolicy-data.yaml — replace the content with:
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: data
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
# The app (app namespace) must be able to reach Postgres (5432) and Redis (6379).
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-to-data
  namespace: data
spec:
  podSelector: {}
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: app
      ports:
        - protocol: TCP
          port: 5432
        - protocol: TCP
          port: 6379
```

- [ ] **Step 4: Commit, push, verify**

```bash
git add argocd/manifests/app argocd/apps/app.yaml argocd/manifests/security/networkpolicy-data.yaml
git commit -m "feat: namespace app (NetworkPolicy + quota) e eccezione verso data"
git push origin main
```

Verification (via Tailscale): `kubectl get ns app` → exists; `kubectl get networkpolicy -n app` → 2 policies; `kubectl get networkpolicy -n data` → 2 policies (default-deny + allow-app-to-data).

---

### Task 3: App secrets

**Files:**
- Create: `argocd/manifests/app/ghcr-pull-secret.enc.yaml`
- Create: `argocd/manifests/app/app-secrets.enc.yaml`
- Create: `argocd/manifests/app/generator.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml` (adds `generators`)

**Interfaces:**
- Consumes: `app` namespace from Task 2.
- Produces: `Secret/ghcr-pull-secret` (type `kubernetes.io/dockerconfigjson`, for the `imagePullSecrets` of Task 5), `Secret/app-env` with the keys `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`, `CRON_SECRET` — names identical to `serverEnvSchema` (`lib/env.ts:10-27`), consumed by Task 5 via `envFrom`.

- [ ] **Step 1: Retrieve the password of the `buddybudget` role generated by CNPG**

```bash
kubectl get secret buddybudget-pg-app -n data -o jsonpath='{.data.password}' | base64 -d
```

(The exact Secret name depends on the CNPG convention for the `buddybudget-pg` cluster defined in Phase 4 — check with `kubectl get secrets -n data | grep buddybudget-pg` if `buddybudget-pg-app` does not exist.)

- [ ] **Step 2: Prepare the plain-text file (temporary, never committed)**

In the scratchpad, an `app-secrets.yaml` file:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-env
  namespace: app
type: Opaque
stringData:
  DATABASE_URL: "postgresql://buddybudget:<PASSWORD_DAL_STEP_1>@buddybudget-pg-rw.data.svc.cluster.local:5432/buddybudget?sslmode=disable"
  REDIS_URL: "redis://redis.data.svc.cluster.local:6379"
  BETTER_AUTH_SECRET: "<stesso valore già in uso su Vercel>"
  BETTER_AUTH_URL: "https://app.buddybudget.io"
  APP_URL: "https://app.buddybudget.io"
  GOOGLE_CLIENT_ID: "<stesso valore già in uso su Vercel>"
  GOOGLE_CLIENT_SECRET: "<stesso valore già in uso su Vercel>"
  RESEND_API_KEY: "<stesso valore già in uso su Vercel>"
  RESEND_FROM: "<stesso valore già in uso su Vercel>"
  GOCARDLESS_SECRET_ID: "<stesso valore già in uso su Vercel>"
  GOCARDLESS_SECRET_KEY: "<stesso valore già in uso su Vercel>"
  CRON_SECRET: "<stesso valore già in uso su Vercel>"
```

(The `<…>` placeholders mean "password from Step 1" and "same value already in use on Vercel".) `BETTER_AUTH_URL`/`APP_URL` differ from the Vercel value by design (new domain) — all the others are reused unchanged, so GoCardless/Resend/Google keep recognizing the same credentials (the rotation of all secrets remains planned for the close of Phase 7, not here).

- [ ] **Step 3: Encrypt with SOPS**

```bash
sops --encrypt --age <chiave-pubblica-age-del-progetto> app-secrets.yaml > argocd/manifests/app/app-secrets.enc.yaml
rm app-secrets.yaml
```

- [ ] **Step 4: GitHub PAT for pulling the private image**

The user creates a PAT (classic, scope `read:packages`) on GitHub, pasted only once in the chat to generate the encrypted file:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --namespace app \
  --docker-server=ghcr.io \
  --docker-username=YonderUrik \
  --docker-password=<PAT> \
  --dry-run=client -o yaml > ghcr-pull-secret.yaml
sops --encrypt --age <chiave-pubblica-age-del-progetto> ghcr-pull-secret.yaml > argocd/manifests/app/ghcr-pull-secret.enc.yaml
rm ghcr-pull-secret.yaml
```

- [ ] **Step 5: KSOPS generator + kustomization**

```yaml
# argocd/manifests/app/generator.yaml
apiVersion: viaduct.ai/v1
kind: ksops
metadata:
  name: app-secrets-generator
  annotations:
    config.kubernetes.io/function: |
      exec:
        path: ksops
files:
  - app-secrets.enc.yaml
  - ghcr-pull-secret.enc.yaml
```

```yaml
# argocd/manifests/app/kustomization.yaml
resources:
  - namespace.yaml
  - networkpolicy.yaml
  - quota.yaml
generators:
  - generator.yaml
```

- [ ] **Step 6: Commit, push, verify**

```bash
git add argocd/manifests/app/app-secrets.enc.yaml argocd/manifests/app/ghcr-pull-secret.enc.yaml argocd/manifests/app/generator.yaml argocd/manifests/app/kustomization.yaml
git commit -m "feat: segreti app (env applicativo + pull secret GHCR)"
git push origin main
```

Verification: `kubectl get secret app-env -n app -o jsonpath='{.data.DATABASE_URL}' | base64 -d` shows the expected string (with `?sslmode=disable`); `kubectl get secret ghcr-pull-secret -n app` exists, type `kubernetes.io/dockerconfigjson`.

---

### Task 4: Data migration Neon → CNPG

**Files:** none (terminal operation, no file in the repo).

**Interfaces:**
- Consumes: Neon connection string (current production), CNPG `Service` `buddybudget-pg-rw.data.svc.cluster.local:5432` (from Task 3).
- Produces: `buddybudget` database in CNPG populated with the real data — precondition of Task 5 (the order is binding, see Review Focus).

- [ ] **Step 1: Dump from Neon**

From a terminal with the Neon connection string (never in the chat):

```bash
pg_dump --format=custom --file=buddybudget-neon.dump "$NEON_DATABASE_URL"
```

- [ ] **Step 2: Transfer the dump to the VPS via Tailscale**

```bash
scp buddybudget-neon.dump deploy@<ip-tailscale-vps>:/tmp/
```

- [ ] **Step 3: Restore inside the cluster**

From a temporary pod with a Postgres client (same pattern used for the Phase 4 restore test):

```bash
kubectl run pg-client --rm -it --image=postgres:17 --restart=Never -n data -- bash
# inside the pod:
# (the dump must be made reachable from the pod, e.g. with kubectl cp instead of a direct scp if the pod has no network to the VPS host)
```

```bash
kubectl cp /tmp/buddybudget-neon.dump data/pg-client:/tmp/buddybudget-neon.dump
```

```bash
pg_restore --clean --if-exists --no-owner --role=buddybudget \
  -h buddybudget-pg-rw.data.svc.cluster.local -U buddybudget -d buddybudget \
  /tmp/buddybudget-neon.dump
```

(`--clean --if-exists` so that a later second restore, during the manual verification, overwrites cleanly instead of failing on already existing objects.)

- [ ] **Step 4: Row count check**

For every non-empty table (list from `lib/db/schema/`), compare `SELECT count(*) FROM <tabella>` between Neon and CNPG. Quick example for the main tables:

```sql
SELECT
  (SELECT count(*) FROM auth_user) AS utenti,
  (SELECT count(*) FROM accounts) AS conti,
  (SELECT count(*) FROM transactions) AS transazioni,
  (SELECT count(*) FROM categories) AS categorie;
```

Run both on Neon (`psql "$NEON_DATABASE_URL"`) and on CNPG (`kubectl exec` into the client pod or via port-forward); the numbers must match.

---

### Task 5: App deploy — Deployment, Service, IngressRoute, migration Job

**Files:**
- Create: `argocd/manifests/app/deployment.yaml`
- Create: `argocd/manifests/app/service.yaml`
- Create: `argocd/manifests/app/ingressroute.yaml`
- Create: `argocd/manifests/app/migration-job.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml` (adds the resources + `images:`)

**Interfaces:**
- Consumes: `Secret/app-env`, `Secret/ghcr-pull-secret` (Task 3), populated database (Task 4).
- Produces: `Service/buddy-budget.app.svc.cluster.local:3000` — consumed by the `CronJob`s of Task 6 and by the `IngressRoute`.

- [ ] **Step 1: Migration Job (PreSync hook)**

```yaml
# argocd/manifests/app/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: buddy-budget-migrate
  namespace: app
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      imagePullSecrets:
        - name: ghcr-pull-secret
      containers:
        - name: migrate
          image: ghcr.io/YonderUrik/buddy-budget-migrate:main
          envFrom:
            - secretRef:
                name: app-env
          resources:
            requests: { cpu: 50m, memory: 128Mi }
            limits: { cpu: 300m, memory: 256Mi }
```

- [ ] **Step 2: Deployment + Service**

```yaml
# argocd/manifests/app/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: buddy-budget
  namespace: app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: buddy-budget
  template:
    metadata:
      labels:
        app: buddy-budget
    spec:
      imagePullSecrets:
        - name: ghcr-pull-secret
      containers:
        - name: buddy-budget
          image: ghcr.io/YonderUrik/buddy-budget:main
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: app-env
          readinessProbe:
            httpGet: { path: /api/health/ready, port: 3000 }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 10
            periodSeconds: 20
          resources:
            requests: { cpu: 100m, memory: 200Mi }
            limits: { cpu: 500m, memory: 400Mi }
```

```yaml
# argocd/manifests/app/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: buddy-budget
  namespace: app
spec:
  selector:
    app: buddy-budget
  ports:
    - port: 3000
      targetPort: 3000
```

- [ ] **Step 3: IngressRoute**

```yaml
# argocd/manifests/app/ingressroute.yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: buddy-budget
  namespace: app
spec:
  entryPoints:
    - web
  routes:
    - match: Host(`app.buddybudget.io`)
      kind: Rule
      services:
        - name: buddy-budget
          port: 3000
```

- [ ] **Step 4: Kustomization with the image tag managed by CI**

```yaml
# argocd/manifests/app/kustomization.yaml
resources:
  - namespace.yaml
  - networkpolicy.yaml
  - quota.yaml
  - migration-job.yaml
  - deployment.yaml
  - service.yaml
  - ingressroute.yaml
generators:
  - generator.yaml
images:
  - name: ghcr.io/YonderUrik/buddy-budget
    newTag: main
  - name: ghcr.io/YonderUrik/buddy-budget-migrate
    newTag: main
```

(The `images:` field is what Task 8 will update automatically from CI with `kustomize edit set image`.)

- [ ] **Step 5: DNS + Cloudflare record**

The user creates the DNS record `app.buddybudget.io` on Cloudflare pointing to the tunnel (same pattern as `test.buddybudget.io`/`status.buddybudget.io`, already created in the previous phases) — the cloudflared tunnel already routes by `Host()` to Traefik (catch-all since Phase 5), no change to the tunnel configuration itself.

- [ ] **Step 6: Google OAuth redirect URI**

The user adds in Google Cloud Console → Credentials → the existing OAuth client → Authorized redirect URIs: `https://app.buddybudget.io/api/auth/callback/google` (better-auth builds the redirect from `BETTER_AUTH_URL` on this fixed path).

- [ ] **Step 7: Commit, push, verify**

```bash
git add argocd/manifests/app/deployment.yaml argocd/manifests/app/service.yaml argocd/manifests/app/ingressroute.yaml argocd/manifests/app/migration-job.yaml argocd/manifests/app/kustomization.yaml
git commit -m "feat: deploy app buddy-budget (Deployment 2 repliche, Service, IngressRoute, migration Job PreSync)"
git push origin main
```

Verification: `kubectl get pods -n app` → Job `buddy-budget-migrate-*` completed (`Completed`), 2 `buddy-budget-*` pods `Running` and `Ready`; `curl -I https://app.buddybudget.io/api/health` → `200` from outside the tailnet; login (magic link and Google) working against the real data from Task 4.

---

### Task 6: k8s CronJobs

**Files:**
- Create: `argocd/manifests/app/cronjob-gocardless-sync.yaml`
- Create: `argocd/manifests/app/cronjob-net-worth-snapshot.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml` (adds the resources)

**Interfaces:**
- Consumes: `Service/buddy-budget.app.svc.cluster.local:3000` (Task 5), `Secret/app-env` (key `CRON_SECRET`).
- Produces: nothing consumed by other tasks — final deliverable of the automatic sync.

**Binding precondition:** Task 1 completed and verified (Vercel crons disabled).

- [ ] **Step 1: gocardless-sync CronJob**

```yaml
# argocd/manifests/app/cronjob-gocardless-sync.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: gocardless-sync
  namespace: app
spec:
  schedule: "0 */12 * * *"
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: trigger
              image: curlimages/curl:8.11.1
              env:
                - name: CRON_SECRET
                  valueFrom:
                    secretKeyRef:
                      name: app-env
                      key: CRON_SECRET
              command:
                - sh
                - -c
                - "curl -sf -H \"Authorization: Bearer $CRON_SECRET\" http://buddy-budget.app.svc.cluster.local:3000/api/cron/gocardless-sync"
              resources:
                requests: { cpu: 10m, memory: 16Mi }
                limits: { cpu: 100m, memory: 64Mi }
```

- [ ] **Step 2: net-worth-snapshot CronJob**

```yaml
# argocd/manifests/app/cronjob-net-worth-snapshot.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: net-worth-snapshot
  namespace: app
spec:
  schedule: "50 23 * * *"
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: trigger
              image: curlimages/curl:8.11.1
              env:
                - name: CRON_SECRET
                  valueFrom:
                    secretKeyRef:
                      name: app-env
                      key: CRON_SECRET
              command:
                - sh
                - -c
                - "curl -sf -H \"Authorization: Bearer $CRON_SECRET\" http://buddy-budget.app.svc.cluster.local:3000/api/cron/net-worth-snapshot"
              resources:
                requests: { cpu: 10m, memory: 16Mi }
                limits: { cpu: 100m, memory: 64Mi }
```

- [ ] **Step 3: Add the resources to the kustomization**

```yaml
# argocd/manifests/app/kustomization.yaml — add to the existing resources:
  - cronjob-gocardless-sync.yaml
  - cronjob-net-worth-snapshot.yaml
```

- [ ] **Step 4: Commit, push**

```bash
git add argocd/manifests/app/cronjob-gocardless-sync.yaml argocd/manifests/app/cronjob-net-worth-snapshot.yaml argocd/manifests/app/kustomization.yaml
git commit -m "feat: CronJob k8s gocardless-sync e net-worth-snapshot"
git push origin main
```

- [ ] **Step 5: Verify with a manual run (do not wait for the schedule)**

```bash
kubectl create job --from=cronjob/gocardless-sync gocardless-sync-test -n app
kubectl logs -n app job/gocardless-sync-test
```

Expected: `200` response/JSON body from the route, no network/authorization errors. Repeat for `net-worth-snapshot`. Delete the test Jobs after the verification (`kubectl delete job -n app gocardless-sync-test`).

---

### Task 7: Umami

**Files:**
- Create: `argocd/manifests/cnpg/umami-role-credentials.enc.yaml`
- Modify: `argocd/manifests/cnpg/cluster.yaml` (adds `spec.managed.roles`)
- Modify: `argocd/manifests/cnpg/kustomization.yaml`
- Modify: `argocd/manifests/cnpg/generator.yaml`
- Create: `argocd/manifests/app/umami-database.yaml` (`Database` CRD)
- Create: `argocd/manifests/app/umami-secrets.enc.yaml`
- Create: `argocd/manifests/app/umami-deployment.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml`
- Create: `argocd/manifests/admin-ingress/umami.yaml`
- Modify: `argocd/manifests/admin-ingress/kustomization.yaml`
- Modify: `app/layout.tsx` (app repo — tracking script)

**Interfaces:**
- Consumes: CNPG cluster `buddybudget-pg` (Phase 4), Tailscale Ingress (Phase 3/5 pattern).
- Produces: `Service/umami.app.svc.cluster.local:3000`, dashboard reachable only via Tailscale — no later consumer in this plan.

- [ ] **Step 1: Dedicated Postgres role for Umami**

```bash
# generate a random password
UMAMI_DB_PASSWORD=$(openssl rand -base64 24)
kubectl create secret generic umami-role-credentials -n data \
  --from-literal=password="$UMAMI_DB_PASSWORD" \
  --dry-run=client -o yaml > umami-role-credentials.yaml
sops --encrypt --age <chiave-pubblica-age-del-progetto> umami-role-credentials.yaml > argocd/manifests/cnpg/umami-role-credentials.enc.yaml
rm umami-role-credentials.yaml
```

Keep `$UMAMI_DB_PASSWORD` aside, it is needed in Step 3.

```yaml
# argocd/manifests/cnpg/cluster.yaml — add under spec:
  managed:
    roles:
      - name: umami
        ensure: present
        login: true
        passwordSecret:
          name: umami-role-credentials
```

```yaml
# argocd/manifests/cnpg/generator.yaml — add to files:
  - umami-role-credentials.enc.yaml
```

- [ ] **Step 2: Umami database**

```yaml
# argocd/manifests/app/umami-database.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Database
metadata:
  name: umami
  namespace: data
spec:
  name: umami
  owner: umami
  cluster:
    name: buddybudget-pg
```

- [ ] **Step 3: Umami env Secret**

```bash
cat <<YAML > umami-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: umami-env
  namespace: app
type: Opaque
stringData:
  DATABASE_URL: "postgresql://umami:${UMAMI_DB_PASSWORD}@buddybudget-pg-rw.data.svc.cluster.local:5432/umami"
  APP_SECRET: "$(openssl rand -base64 32)"
YAML
sops --encrypt --age <chiave-pubblica-age-del-progetto> umami-secrets.yaml > argocd/manifests/app/umami-secrets.enc.yaml
rm umami-secrets.yaml
```

Add `umami-secrets.enc.yaml` to the `files` of `argocd/manifests/app/generator.yaml` (Task 3, Step 5).

- [ ] **Step 4: Umami Deployment + Service**

```yaml
# argocd/manifests/app/umami-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: umami
  namespace: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: umami
  template:
    metadata:
      labels:
        app: umami
    spec:
      containers:
        - name: umami
          image: ghcr.io/umami-software/umami:postgresql-latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: umami-env
          resources:
            requests: { cpu: 50m, memory: 128Mi }
            limits: { cpu: 300m, memory: 256Mi }
---
apiVersion: v1
kind: Service
metadata:
  name: umami
  namespace: app
spec:
  selector:
    app: umami
  ports:
    - port: 3000
      targetPort: 3000
```

- [ ] **Step 5: Tailscale Ingress (admin only, not public)**

```yaml
# argocd/manifests/admin-ingress/umami.yaml — exactly the same scheme as grafana.yaml/argocd.yaml:
# spec.tls[0].hosts[0] for the .ts.net device name, never the tailscale.com/hostname annotation.
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: umami-tailscale
  namespace: app
spec:
  ingressClassName: tailscale
  tls:
    - hosts:
        - umami
  defaultBackend:
    service:
      name: umami
      port:
        number: 3000
```

```yaml
# argocd/manifests/admin-ingress/kustomization.yaml — add to resources:
  - umami.yaml
```

- [ ] **Step 6: Add the Umami resources to the app kustomization**

```yaml
# argocd/manifests/app/kustomization.yaml — add to resources:
  - umami-database.yaml
  - umami-deployment.yaml
```

- [ ] **Step 7: Commit, push, verify**

```bash
git add argocd/manifests/cnpg argocd/manifests/app argocd/manifests/admin-ingress
git commit -m "feat: Umami self-hosted (DB dedicato in CNPG, Tailscale Ingress)"
git push origin main
```

Verification: `kubectl get pods -n app -l app=umami` → `Running`; `kubectl get databases.postgresql.cnpg.io -n data` → `umami` in state `applied`; from a device on the tailnet, `https://umami.<tailnet>.ts.net` shows the Umami login screen (default credentials `admin`/`umami` — the user changes them right away at first login).

- [ ] **Step 8: Create the site in Umami and wire the tracking script**

The user creates a "Website" in the Umami dashboard (name `BuddyBudget`, domain `app.buddybudget.io`) and copies the generated `website-id`.

```tsx
// app/layout.tsx — add in the <head>, only if the env vars are present
{process.env.NEXT_PUBLIC_UMAMI_SRC && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
  <script
    defer
    src={process.env.NEXT_PUBLIC_UMAMI_SRC}
    data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
  />
)}
```

`NEXT_PUBLIC_UMAMI_SRC=https://umami.app.svc.cluster.local` is not reachable from the browser (it is a hostname internal to the cluster): a publicly served script is needed instead. The simplest option, consistent with the rest (no new public exposure): add a second route on the existing `buddy-budget` `IngressRoute` (Task 5) that routes `Host(`app.buddybudget.io`) && PathPrefix(`/stats/script.js`)` to `Service/umami`, so the script is served from the same domain as the app without exposing the whole Umami dashboard publicly:

```yaml
# argocd/manifests/app/ingressroute.yaml — add a route:
    - match: Host(`app.buddybudget.io`) && PathPrefix(`/stats/script.js`)
      kind: Rule
      services:
        - name: umami
          port: 3000
```

With `NEXT_PUBLIC_UMAMI_SRC=/stats/script.js` (relative path, no hostname). Add `NEXT_PUBLIC_UMAMI_SRC` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID` to `argocd/manifests/app/app-secrets.enc.yaml` (not sensitive per se, but already inside that Secret for convenience — no new file).

- [ ] **Step 9: Final commit, verify tracking**

```bash
git add argocd/manifests/app/ingressroute.yaml
git commit -m "feat: instrada /stats/script.js verso Umami per servire lo script dallo stesso dominio"
git push origin main
```

Open `https://app.buddybudget.io` from a browser, check in Umami → Realtime that the visit appears.

---

### Task 8: CI step — automatic update of the image tag

**Files:**
- Modify: `.github/workflows/ci.yml` (app repo)

**Interfaces:**
- Consumes: image tag published by the existing `image` job (`ci.yml`, already present).
- Produces: automatic commit on `buddy-budget-infra` that ArgoCD syncs on its own — no later task consumes it directly.

- [ ] **Step 1: Write deploy key**

The user generates a dedicated key pair (`ssh-keygen -t ed25519 -f infra-deploy-key -N ""`), adds the public key as a deploy key **with write permission** on the `buddy-budget-infra` repo (`gh repo deploy-key add infra-deploy-key.pub --repo YonderUrik/buddy-budget-infra --title ci-tag-update --allow-write`), and saves the private key as a secret of the app repo: `gh secret set INFRA_DEPLOY_KEY --repo YonderUrik/buddy-budget < infra-deploy-key`.

- [ ] **Step 2: New job in the workflow**

```yaml
# .github/workflows/ci.yml — add after the `image` job:
  update-infra-tag:
    name: Aggiorna tag immagine nel repo infra
    needs: image
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: YonderUrik/buddy-budget-infra
          ssh-key: ${{ secrets.INFRA_DEPLOY_KEY }}
      - name: Installa kustomize
        run: |
          curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
          sudo mv kustomize /usr/local/bin/
      - name: Aggiorna il tag immagine
        run: |
          cd argocd/manifests/app
          kustomize edit set image \
            ghcr.io/YonderUrik/buddy-budget=ghcr.io/YonderUrik/buddy-budget:sha-${GITHUB_SHA::7} \
            ghcr.io/YonderUrik/buddy-budget-migrate=ghcr.io/YonderUrik/buddy-budget-migrate:sha-${GITHUB_SHA::7}
      - name: Commit e push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add argocd/manifests/app/kustomization.yaml
          git commit -m "chore: aggiorna immagine buddy-budget a sha-${GITHUB_SHA::7}"
          git push
```

- [ ] **Step 3: Commit, push, end-to-end verification**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: CI aggiorna automaticamente il tag immagine nel repo infra"
git push origin main
```

Make a test commit (e.g. a comment in any file) to trigger the whole loop: wait for `ci.yml` to finish, check that `buddy-budget-infra` has a new automatic commit with the correct sha, check in ArgoCD (`kubectl get application app -n argocd -o jsonpath='{.status.sync.status}'` or the UI) that it syncs on its own within a few minutes, and that the `buddy-budget-*` pods are recreated with the new image (`kubectl get pods -n app -o jsonpath='{.items[*].spec.containers[*].image}'`).

---

### Task 9: End-to-end manual user verification

**Files:** none.

**Interfaces:**
- Consumes: everything built in Tasks 1-8.
- Produces: green light to plan Phase 7 (cutover).

- [ ] **Checklist to run on `https://app.buddybudget.io` (real data from Task 4):**
  - Login (magic link + Google) working.
  - Panoramica (Overview): net worth, historical chart, composition.
  - Conti (Accounts): list, balances, manual sync of an Auto account (also check that the `gocardless-sync` CronJob has not already used up the daily budget of the sandbox rate limit).
  - Transazioni (Transactions): list, filters, automatic/manual categorization, donut, 6-month trend.
  - Cash flow: KPIs, income sources, "dove va ogni euro" ("where every euro goes").
  - Categorie (Categories): CRUD, spending groups, color distribution.
  - `/categorizza`: suggestions and batch application.
  - Check that Umami records visits (`Realtime` in the dashboard).
  - Check that the two CronJobs have run at least once on schedule (not just the manual test of Task 6) — check `kubectl get cronjobs -n app` → `LAST SCHEDULE` set after the expected time.

- [ ] **Outcome**: if everything works, Phase 7 (cutover) can be planned. Any bugs must be fixed here (in the infra worktree/branch or in the app code), not deferred to the cutover phase.
