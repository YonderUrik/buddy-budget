# Fase 6 — App in parallelo — Runbook

> **Per chi esegue:** questo è un piano in formato runbook guidato, non un piano TDD su codice applicativo — stesso formato delle Fasi 1-5 (`docs/superpowers/plans/2026-09-26-fase-*.md`, `2026-09-27-fase-5-observability.md`), coerente con lo standard esplicito del progetto ("ogni fase diventa un piano in formato runbook guidato", `CLAUDE.md`). Ogni task produce manifest verificabili con `kubectl`/`curl` reali via Tailscale, non test automatici — l'unico task con codice applicativo (Task 7, script Umami) resta comunque minimo e verificato dal vivo. **REQUIRED SUB-SKILL:** superpowers:executing-plans (esecuzione inline in questa sessione, coerente col vincolo di processo dell'utente — le azioni su account/DNS/terminale restano sue, Claude prepara e verifica).

**Goal:** far girare BuddyBudget dentro il cluster k3s su `app.buddybudget.io` con dati reali (dump da Neon), CronJob al posto di Vercel Cron, Umami per l'analytics, e un ciclo CI→GHCR→repo infra→ArgoCD completamente automatico — pronto per la verifica manuale completa prima del cutover (Fase 7).

**Architecture:** nuovo namespace `app` nel repo `buddy-budget-infra` (Deployment 2 repliche + Service + IngressRoute Traefik + Job PreSync migration, gestito da ArgoCD come tutti i componenti dalla Fase 3), dati copiati da Neon a CloudNativePG con `pg_dump`/`pg_restore`, due `CronJob` k8s al posto di Vercel Cron, Umami come secondo Deployment con un DB dedicato nello stesso cluster CNPG (CRD `Database` + ruolo dichiarativo), step aggiuntivo nella CI del repo app che aggiorna il tag immagine nel repo infra via `kustomize edit set image`.

**Tech Stack:** Kubernetes (k3s) via ArgoCD, Kustomize + KSOPS (SOPS/age) per i segreti, CloudNativePG (CRD `Cluster`/`Database`), Traefik `IngressRoute`, GitHub Actions, Docker (immagini già costruite da Fase 0: `buddy-budget` target `runner`, `buddy-budget-migrate` target `migrator`), Umami (immagine ufficiale `ghcr.io/umami-software/umami:postgresql-latest`).

**Spec:** `docs/superpowers/specs/2026-09-27-fase-6-app-parallelo-design.md` (e riferimento `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md`, sezione Fasi riga 6 e architettura riga 53 per il Job PreSync di migration).

## Global Constraints

- Nessuna build sulla VPS: solo immagini già costruite da GitHub Actions (`ghcr.io/YonderUrik/buddy-budget`, `ghcr.io/YonderUrik/buddy-budget-migrate`).
- Tutto dichiarativo e ricostruibile: ogni manifest va nel repo `buddy-budget-infra`, nessun `kubectl apply` manuale fuori da debug temporaneo annotato (principio già scritto nello spec principale).
- Segreti sempre cifrati con SOPS/age nel repo (`*.enc.yaml` + `kustomization.yaml`/`generator.yaml` KSOPS), mai in chiaro nel filesystem più del tempo necessario a cifrarli — stesso schema già usato per R2/tunnel/Slack/Grafana.
- `resources.requests`/`limits` espliciti su ogni container nuovo (regola già in vigore in tutte le fasi precedenti).
- NetworkPolicy: solo regole di `Ingress` esplicite (default-deny + eccezioni mirate) — questo repo non ha mai introdotto regole di `Egress`, si resta coerenti con quella scelta anche qui piuttosto che introdurre un pattern nuovo.
- Cron Vercel disattivati **prima** di attivare i CronJob k8s equivalenti (rate limit GoCardless condiviso ~4 chiamate/giorno/conto — vedi Task 1).
- Dump/restore e creazione di credenziali reali (password DB, PAT GitHub, chiavi Google/GoCardless) restano azioni dell'utente da terminale: Claude prepara i comandi esatti, non li esegue con credenziali proprie.

## Review Focus

