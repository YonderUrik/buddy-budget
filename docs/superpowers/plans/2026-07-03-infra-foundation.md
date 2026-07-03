> **Stato: in pausa (2026-07-03).** Deciso con l'utente di partire prima con il codice applicativo (modello dati / prime schermate) e tornare su questa infra quando ci sarà qualcosa di concreto da deployare. Il piano resta valido così com'è per quando riprenderà.

# Fondamenta infra (Docker + k3s + CI/CD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere l'app Next.js attuale (placeholder) raggiungibile in produzione su un cluster k3s self-hosted, con deploy automatico ad ogni merge su `main`.

**Architecture:** Un solo Deployment k8s nel namespace `production` di un cluster k3s single-VPS (Hetzner). GitHub Actions builda l'immagine Docker, la pubblica su GHCR e aggiorna il Deployment via `kubectl`. Nessun dominio reale ancora disponibile: l'Ingress usa un host placeholder da sostituire quando il dominio sarà pronto; TLS è esplicitamente fuori scope di questo piano.

**Tech Stack:** Next.js standalone output, Docker multi-stage build, Kubernetes (namespace/Deployment/Service/Ingress su Traefik, l'Ingress controller incluso in k3s), GitHub Actions, GHCR.

## Global Constraints

- **L'agente non esegue MAI comandi git in questo repo** (regola di progetto in `CLAUDE.md`), nemmeno `status` o `diff` in sola lettura. Ogni step che normalmente prevede `git add`/`commit`/`push` va invece presentato all'utente come comando esatto da eseguire lui stesso, con richiesta esplicita di conferma prima di procedere al task successivo.
- Package manager: **pnpm** (repo usa `pnpm-lock.yaml`).
- Owner/repo GitHub: **YonderUrik/buddy-budget** → immagine GHCR: `ghcr.io/yonderurik/buddy-budget` (nomi immagine GHCR devono essere minuscoli).
- Namespace k8s unico: **production** (nessuno staging, per decisione in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`).
- Provider VPS: **Hetzner Cloud** (nessuna preferenza espressa, scelto per costo/affidabilità come da spec).
- Nessun dominio reale disponibile: host Ingress placeholder `budget.example.com`, da sostituire in `deploy/k8s/ingress.yaml` quando esisterà un dominio vero. **TLS/cert-manager fuori scope** di questo piano.
- Ambiente di sviluppo corrente: **niente Docker, niente kubectl, niente accesso SSH a un VPS reale**. I task che richiedono queste risorse sono marcati esplicitamente come "Manuale" e vanno eseguiti da chi ha effettivamente accesso a quelle risorse (l'utente, o un operatore con le credenziali), non da un agente in questo ambiente sandboxed.

---

## File Structure

- `next.config.ts` (modifica) — aggiunge `output: "standalone"`, richiesto dal Dockerfile per copiare solo i file necessari a runtime.
- `Dockerfile` (nuovo, root) — build multi-stage (deps → builder → runner) che produce l'immagine di produzione.
- `.dockerignore` (nuovo, root) — esclude `node_modules`, `.next`, `.git`, file `.env*` dal build context.
- `deploy/k8s/namespace.yaml` (nuovo) — namespace `production`.
- `deploy/k8s/deployment.yaml` (nuovo) — Deployment dell'app, 1 replica, probe di readiness/liveness su `/`.
- `deploy/k8s/service.yaml` (nuovo) — Service ClusterIP che espone la porta 3000 del Deployment.
- `deploy/k8s/ingress.yaml` (nuovo) — Ingress Traefik con host placeholder.
- `.github/workflows/deploy.yml` (nuovo) — pipeline CI/CD: build & push immagine su GHCR, poi deploy sul cluster via `kubectl`.

---

### Task 1: Output standalone di Next.js

**Files:**
- Modify: `next.config.ts`
- Test: nessun file di test dedicato — la verifica è l'esito del build.

**Interfaces:**
- Consumes: nessuna dipendenza da task precedenti.
- Produces: dopo `pnpm build`, la cartella `.next/standalone/server.js` esiste — è il file che il Dockerfile (Task 2) copierà nell'immagine finale ed eseguirà con `node server.js`.

- [ ] **Step 1: Aggiungere `output: "standalone"` a `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 2: Buildare e verificare che l'output standalone venga generato**

Run: `pnpm build`
Expected: il comando termina senza errori e stampa un riepilogo delle route (`Route (app) ...`).

- [ ] **Step 3: Verificare che `server.js` sia stato generato**

Run (PowerShell): `Test-Path .next/standalone/server.js`
Expected: `True`

- [ ] **Step 4: Commit (manuale — l'agente non esegue git in questo repo)**

Presenta all'utente questo comando esatto da eseguire lui stesso, poi attendi conferma prima di procedere:

```bash
git add next.config.ts
git commit -m "build: enable Next.js standalone output for Docker"
```

---

### Task 2: Dockerfile multi-stage

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `.next/standalone/server.js` e `.next/static/` prodotti dal Task 1 (`pnpm build` con `output: "standalone"`); `public/` esistente nel repo.
- Produces: un'immagine Docker che espone la porta **3000** e si avvia con `node server.js` — è il contratto che `deploy/k8s/deployment.yaml` (Task 3) assume (`containerPort: 3000`, probe su `/`).

- [ ] **Step 1: Creare `.dockerignore`**

```
node_modules
.next
.git
docs
*.md
.env
.env.*
```

- [ ] **Step 2: Creare `Dockerfile`**

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

- [ ] **Step 3: Verifica locale (solo se Docker è disponibile)**

Questo ambiente di sviluppo non ha Docker installato, quindi questo step non è eseguibile qui. Se lo esegui su una macchina con Docker Desktop:

Run: `docker build -t buddybudget:test .`
Expected: l'ultima riga di output è `naming to docker.io/library/buddybudget:test` (BuildKit) o `Successfully tagged buddybudget:test` (builder classico), senza errori nei passaggi precedenti.

Se non hai Docker in locale, salta questo step: il Dockerfile viene comunque validato realmente nel Task 7, quando la pipeline CI (Task 4) lo builda su un runner GitHub Actions che ha Docker preinstallato.

- [ ] **Step 4: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add Dockerfile .dockerignore
git commit -m "build: add multi-stage Dockerfile for production image"
```

---

### Task 3: Manifest Kubernetes (namespace, Deployment, Service, Ingress)

**Files:**
- Create: `deploy/k8s/namespace.yaml`
- Create: `deploy/k8s/deployment.yaml`
- Create: `deploy/k8s/service.yaml`
- Create: `deploy/k8s/ingress.yaml`

**Interfaces:**
- Consumes: immagine `ghcr.io/yonderurik/buddy-budget:latest` prodotta dalla pipeline (Task 4); porta container 3000 e path di health `/` definiti dal Dockerfile (Task 2).
- Produces: Deployment `buddybudget` e Service `buddybudget` nel namespace `production` — nomi che la pipeline (Task 4) userà in `kubectl set image deployment/buddybudget ...` e in `kubectl apply -f deploy/k8s/`. Secret `ghcr-pull-secret` atteso come riferimento (creato manualmente nel Task 6).

- [ ] **Step 1: Creare `deploy/k8s/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
```

- [ ] **Step 2: Creare `deploy/k8s/deployment.yaml`**

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

- [ ] **Step 3: Creare `deploy/k8s/service.yaml`**

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

- [ ] **Step 4: Creare `deploy/k8s/ingress.yaml`**

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

- [ ] **Step 5: Validare la sintassi YAML di ciascun file**

Run: `pnpm dlx js-yaml deploy/k8s/namespace.yaml`
Expected: stampa JSON `{ "apiVersion": "v1", "kind": "Namespace", ... }` senza errori.

Run: `pnpm dlx js-yaml deploy/k8s/deployment.yaml`
Expected: stampa JSON con `"kind": "Deployment"` senza errori.

Run: `pnpm dlx js-yaml deploy/k8s/service.yaml`
Expected: stampa JSON con `"kind": "Service"` senza errori.

Run: `pnpm dlx js-yaml deploy/k8s/ingress.yaml`
Expected: stampa JSON con `"kind": "Ingress"` senza errori.

- [ ] **Step 6: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add deploy/k8s/
git commit -m "feat: add Kubernetes manifests for production namespace"
```

---

### Task 4: Pipeline GitHub Actions (build → GHCR → deploy)

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `Dockerfile` (Task 2), manifest in `deploy/k8s/` (Task 3), secret repo GitHub `KUBECONFIG` (creato manualmente nel Task 6).
- Produces: ad ogni push su `main`, un'immagine `ghcr.io/yonderurik/buddy-budget:<sha>` e `:latest`, e un rollout del Deployment `buddybudget` nel namespace `production` con l'immagine appena pubblicata.

- [ ] **Step 1: Creare `.github/workflows/deploy.yml`**

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

- [ ] **Step 2: Validare la sintassi YAML del workflow**

Run: `pnpm dlx js-yaml .github/workflows/deploy.yml`
Expected: stampa JSON con `"name": "Deploy"` senza errori.

- [ ] **Step 3: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add build, push and deploy pipeline for production"
```

---

### Task 5 (Manuale — richiede un VPS reale): Provisioning VPS + installazione k3s

Questo task non è eseguibile da un agente in questo ambiente: richiede di creare una risorsa a pagamento reale (VPS Hetzner) e accedervi via SSH. Chi esegue questo task deve avere accesso a un account Hetzner Cloud e a un terminale con SSH.

**Interfaces:**
- Produces: un cluster k3s raggiungibile via SSH, con un file kubeconfig locale che il Task 6 userà per creare i secret e verificare il cluster, e che la pipeline (Task 4) userà per il deploy.

- [ ] **Step 1: Creare il server su Hetzner Cloud**

Nella console Hetzner Cloud (o via `hcloud` CLI se preferisci): crea un server tipo `CX22` (2 vCPU, 4GB RAM — sufficiente per k3s + un'app Next.js in questa fase), immagine `Ubuntu 24.04`, con la tua chiave SSH pubblica associata. Annota l'IP pubblico assegnato (verrà indicato come `<VPS_IP>` nei prossimi step).

- [ ] **Step 2: Installare k3s sul server**

SSH nel server:

```bash
ssh root@<VPS_IP>
curl -sfL https://get.k3s.io | sh -
```

Expected: l'installer termina senza errori e stampa `[INFO]  systemd: Starting k3s`.

- [ ] **Step 3: Verificare che il nodo sia pronto**

Ancora via SSH sul server:

Run: `k3s kubectl get nodes`
Expected: una riga con lo stato `Ready`.

- [ ] **Step 4: Copiare il kubeconfig in locale**

Dal tuo terminale locale (non sul server):

```bash
ssh root@<VPS_IP> cat /etc/rancher/k3s/k3s.yaml > k3s-kubeconfig.yaml
```

Poi modifica `k3s-kubeconfig.yaml` sostituendo `https://127.0.0.1:6443` con `https://<VPS_IP>:6443` (il file usa l'IP locale del server per default, va corretto per essere usabile da fuori).

**Nota di sicurezza**: questo kubeconfig contiene credenziali con accesso amministrativo completo al cluster. Non committarlo mai nel repo — verrà usato solo nel Task 6 per generare il secret GitHub, poi va conservato in un posto sicuro (es. password manager) e cancellato dalla working directory locale.

- [ ] **Step 5: Verificare l'accesso remoto**

Dal tuo terminale locale, con `kubectl` installato:

Run: `kubectl --kubeconfig k3s-kubeconfig.yaml get nodes`
Expected: stessa riga con stato `Ready` vista nello Step 3, questa volta ottenuta da remoto.

---

### Task 6 (Manuale — richiede accesso al cluster e a GitHub): Secret di deploy

**Interfaces:**
- Consumes: `k3s-kubeconfig.yaml` prodotto dal Task 5.
- Produces: secret `ghcr-pull-secret` nel namespace `production` del cluster (che `deploy/k8s/deployment.yaml`, Task 3, referenzia in `imagePullSecrets`), e secret repo GitHub `KUBECONFIG` (che la pipeline, Task 4, legge in `Configure kubeconfig`).

- [ ] **Step 1: Creare un GitHub Personal Access Token per il pull da GHCR**

Su GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens: crea un token con permesso `read:packages` sul repository `YonderUrik/buddy-budget`. Annota il token (verrà indicato come `<GHCR_PAT>` nello step successivo, usato una sola volta).

- [ ] **Step 2: Applicare il namespace e creare il secret `ghcr-pull-secret` sul cluster**

```bash
kubectl --kubeconfig k3s-kubeconfig.yaml apply -f deploy/k8s/namespace.yaml
kubectl --kubeconfig k3s-kubeconfig.yaml create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=YonderUrik \
  --docker-password=<GHCR_PAT> \
  -n production
```

Expected: `secret/ghcr-pull-secret created`.

- [ ] **Step 3: Aggiungere il secret `KUBECONFIG` al repository GitHub**

```bash
base64 -w0 k3s-kubeconfig.yaml
```

Copia l'output. Su GitHub → repository `YonderUrik/buddy-budget` → Settings → Secrets and variables → Actions → New repository secret: nome `KUBECONFIG`, valore l'output copiato.

- [ ] **Step 4: Rimuovere il kubeconfig dalla working directory locale**

```bash
rm k3s-kubeconfig.yaml
```

Da questo punto il kubeconfig vive solo come secret GitHub (usato dalla pipeline) e — se vuoi mantenerne una copia per debug manuale futuro — in un password manager, non su disco in chiaro.

---

### Task 7 (Manuale — trigger reale della pipeline): Primo deploy end-to-end

Questo task richiede di pushare su GitHub, quindi va eseguito dall'utente (l'agente non esegue mai `git push` in questo repo).

- [ ] **Step 1: Pushare i commit dei Task 1-4 su `main`**

A questo punto i Task 1-4 dovrebbero già essere stati committati singolarmente (vedi i loro Step di commit). Presenta all'utente:

```bash
git push origin main
```

- [ ] **Step 2: Osservare l'esecuzione della pipeline**

Su GitHub → repository → tab Actions: verifica che il workflow "Deploy" parta automaticamente e che entrambi i job (`build-and-push`, `deploy`) terminino con stato verde (successo). Se il job `deploy` fallisce su `Configure kubeconfig` o su un errore di connessione, verifica che il secret `KUBECONFIG` (Task 6, Step 3) sia stato salvato correttamente.

- [ ] **Step 3: Verificare che il pod sia in esecuzione**

```bash
kubectl --kubeconfig k3s-kubeconfig.yaml -n production get pods
```

(Se hai già rimosso il file locale come da Task 6 Step 4, puoi rigenerarlo temporaneamente da `ssh root@<VPS_IP> cat /etc/rancher/k3s/k3s.yaml`, oppure eseguire il comando via SSH direttamente sul server con `k3s kubectl -n production get pods`.)

Expected: una riga con `STATUS` = `Running` e `READY` = `1/1`.

- [ ] **Step 4: Verificare che l'app risponda attraverso l'Ingress**

Dato che non esiste ancora un dominio reale puntato al server, verifica il routing Traefik passando l'host placeholder in un header esplicito, contro l'IP pubblico del VPS:

```bash
curl -H "Host: budget.example.com" http://<VPS_IP>/
```

Expected: l'HTML restituito contiene la stringa `Benvenuto in BuddyBudget` (il testo della home page placeholder in `app/page.tsx`).

- [ ] **Step 5: Confermare il completamento**

Se lo Step 4 ha restituito l'HTML atteso, le fondamenta infra sono operative: da questo momento, ogni merge su `main` builda, pubblica e deploya automaticamente. I prossimi piani (Database, Autenticazione, ecc. — vedi `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`) partiranno da questa base.

---

## Fuori scope di questo piano (rimandato consapevolmente)

- **Dominio reale + TLS/cert-manager**: l'Ingress usa un host placeholder; da aggiornare (e aggiungere TLS) quando esisterà un dominio.
- **Staging environment**: solo `production` per ora, come da spec.
- **Postgres, Redis, autenticazione, osservabilità**: oggetto dei piani successivi elencati nello spec di architettura.
- **Rollback automatico o strategie di deploy avanzate (blue/green, canary)**: `kubectl set image` + `rollout status` è sufficiente per un singolo servizio a bassissimo traffico in questa fase.
