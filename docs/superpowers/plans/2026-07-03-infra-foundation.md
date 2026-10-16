> **Status: paused (2026-07-03).** Decided with the user to start with the application code first (data model / first screens) and come back to this infra when there is something concrete to deploy. The plan remains valid as is for when it resumes.

# Infra foundations (Docker + k3s + CI/CD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current (placeholder) Next.js app reachable in production on a self-hosted k3s cluster, with automatic deploy on every merge to `main`.

**Architecture:** A single k8s Deployment in the `production` namespace of a single-VPS k3s cluster (Hetzner). GitHub Actions builds the Docker image, publishes it to GHCR and updates the Deployment via `kubectl`. No real domain available yet: the Ingress uses a placeholder host to be replaced when the domain is ready; TLS is explicitly out of scope for this plan.

**Tech Stack:** Next.js standalone output, Docker multi-stage build, Kubernetes (namespace/Deployment/Service/Ingress on Traefik, the Ingress controller bundled with k3s), GitHub Actions, GHCR.

## Global Constraints

- **The agent NEVER runs git commands in this repo** (project rule in `CLAUDE.md`), not even read-only `status` or `diff`. Every step that would normally involve `git add`/`commit`/`push` must instead be presented to the user as the exact command to run themselves, with an explicit request for confirmation before moving on to the next task.
- Package manager: **pnpm** (the repo uses `pnpm-lock.yaml`).
- GitHub owner/repo: **YonderUrik/buddy-budget** → GHCR image: `ghcr.io/yonderurik/buddy-budget` (GHCR image names must be lowercase).
- Single k8s namespace: **production** (no staging, per the decision in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`).
- VPS provider: **Hetzner Cloud** (no preference expressed, chosen for cost/reliability as per the spec).
- No real domain available: placeholder Ingress host `budget.example.com`, to be replaced in `deploy/k8s/ingress.yaml` when a real domain exists. **TLS/cert-manager out of scope** for this plan.
- Current development environment: **no Docker, no kubectl, no SSH access to a real VPS**. Tasks that need these resources are explicitly marked as "Manual" and must be run by whoever actually has access to those resources (the user, or an operator with the credentials), not by an agent in this sandboxed environment.

---

## File Structure

- `next.config.ts` (modify) — adds `output: "standalone"`, required by the Dockerfile to copy only the files needed at runtime.
- `Dockerfile` (new, root) — multi-stage build (deps → builder → runner) that produces the production image.
- `.dockerignore` (new, root) — excludes `node_modules`, `.next`, `.git`, `.env*` files from the build context.
- `deploy/k8s/namespace.yaml` (new) — `production` namespace.
- `deploy/k8s/deployment.yaml` (new) — app Deployment, 1 replica, readiness/liveness probes on `/`.
- `deploy/k8s/service.yaml` (new) — ClusterIP Service exposing the Deployment's port 3000.
- `deploy/k8s/ingress.yaml` (new) — Traefik Ingress with a placeholder host.
- `.github/workflows/deploy.yml` (new) — CI/CD pipeline: build & push the image to GHCR, then deploy to the cluster via `kubectl`.

---

### Task 1: Next.js standalone output

**Files:**
- Modify: `next.config.ts`
- Test: no dedicated test file — the check is the build outcome.

**Interfaces:**
- Consumes: no dependency on previous tasks.
- Produces: after `pnpm build`, `.next/standalone/server.js` exists — it is the file the Dockerfile (Task 2) will copy into the final image and run with `node server.js`.

- [ ] **Step 1: Add `output: "standalone"` to `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 2: Build and verify that the standalone output is generated**

Run: `pnpm build`
Expected: the command finishes without errors and prints a summary of the routes (`Route (app) ...`).

- [ ] **Step 3: Verify that `server.js` was generated**

Run (PowerShell): `Test-Path .next/standalone/server.js`
Expected: `True`

- [ ] **Step 4: Commit (manual — the agent does not run git in this repo)**

Present the user with this exact command to run themselves, then wait for confirmation before proceeding:

```bash
git add next.config.ts
git commit -m "build: enable Next.js standalone output for Docker"
```

---

### Task 2: Multi-stage Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `.next/standalone/server.js` and `.next/static/` produced by Task 1 (`pnpm build` with `output: "standalone"`); `public/` already in the repo.
- Produces: a Docker image that exposes port **3000** and starts with `node server.js` — this is the contract `deploy/k8s/deployment.yaml` (Task 3) assumes (`containerPort: 3000`, probes on `/`).

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
docs
*.md
.env
.env.*
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 3: Local check (only if Docker is available)**

This development environment does not have Docker installed, so this step cannot be run here. If you run it on a machine with Docker Desktop:

Run: `docker build -t buddybudget:test .`
Expected: the last output line is `naming to docker.io/library/buddybudget:test` (BuildKit) or `Successfully tagged buddybudget:test` (classic builder), with no errors in the previous steps.

If you do not have Docker locally, skip this step: the Dockerfile is validated for real anyway in Task 7, when the CI pipeline (Task 4) builds it on a GitHub Actions runner that has Docker preinstalled.

- [ ] **Step 4: Commit (manual — the agent does not run git in this repo)**

```bash
git add Dockerfile .dockerignore
git commit -m "build: add multi-stage Dockerfile for production image"
```

---

### Task 3: Kubernetes manifests (namespace, Deployment, Service, Ingress)

**Files:**
- Create: `deploy/k8s/namespace.yaml`
- Create: `deploy/k8s/deployment.yaml`
- Create: `deploy/k8s/service.yaml`
- Create: `deploy/k8s/ingress.yaml`

**Interfaces:**
- Consumes: image `ghcr.io/yonderurik/buddy-budget:latest` produced by the pipeline (Task 4); container port 3000 and health path `/` defined by the Dockerfile (Task 2).
- Produces: Deployment `buddybudget` and Service `buddybudget` in the `production` namespace — names the pipeline (Task 4) will use in `kubectl set image deployment/buddybudget ...` and in `kubectl apply -f deploy/k8s/`. Secret `ghcr-pull-secret` expected as a reference (created manually in Task 6).

- [ ] **Step 1: Create `deploy/k8s/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
```

- [ ] **Step 2: Create `deploy/k8s/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: buddybudget
  namespace: production
  labels:
    app: buddybudget
spec:
  replicas: 1
  selector:
    matchLabels:
      app: buddybudget
  template:
    metadata:
      labels:
        app: buddybudget
    spec:
      imagePullSecrets:
        - name: ghcr-pull-secret
      containers:
        - name: buddybudget
          image: ghcr.io/yonderurik/buddy-budget:latest
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

- [ ] **Step 3: Create `deploy/k8s/service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: buddybudget
  namespace: production
spec:
  selector:
    app: buddybudget
  ports:
    - port: 3000
      targetPort: 3000
```

- [ ] **Step 4: Create `deploy/k8s/ingress.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: buddybudget
  namespace: production
spec:
  ingressClassName: traefik
  rules:
    - host: budget.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: buddybudget
                port:
                  number: 3000
```

- [ ] **Step 5: Validate the YAML syntax of each file**

Run: `pnpm dlx js-yaml deploy/k8s/namespace.yaml`
Expected: prints JSON `{ "apiVersion": "v1", "kind": "Namespace", ... }` with no errors.

Run: `pnpm dlx js-yaml deploy/k8s/deployment.yaml`
Expected: prints JSON with `"kind": "Deployment"` with no errors.

Run: `pnpm dlx js-yaml deploy/k8s/service.yaml`
Expected: prints JSON with `"kind": "Service"` with no errors.

Run: `pnpm dlx js-yaml deploy/k8s/ingress.yaml`
Expected: prints JSON with `"kind": "Ingress"` with no errors.

- [ ] **Step 6: Commit (manual — the agent does not run git in this repo)**

```bash
git add deploy/k8s/
git commit -m "feat: add Kubernetes manifests for production namespace"
```

---

### Task 4: GitHub Actions pipeline (build → GHCR → deploy)

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `Dockerfile` (Task 2), manifests in `deploy/k8s/` (Task 3), GitHub repo secret `KUBECONFIG` (created manually in Task 6).
- Produces: on every push to `main`, an image `ghcr.io/yonderurik/buddy-budget:<sha>` and `:latest`, and a rollout of the `buddybudget` Deployment in the `production` namespace with the freshly published image.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  IMAGE_NAME: yonderurik/buddy-budget

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.build.outputs.image }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        id: build
        run: |
          IMAGE="ghcr.io/${{ env.IMAGE_NAME }}:${{ github.sha }}"
          docker build -t "$IMAGE" -t "ghcr.io/${{ env.IMAGE_NAME }}:latest" .
          docker push "$IMAGE"
          docker push "ghcr.io/${{ env.IMAGE_NAME }}:latest"
          echo "image=$IMAGE" >> "$GITHUB_OUTPUT"

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up kubectl
        uses: azure/setup-kubectl@v4
        with:
          version: "v1.31.0"

      - name: Configure kubeconfig
        run: |
          mkdir -p "$HOME/.kube"
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > "$HOME/.kube/config"

      - name: Apply manifests
        run: |
          kubectl apply -f deploy/k8s/namespace.yaml
          kubectl apply -f deploy/k8s/deployment.yaml
          kubectl apply -f deploy/k8s/service.yaml
          kubectl apply -f deploy/k8s/ingress.yaml

      - name: Roll out new image
        run: |
          kubectl -n production set image deployment/buddybudget buddybudget=${{ needs.build-and-push.outputs.image }}
          kubectl -n production rollout status deployment/buddybudget --timeout=120s
```

- [ ] **Step 2: Validate the workflow's YAML syntax**

Run: `pnpm dlx js-yaml .github/workflows/deploy.yml`
Expected: prints JSON with `"name": "Deploy"` with no errors.

- [ ] **Step 3: Commit (manual — the agent does not run git in this repo)**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add build, push and deploy pipeline for production"
```

---

### Task 5 (Manual — requires a real VPS): VPS provisioning + k3s installation

This task cannot be run by an agent in this environment: it requires creating a real paid resource (Hetzner VPS) and accessing it via SSH. Whoever runs this task must have access to a Hetzner Cloud account and a terminal with SSH.

**Interfaces:**
- Produces: a k3s cluster reachable via SSH, with a local kubeconfig file that Task 6 will use to create the secrets and check the cluster, and that the pipeline (Task 4) will use to deploy.

- [ ] **Step 1: Create the server on Hetzner Cloud**

In the Hetzner Cloud console (or via the `hcloud` CLI if you prefer): create a `CX22` server (2 vCPU, 4GB RAM — enough for k3s + a Next.js app at this stage), image `Ubuntu 24.04`, with your public SSH key attached. Note the assigned public IP (it will be referred to as `<VPS_IP>` in the next steps).

- [ ] **Step 2: Install k3s on the server**

SSH into the server:

```bash
ssh root@<VPS_IP>
curl -sfL https://get.k3s.io | sh -
```

Expected: the installer finishes without errors and prints `[INFO]  systemd: Starting k3s`.

- [ ] **Step 3: Verify that the node is ready**

Still via SSH on the server:

Run: `k3s kubectl get nodes`
Expected: one line with status `Ready`.

- [ ] **Step 4: Copy the kubeconfig locally**

From your local terminal (not on the server):

```bash
ssh root@<VPS_IP> cat /etc/rancher/k3s/k3s.yaml > k3s-kubeconfig.yaml
```

Then edit `k3s-kubeconfig.yaml`, replacing `https://127.0.0.1:6443` with `https://<VPS_IP>:6443` (by default the file uses the server's local IP; it must be corrected to be usable from outside).

**Security note**: this kubeconfig contains credentials with full administrative access to the cluster. Never commit it to the repo — it will only be used in Task 6 to generate the GitHub secret, then it must be kept somewhere safe (e.g. a password manager) and deleted from the local working directory.

- [ ] **Step 5: Verify remote access**

From your local terminal, with `kubectl` installed:

Run: `kubectl --kubeconfig k3s-kubeconfig.yaml get nodes`
Expected: the same line with status `Ready` seen in Step 3, this time obtained remotely.

---

### Task 6 (Manual — requires access to the cluster and to GitHub): Deploy secrets

**Interfaces:**
- Consumes: `k3s-kubeconfig.yaml` produced by Task 5.
- Produces: secret `ghcr-pull-secret` in the cluster's `production` namespace (which `deploy/k8s/deployment.yaml`, Task 3, references in `imagePullSecrets`), and GitHub repo secret `KUBECONFIG` (which the pipeline, Task 4, reads in `Configure kubeconfig`).

- [ ] **Step 1: Create a GitHub Personal Access Token for pulling from GHCR**

On GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens: create a token with the `read:packages` permission on the `YonderUrik/buddy-budget` repository. Note the token (it will be referred to as `<GHCR_PAT>` in the next step, used only once).

- [ ] **Step 2: Apply the namespace and create the `ghcr-pull-secret` secret on the cluster**

```bash
kubectl --kubeconfig k3s-kubeconfig.yaml apply -f deploy/k8s/namespace.yaml
kubectl --kubeconfig k3s-kubeconfig.yaml create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=YonderUrik \
  --docker-password=<GHCR_PAT> \
  -n production
```

Expected: `secret/ghcr-pull-secret created`.

- [ ] **Step 3: Add the `KUBECONFIG` secret to the GitHub repository**

```bash
base64 -w0 k3s-kubeconfig.yaml
```

Copy the output. On GitHub → repository `YonderUrik/buddy-budget` → Settings → Secrets and variables → Actions → New repository secret: name `KUBECONFIG`, value the copied output.

- [ ] **Step 4: Remove the kubeconfig from the local working directory**

```bash
rm k3s-kubeconfig.yaml
```

From this point on the kubeconfig lives only as a GitHub secret (used by the pipeline) and — if you want to keep a copy for future manual debugging — in a password manager, not on disk in plaintext.

---

### Task 7 (Manual — real pipeline trigger): First end-to-end deploy

This task requires pushing to GitHub, so it must be run by the user (the agent never runs `git push` in this repo).

- [ ] **Step 1: Push the commits of Tasks 1-4 to `main`**

At this point Tasks 1-4 should already have been committed individually (see their commit Steps). Present to the user:

```bash
git push origin main
```

- [ ] **Step 2: Watch the pipeline run**

On GitHub → repository → Actions tab: check that the "Deploy" workflow starts automatically and that both jobs (`build-and-push`, `deploy`) finish green (success). If the `deploy` job fails on `Configure kubeconfig` or on a connection error, check that the `KUBECONFIG` secret (Task 6, Step 3) was saved correctly.

- [ ] **Step 3: Verify that the pod is running**

```bash
kubectl --kubeconfig k3s-kubeconfig.yaml -n production get pods
```

(If you already removed the local file as per Task 6 Step 4, you can temporarily regenerate it from `ssh root@<VPS_IP> cat /etc/rancher/k3s/k3s.yaml`, or run the command via SSH directly on the server with `k3s kubectl -n production get pods`.)

Expected: one line with `STATUS` = `Running` and `READY` = `1/1`.

- [ ] **Step 4: Verify that the app responds through the Ingress**

Since there is no real domain pointing at the server yet, verify Traefik routing by passing the placeholder host in an explicit header, against the VPS public IP:

```bash
curl -H "Host: budget.example.com" http://<VPS_IP>/
```

Expected: the returned HTML contains the string `Benvenuto in BuddyBudget` (the text of the placeholder home page in `app/page.tsx`).

- [ ] **Step 5: Confirm completion**

If Step 4 returned the expected HTML, the infra foundations are operational: from now on, every merge to `main` builds, publishes and deploys automatically. The next plans (Database, Authentication, etc. — see `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`) will start from this base.

---

## Out of scope for this plan (consciously deferred)

- **Real domain + TLS/cert-manager**: the Ingress uses a placeholder host; to be updated (and TLS added) when a domain exists.
- **Staging environment**: only `production` for now, as per the spec.
- **Postgres, Redis, authentication, observability**: subject of the later plans listed in the architecture spec.
- **Automatic rollback or advanced deploy strategies (blue/green, canary)**: `kubectl set image` + `rollout status` is enough for a single very-low-traffic service at this stage.