- **App non raggiungibile dal Redis/Postgres per un NetworkPolicy dimenticata**: il namespace `data` ha oggi solo `default-deny-ingress` senza eccezioni (commento esplicito nel repo: "l'eccezione si aggiunge insieme a quel namespace" — cioè qui). Se il Task 2 non aggiunge l'`allow-app-to-data`, l'app va in crash loop su `/api/health/ready` con timeout, non un errore ovvio.
- **Migration Job che gira su schema vuoto prima del restore**: se il Task 5 (deploy app + PreSync Job) viene eseguito prima del Task 4 (restore dati), il Job di migration crea da zero le tabelle sulla baseline Drizzle; il successivo `pg_restore` del dump Neon fallirebbe su tabelle già esistenti (o le sovrascriverebbe silenziosamente con `--clean`, perdendo la marcatura "già migrato"). L'ordine Task 4 → Task 5 è vincolante, va rispettato esplicitamente, non solo per numerazione.
- **Google OAuth rotto su `app.buddybudget.io`**: better-auth costruisce il redirect Google da `BETTER_AUTH_URL`; se il redirect URI non è aggiunto in Google Cloud Console, il login Google fallisce con `redirect_uri_mismatch` — non un problema di configurazione k8s, va fatto a mano fuori dal cluster (Task 5).
- **Doppio sync GoCardless per un ordine invertito**: se i CronJob k8s (Task 6) vengono applicati prima di aver disattivato i cron Vercel (Task 1), i due stack sincronizzano lo stesso conto reale in parallelo, il primo run supera il rate limit sandbox e blocca i sync per il resto della giornata su entrambi.
- **DATABASE_URL senza `sslmode` esplicito**: `resolveDbSsl` (`lib/db/ssl.ts`) impone TLS in produzione (`NODE_ENV=production`, già baked nell'immagine `runner`) a meno che l'URL non specifichi `sslmode`; CNPG qui non ha TLS configurato lato client per queste connessioni interne, quindi senza `?sslmode=disable` esplicito l'app non si avvia (connessione rifiutata) — debito già annotato in Fase 0 ("da decidere in Fase 6 con sslmode esplicito nei manifest k8s"), risolto qui nel Task 3.

---

## Ordine dei passi

1. Disattivare i cron Vercel.
2. Namespace `app`: NetworkPolicy + ResourceQuota/LimitRange (senza ancora Deployment/Secret).
3. Segreti app: GHCR pull secret + Secret applicativo (con `DATABASE_URL`/`REDIS_URL` corretti).
4. Migrazione dati Neon → CNPG (dump/restore + verifica conteggio righe).
5. Deploy app (Deployment 2 repliche + Service + IngressRoute + Job PreSync migration) + DNS + redirect Google OAuth.
6. CronJob k8s (`gocardless-sync`, `net-worth-snapshot`).
7. Umami (DB dedicato in CNPG, Deployment, Tailscale Ingress, script di tracking nell'app).
8. Step CI: aggiornamento automatico del tag immagine nel repo infra.
9. Verifica manuale utente end-to-end.

---

### Task 1: Disattivare i cron Vercel

**Files:**
- Modify: `vercel.json` (repo app, ramo `main`)

**Interfaces:**
- Consumes: nessuna.
- Produces: nessun cron attivo lato Vercel da questo punto in poi — precondizione per il Task 6.

- [ ] **Step 1: Rimuovere la sezione `crons`**

Leggere `vercel.json`, rimuovere l'intera chiave `"crons"` (le route `/api/cron/*` restano nel codice, invariate — sono i CronJob k8s del Task 6 a chiamarle da qui in avanti).

- [ ] **Step 2: Commit e push su `main`**

```bash
git add vercel.json
git commit -m "chore: disattiva Vercel Cron, sostituiti dai CronJob k8s (Fase 6)"
git push origin main
```

- [ ] **Step 3: Verifica su Vercel**

L'utente controlla in Vercel → Project → Settings → Cron Jobs che la lista sia vuota dopo il redeploy automatico del push. Confermare esplicitamente prima di passare al Task 6 (non c'è fretta: i Task 2-5 non toccano GoCardless).

---

### Task 2: Namespace `app` — NetworkPolicy e Quota

**Files:**
- Create: `argocd/manifests/app/namespace.yaml` (repo `buddy-budget-infra`)
- Create: `argocd/manifests/app/networkpolicy.yaml`
- Create: `argocd/manifests/app/quota.yaml`
- Create: `argocd/manifests/app/kustomization.yaml`
- Create: `argocd/apps/app.yaml`
- Modify: `argocd/manifests/security/networkpolicy-data.yaml` (aggiunge l'eccezione verso `data`)

**Interfaces:**
- Consumes: nessuna (primo manifest del namespace `app`).
- Produces: namespace `app` esistente con `default-deny-ingress` + eccezione da `ingress` (Traefik); eccezione in `data` che i Task successivi (Secret, Deployment) danno per scontata.

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
# Traefik (namespace ingress) deve poter raggiungere l'app sulla porta 3000.
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
# Margine sopra il budget RAM stimato nello spec principale (300-600Mi per 2 repliche Next.js,
# + Umami nello stesso namespace).
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

- [ ] **Step 2: Application ArgoCD**

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

- [ ] **Step 3: Eccezione NetworkPolicy in `data`**

```yaml
# argocd/manifests/security/networkpolicy-data.yaml — sostituire il contenuto con:
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
# L'app (namespace app) deve poter raggiungere Postgres (5432) e Redis (6379).
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

- [ ] **Step 4: Commit, push, verifica**

```bash
git add argocd/manifests/app argocd/apps/app.yaml argocd/manifests/security/networkpolicy-data.yaml
git commit -m "feat: namespace app (NetworkPolicy + quota) e eccezione verso data"
git push origin main
```

Verifica (via Tailscale): `kubectl get ns app` → esiste; `kubectl get networkpolicy -n app` → 2 policy; `kubectl get networkpolicy -n data` → 2 policy (default-deny + allow-app-to-data).

---

### Task 3: Segreti app

**Files:**
- Create: `argocd/manifests/app/ghcr-pull-secret.enc.yaml`
- Create: `argocd/manifests/app/app-secrets.enc.yaml`
- Create: `argocd/manifests/app/generator.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml` (aggiunge `generators`)

**Interfaces:**
- Consumes: namespace `app` dal Task 2.
- Produces: `Secret/ghcr-pull-secret` (tipo `kubernetes.io/dockerconfigjson`, per l'`imagePullSecrets` del Task 5), `Secret/app-env` con le chiavi `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`, `CRON_SECRET` — nomi identici a `serverEnvSchema` (`lib/env.ts:10-27`), consumati dal Task 5 via `envFrom`.

- [ ] **Step 1: Recuperare la password del ruolo `buddybudget` generata da CNPG**

```bash
kubectl get secret buddybudget-pg-app -n data -o jsonpath='{.data.password}' | base64 -d
```

(Il nome esatto del Secret dipende dalla convenzione CNPG per il cluster `buddybudget-pg` definito in Fase 4 — verificare con `kubectl get secrets -n data | grep buddybudget-pg` se `buddybudget-pg-app` non esiste.)

- [ ] **Step 2: Preparare il file in chiaro (temporaneo, mai committato)**

Nello scratchpad, un file `app-secrets.yaml`:

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

`BETTER_AUTH_URL`/`APP_URL` sono diversi dal valore Vercel per design (nuovo dominio) — tutti gli altri sono riusati identici, così GoCardless/Resend/Google continuano a riconoscere le stesse credenziali (la rotazione di tutti i segreti resta pianificata per la chiusura della Fase 7, non qui).

- [ ] **Step 3: Cifrare con SOPS**

```bash
sops --encrypt --age <chiave-pubblica-age-del-progetto> app-secrets.yaml > argocd/manifests/app/app-secrets.enc.yaml
rm app-secrets.yaml
```

- [ ] **Step 4: PAT GitHub per il pull dell'immagine privata**

L'utente crea un PAT (classic, scope `read:packages`) su GitHub, incollato una sola volta in chat per generare il file cifrato:

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

- [ ] **Step 5: Generator KSOPS + kustomization**

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

- [ ] **Step 6: Commit, push, verifica**

```bash
git add argocd/manifests/app/app-secrets.enc.yaml argocd/manifests/app/ghcr-pull-secret.enc.yaml argocd/manifests/app/generator.yaml argocd/manifests/app/kustomization.yaml
git commit -m "feat: segreti app (env applicativo + pull secret GHCR)"
git push origin main
```

Verifica: `kubectl get secret app-env -n app -o jsonpath='{.data.DATABASE_URL}' | base64 -d` mostra la stringa attesa (con `?sslmode=disable`); `kubectl get secret ghcr-pull-secret -n app` esiste, tipo `kubernetes.io/dockerconfigjson`.

---

### Task 4: Migrazione dati Neon → CNPG

**Files:** nessuno (operazione da terminale, nessun file nel repo).

**Interfaces:**
- Consumes: connection string Neon (produzione attuale), `Service` CNPG `buddybudget-pg-rw.data.svc.cluster.local:5432` (dal Task 3).
- Produces: database `buddybudget` in CNPG popolato con i dati reali — precondizione del Task 5 (l'ordine è vincolante, vedi Review Focus).

- [ ] **Step 1: Dump da Neon**

Da un terminale con la connection string Neon (mai in chat):

```bash
pg_dump --format=custom --file=buddybudget-neon.dump "$NEON_DATABASE_URL"
```

- [ ] **Step 2: Trasferire il dump alla VPS via Tailscale**

```bash
scp buddybudget-neon.dump deploy@<ip-tailscale-vps>:/tmp/
```

- [ ] **Step 3: Restore dentro il cluster**

Da un pod temporaneo con client Postgres (stesso pattern usato per la prova di restore di Fase 4):

```bash
kubectl run pg-client --rm -it --image=postgres:17 --restart=Never -n data -- bash
# dentro il pod:
# (il dump va reso raggiungibile al pod, es. con kubectl cp invece di scp diretto se il pod non ha rete verso la VPS host)
```

```bash
kubectl cp /tmp/buddybudget-neon.dump data/pg-client:/tmp/buddybudget-neon.dump
```

```bash
pg_restore --clean --if-exists --no-owner --role=buddybudget \
  -h buddybudget-pg-rw.data.svc.cluster.local -U buddybudget -d buddybudget \
  /tmp/buddybudget-neon.dump
```

(`--clean --if-exists` così un secondo restore successivo, durante la verifica manuale, sovrascrive pulito invece di fallire su oggetti già esistenti.)

- [ ] **Step 4: Verifica conteggio righe**

Per ogni tabella non vuota (elenco da `lib/db/schema/`), confrontare `SELECT count(*) FROM <tabella>` tra Neon e CNPG. Esempio rapido per le tabelle principali:

```sql
SELECT
  (SELECT count(*) FROM auth_user) AS utenti,
  (SELECT count(*) FROM accounts) AS conti,
  (SELECT count(*) FROM transactions) AS transazioni,
  (SELECT count(*) FROM categories) AS categorie;
```

Eseguita sia su Neon (`psql "$NEON_DATABASE_URL"`) sia su CNPG (`kubectl exec` nel pod client o via port-forward), i numeri devono coincidere.

---

### Task 5: Deploy app — Deployment, Service, IngressRoute, migration Job

**Files:**
- Create: `argocd/manifests/app/deployment.yaml`
- Create: `argocd/manifests/app/service.yaml`
- Create: `argocd/manifests/app/ingressroute.yaml`
- Create: `argocd/manifests/app/migration-job.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml` (aggiunge le risorse + `images:`)

**Interfaces:**
- Consumes: `Secret/app-env`, `Secret/ghcr-pull-secret` (Task 3), database popolato (Task 4).
- Produces: `Service/buddy-budget.app.svc.cluster.local:3000` — consumato dai `CronJob` del Task 6 e dall'`IngressRoute`.

- [ ] **Step 1: Migration Job (hook PreSync)**

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

- [ ] **Step 4: Kustomization con tag immagine gestito da CI**

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

(Il campo `images:` è il punto che il Task 8 aggiornerà automaticamente da CI con `kustomize edit set image`.)

- [ ] **Step 5: DNS + record Cloudflare**

L'utente crea il record DNS `app.buddybudget.io` su Cloudflare puntato al tunnel (stesso pattern di `test.buddybudget.io`/`status.buddybudget.io`, già create nelle fasi precedenti) — il tunnel cloudflared instrada già per `Host()` verso Traefik (catch-all da Fase 5), nessuna modifica alla configurazione del tunnel stesso.

- [ ] **Step 6: Redirect URI Google OAuth**

L'utente aggiunge in Google Cloud Console → Credentials → il client OAuth esistente → Authorized redirect URIs: `https://app.buddybudget.io/api/auth/callback/google` (better-auth costruisce il redirect da `BETTER_AUTH_URL` su questo path fisso).

- [ ] **Step 7: Commit, push, verifica**

```bash
git add argocd/manifests/app/deployment.yaml argocd/manifests/app/service.yaml argocd/manifests/app/ingressroute.yaml argocd/manifests/app/migration-job.yaml argocd/manifests/app/kustomization.yaml
git commit -m "feat: deploy app buddy-budget (Deployment 2 repliche, Service, IngressRoute, migration Job PreSync)"
git push origin main
```

Verifica: `kubectl get pods -n app` → Job `buddy-budget-migrate-*` completato (`Completed`), 2 pod `buddy-budget-*` `Running` e `Ready`; `curl -I https://app.buddybudget.io/api/health` → `200` da fuori la tailnet; login (magic link e Google) funzionante contro i dati reali del Task 4.

---

### Task 6: CronJob k8s

**Files:**
- Create: `argocd/manifests/app/cronjob-gocardless-sync.yaml`
- Create: `argocd/manifests/app/cronjob-net-worth-snapshot.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml` (aggiunge le risorse)

**Interfaces:**
- Consumes: `Service/buddy-budget.app.svc.cluster.local:3000` (Task 5), `Secret/app-env` (chiave `CRON_SECRET`).
- Produces: nessuno consumato da altri task — deliverable terminale della sincronizzazione automatica.

**Precondizione vincolante:** Task 1 completato e verificato (cron Vercel disattivati).

- [ ] **Step 1: CronJob gocardless-sync**

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

- [ ] **Step 2: CronJob net-worth-snapshot**

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

- [ ] **Step 3: Aggiungere le risorse alla kustomization**

```yaml
# argocd/manifests/app/kustomization.yaml — aggiungere alle resources esistenti:
  - cronjob-gocardless-sync.yaml
  - cronjob-net-worth-snapshot.yaml
```

- [ ] **Step 4: Commit, push**

```bash
git add argocd/manifests/app/cronjob-gocardless-sync.yaml argocd/manifests/app/cronjob-net-worth-snapshot.yaml argocd/manifests/app/kustomization.yaml
git commit -m "feat: CronJob k8s gocardless-sync e net-worth-snapshot"
git push origin main
```

- [ ] **Step 5: Verifica con esecuzione manuale (non aspettare lo schedule)**

```bash
kubectl create job --from=cronjob/gocardless-sync gocardless-sync-test -n app
kubectl logs -n app job/gocardless-sync-test
```

Atteso: risposta `200`/corpo JSON dalla route, nessun errore di rete/autorizzazione. Ripetere per `net-worth-snapshot`. Cancellare i Job di test dopo la verifica (`kubectl delete job -n app gocardless-sync-test`).

---

### Task 7: Umami

**Files:**
- Create: `argocd/manifests/cnpg/umami-role-credentials.enc.yaml`
- Modify: `argocd/manifests/cnpg/cluster.yaml` (aggiunge `spec.managed.roles`)
- Modify: `argocd/manifests/cnpg/kustomization.yaml`
- Modify: `argocd/manifests/cnpg/generator.yaml`
- Create: `argocd/manifests/app/umami-database.yaml` (CRD `Database`)
- Create: `argocd/manifests/app/umami-secrets.enc.yaml`
- Create: `argocd/manifests/app/umami-deployment.yaml`
- Modify: `argocd/manifests/app/kustomization.yaml`
- Create: `argocd/manifests/admin-ingress/umami.yaml`
- Modify: `argocd/manifests/admin-ingress/kustomization.yaml`
- Modify: `app/layout.tsx` (repo app — script di tracking)

**Interfaces:**
- Consumes: cluster CNPG `buddybudget-pg` (Fase 4), Tailscale Ingress (pattern Fase 3/5).
- Produces: `Service/umami.app.svc.cluster.local:3000`, dashboard raggiungibile solo via Tailscale — nessun consumatore successivo in questo piano.

- [ ] **Step 1: Ruolo Postgres dedicato per Umami**

```bash
# genera una password casuale
UMAMI_DB_PASSWORD=$(openssl rand -base64 24)
kubectl create secret generic umami-role-credentials -n data \
  --from-literal=password="$UMAMI_DB_PASSWORD" \
  --dry-run=client -o yaml > umami-role-credentials.yaml
sops --encrypt --age <chiave-pubblica-age-del-progetto> umami-role-credentials.yaml > argocd/manifests/cnpg/umami-role-credentials.enc.yaml
rm umami-role-credentials.yaml
```

Annotare `$UMAMI_DB_PASSWORD` da parte, serve al Step 3.

```yaml
# argocd/manifests/cnpg/cluster.yaml — aggiungere sotto spec:
  managed:
    roles:
      - name: umami
        ensure: present
        login: true
        passwordSecret:
          name: umami-role-credentials
```

```yaml
# argocd/manifests/cnpg/generator.yaml — aggiungere ai files:
  - umami-role-credentials.enc.yaml
```

- [ ] **Step 2: Database Umami**

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

- [ ] **Step 3: Secret env Umami**

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

Aggiungere `umami-secrets.enc.yaml` ai `files` di `argocd/manifests/app/generator.yaml` (Task 3, Step 5).

- [ ] **Step 4: Deployment + Service Umami**

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

- [ ] **Step 5: Tailscale Ingress (solo admin, non pubblico)**

```yaml
# argocd/manifests/admin-ingress/umami.yaml — stesso schema esatto di grafana.yaml/argocd.yaml:
# spec.tls[0].hosts[0] per il nome device .ts.net, mai l'annotazione tailscale.com/hostname.
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
# argocd/manifests/admin-ingress/kustomization.yaml — aggiungere alle resources:
  - umami.yaml
```

- [ ] **Step 6: Aggiungere le risorse Umami alla kustomization app**

```yaml
# argocd/manifests/app/kustomization.yaml — aggiungere alle resources:
  - umami-database.yaml
  - umami-deployment.yaml
```

- [ ] **Step 7: Commit, push, verifica**

```bash
git add argocd/manifests/cnpg argocd/manifests/app argocd/manifests/admin-ingress
git commit -m "feat: Umami self-hosted (DB dedicato in CNPG, Tailscale Ingress)"
git push origin main
```

Verifica: `kubectl get pods -n app -l app=umami` → `Running`; `kubectl get databases.postgresql.cnpg.io -n data` → `umami` nello stato `applied`; da un dispositivo sulla tailnet, `https://umami.<tailnet>.ts.net` mostra la schermata di login Umami (credenziali di default `admin`/`umami` — l'utente le cambia subito dal primo login).

- [ ] **Step 8: Creare il sito in Umami e collegare lo script di tracking**

L'utente crea un "Website" nella dashboard Umami (nome `BuddyBudget`, dominio `app.buddybudget.io`), copia lo `website-id` generato.

```tsx
// app/layout.tsx — aggiungere nel <head>, solo se le env sono presenti
{process.env.NEXT_PUBLIC_UMAMI_SRC && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
  <script
    defer
    src={process.env.NEXT_PUBLIC_UMAMI_SRC}
    data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
  />
)}
```

`NEXT_PUBLIC_UMAMI_SRC=https://umami.app.svc.cluster.local` non è raggiungibile dal browser (è un hostname interno al cluster): serve invece uno script servito pubblicamente. Opzione più semplice, coerente col resto (nessuna nuova esposizione pubblica): aggiungere una seconda route sull'`IngressRoute` esistente di `buddy-budget` (Task 5) che instrada `Host(`app.buddybudget.io`) && PathPrefix(`/stats/script.js`)` verso il `Service/umami`, così lo script è servito dallo stesso dominio dell'app senza esporre l'intera dashboard Umami pubblicamente:

```yaml
# argocd/manifests/app/ingressroute.yaml — aggiungere una route:
    - match: Host(`app.buddybudget.io`) && PathPrefix(`/stats/script.js`)
      kind: Rule
      services:
        - name: umami
          port: 3000
```

Con `NEXT_PUBLIC_UMAMI_SRC=/stats/script.js` (path relativo, nessun hostname). Aggiungere `NEXT_PUBLIC_UMAMI_SRC` e `NEXT_PUBLIC_UMAMI_WEBSITE_ID` a `argocd/manifests/app/app-secrets.enc.yaml` (non sensibili in sé, ma già dentro quel Secret per comodità — nessun nuovo file).

- [ ] **Step 9: Commit finale, verifica tracking**

```bash
git add argocd/manifests/app/ingressroute.yaml
git commit -m "feat: instrada /stats/script.js verso Umami per servire lo script dallo stesso dominio"
git push origin main
```

Aprire `https://app.buddybudget.io` da un browser, controllare in Umami → Realtime che la visita compaia.

---

### Task 8: Step CI — aggiornamento automatico del tag immagine

**Files:**
- Modify: `.github/workflows/ci.yml` (repo app)

**Interfaces:**
- Consumes: tag immagine pubblicato dal job `image` esistente (`ci.yml`, già presente).
- Produces: commit automatico su `buddy-budget-infra` che ArgoCD sincronizza da solo — nessun task successivo lo consuma direttamente.

- [ ] **Step 1: Deploy key di scrittura**

L'utente genera una coppia di chiavi dedicata (`ssh-keygen -t ed25519 -f infra-deploy-key -N ""`), aggiunge la pubblica come deploy key **con permesso di scrittura** sul repo `buddy-budget-infra` (`gh repo deploy-key add infra-deploy-key.pub --repo YonderUrik/buddy-budget-infra --title ci-tag-update --allow-write`), e salva la privata come secret del repo app: `gh secret set INFRA_DEPLOY_KEY --repo YonderUrik/buddy-budget < infra-deploy-key`.

- [ ] **Step 2: Nuovo job nel workflow**

```yaml
# .github/workflows/ci.yml — aggiungere dopo il job `image`:
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

- [ ] **Step 3: Commit, push, verifica end-to-end**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: CI aggiorna automaticamente il tag immagine nel repo infra"
git push origin main
```

Fare un commit di prova (es. un commento in un file qualsiasi) per innescare l'intero ciclo: attendere che `ci.yml` finisca, controllare che `buddy-budget-infra` abbia un nuovo commit automatico con lo sha corretto, controllare in ArgoCD (`kubectl get application app -n argocd -o jsonpath='{.status.sync.status}'` o UI) che sincronizzi da solo entro pochi minuti, e che i pod `buddy-budget-*` vengano ricreati con la nuova immagine (`kubectl get pods -n app -o jsonpath='{.items[*].spec.containers[*].image}'`).

---

### Task 9: Verifica manuale utente end-to-end

**Files:** nessuno.

**Interfaces:**
- Consumes: tutto quanto costruito nei Task 1-8.
- Produces: via libera per pianificare la Fase 7 (cutover).

- [ ] **Checklist da eseguire su `https://app.buddybudget.io` (dati reali dal Task 4):**
  - Login (magic link + Google) funzionanti.
  - Panoramica: patrimonio netto, grafico storico, composizione.
  - Conti: elenco, saldi, sync manuale di un conto Auto (verifica anche che il CronJob `gocardless-sync` non abbia già consumato il budget giornaliero del rate limit sandbox).
  - Transazioni: lista, filtri, categorizzazione automatica/manuale, donut, trend 6 mesi.
  - Cash flow: KPI, fonti di entrata, "dove va ogni euro".
  - Categorie: CRUD, gruppi di spesa, distribuzione colori.
  - `/categorizza`: proposte e applicazione batch.
  - Verifica che Umami registri le visite (`Realtime` nella dashboard).
  - Verifica che i due CronJob abbiano girato almeno una volta secondo schedule (non solo il test manuale del Task 6) — controllare `kubectl get cronjobs -n app` → `LAST SCHEDULE` valorizzato dopo l'orario previsto.

- [ ] **Esito**: se tutto funziona, si può procedere a pianificare la Fase 7 (cutover). Eventuali bug vanno corretti qui (nel worktree/branch infra o nel codice app), non rimandati alla fase di cutover.
