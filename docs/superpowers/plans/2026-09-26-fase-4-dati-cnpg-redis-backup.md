# Fase 4 — Dati: CloudNativePG + Redis + backup R2 — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (riga "Fase 4")

**Obiettivo:** Postgres e Redis nel cluster, con backup continui verificabili e **una prova di restore vera** prima di considerare la fase chiusa (criterio esplicito della spec).

## Decisioni tecniche (verificate su doc/issue reali, non a memoria)

- **CloudNativePG** (operator) + **plugin Barman Cloud** (CNPG-I, il meccanismo di backup moderno — quello "in-tree" è deprecato) per il backup su R2 (S3-compatibile).
- **`cert-manager` è un prerequisito** del plugin Barman Cloud (gestisce i certificati interni gRPC tra operator e plugin) — non ancora installato, va aggiunto.
- **R2 ha un bug S3-compat noto** (checksum `x-amz-content-sha256`, issue [cloudnative-pg/plugin-barman-cloud#411](https://github.com/cloudnative-pg/plugin-barman-cloud/issues/411)): workaround documentato ufficialmente con due variabili d'ambiente sul sidecar (`AWS_REQUEST_CHECKSUM_CALCULATION`/`AWS_RESPONSE_CHECKSUM_VALIDATION: when_required`), applicato **preventivamente** fin dal primo manifest. Un secondo report nello stesso issue, letto per intero, si è rivelato **errore d'uso** (restore in un cluster con lo stesso nome dell'origine, non un bug reale) — il pattern corretto (cluster di restore con nome diverso, via `externalClusters`) è quello che usiamo qui.
- **Redis**: nessun backup (dati effimeri per design — rate limit, cache, stato job), solo persistenza AOF su PVC.
- **Gestito da ArgoCD** (App-of-Apps, come Traefik): nessun altro bootstrap fuori-GitOps oltre a quanto già fatto in Fase 3. L'unico segreto vero (credenziali R2) è cifrato con KSOPS.

## Ordine dei passi

1. `cert-manager` (Helm, via ArgoCD).
2. Operator CloudNativePG (Helm, via ArgoCD).
3. Plugin Barman Cloud (manifest ufficiale, `kubectl apply` — stesso namespace dell'operator, non gestito da ArgoCD per lo stesso motivo di ArgoCD/Traefik: deve esistere prima che qualunque `Cluster` con `plugins:` possa funzionare).
4. Credenziali R2 (dalla Fase 1) → `Secret` cifrato con SOPS, `ObjectStore` verso il bucket `buddybudget-backups`.
5. `Cluster` Postgres (1 istanza, WAL archiving attivo verso R2) + `ScheduledBackup` giornaliero.
6. **Verifica backup**: backup on-demand, controllo che gli oggetti compaiano davvero su R2 (non solo che il job dica "riuscito").
7. **[criterio di chiusura] Prova di restore vera**: scrivo una riga di test nel DB, backup, creo un `Cluster` di restore **usa-e-getta** (nome diverso) da quel backup, verifico che la riga ci sia, elimino il cluster di prova.
8. Redis (Deployment + PVC AOF, nessun backup).
9. NetworkPolicy default-deny + `ResourceQuota`/`LimitRange` per il namespace `data`.

---

### Passo 1 — cert-manager

`Application` ArgoCD verso il chart Helm ufficiale `jetstack/cert-manager` (namespace `cert-manager`, CRD incluse).

**Verifica:** `kubectl get pods -n cert-manager` tutti `Running`.

---

### Passo 2 — Operator CloudNativePG

`Application` ArgoCD verso il chart Helm ufficiale `cnpg/cloudnative-pg` (namespace `cnpg-system`).

**Verifica:** `kubectl get pods -n cnpg-system` `Running`; `kubectl get crd | grep postgresql.cnpg.io`.

---

### Passo 3 — Plugin Barman Cloud

```
kubectl apply --server-side -n cnpg-system -f https://github.com/cloudnative-pg/plugin-barman-cloud/releases/download/v0.15.0/manifest.yaml
```
(stesso namespace dell'operator, richiesto dalla documentazione del plugin).

**Verifica:** pod del plugin `Running` in `cnpg-system`.

---

### Passo 4 — Credenziali R2 + ObjectStore

Le chiavi R2 (Access Key ID, Secret Access Key, endpoint) sono quelle create in Fase 1 — **le recupero da te in chat solo quando servono**, le uso subito per creare il `Secret`, poi le cifro con SOPS prima che qualunque cosa tocchi il repo.

```yaml
apiVersion: barmancloud.cnpg.io/v1
kind: ObjectStore
metadata:
  name: r2-backups
  namespace: data
spec:
  configuration:
    destinationPath: "s3://buddybudget-backups/"
    endpointURL: "https://<account-id>.r2.cloudflarestorage.com"
    s3Credentials:
      accessKeyId: { name: r2-credentials, key: ACCESS_KEY_ID }
      secretAccessKey: { name: r2-credentials, key: ACCESS_SECRET_KEY }
    wal:
      compression: gzip
  instanceSidecarConfiguration:
    env:
      - name: AWS_REQUEST_CHECKSUM_CALCULATION
        value: when_required
      - name: AWS_RESPONSE_CHECKSUM_VALIDATION
        value: when_required
```

**Verifica:** `kubectl get objectstore -n data`; nessun errore nei log del plugin.

---

### Passo 5 — Cluster Postgres

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: buddybudget-pg
  namespace: data
spec:
  instances: 1
  imageName: ghcr.io/cloudnative-pg/postgresql:17
  storage:
    size: 10Gi
  plugins:
    - name: barman-cloud.cloudnative-pg.io
      isWALArchiver: true
      parameters:
        barmanObjectName: r2-backups
  bootstrap:
    initdb:
      database: buddybudget
      owner: buddybudget
---
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: buddybudget-pg-daily
  namespace: data
spec:
  schedule: "0 2 * * *"
  backupOwnerReference: self
  cluster:
    name: buddybudget-pg
  method: plugin
  pluginConfiguration:
    name: barman-cloud.cloudnative-pg.io
```

**Verifica:** `kubectl get cluster -n data` → `Cluster in healthy state`; `kubectl get secret buddybudget-pg-app -n data` esiste (credenziali generate automaticamente, servirà a Fase 6).

---

### Passo 6 — Verifica backup reale

```
kubectl cnpg backup -n data buddybudget-pg --method=plugin --plugin-name=barman-cloud.cloudnative-pg.io
```
**Verifica:** stato del `Backup` → `completed`; controllo diretto su R2 (via `rclone`/`aws s3 ls` con le stesse credenziali, non solo lo stato di Kubernetes) che gli oggetti esistano davvero nel bucket.

---

### Passo 7 — Prova di restore vera (criterio di chiusura della fase)

1. Scrivo una riga marcata (`INSERT INTO ... VALUES ('fase4-restore-test', ...)`) via `kubectl exec` su `psql`.
2. Backup on-demand (come Passo 6).
3. `Cluster` di restore, **nome diverso** (`buddybudget-pg-restore-test`), `bootstrap.recovery` + `externalClusters` verso lo stesso `barmanObjectName`/`serverName: buddybudget-pg`.
4. Attendo che sia `healthy`, interrogo `psql` sul nuovo cluster: la riga marcata deve esserci.
5. Elimino il cluster di prova (`kubectl delete cluster buddybudget-pg-restore-test -n data`).

Se un passaggio fallisce per il bug noto R2 (checksum), il workaround del Passo 4 dovrebbe già coprirlo — se comparisse comunque, si analizza l'errore specifico invece di assumere sia lo stesso bug.

---

### Passo 8 — Redis

`Deployment` (1 replica) + `PVC` + `ConfigMap` con `appendonly yes`, gestito da ArgoCD. Nessun `ObjectStore`/backup: dati effimeri per design.

**Verifica:** `redis-cli -h ... ping` → `PONG`; riavvio del pod, i dati scritti prima restano (AOF funziona).

---

### Passo 9 — NetworkPolicy + quote

Stesso schema delle Fasi 3: `default-deny-ingress` sul namespace `data`, **nessuna eccezione ancora** (l'app che si collegherà a Postgres/Redis arriva solo in Fase 6 — l'eccezione la aggiungeremo insieme al namespace `app`). `ResourceQuota`/`LimitRange` con margine sopra l'uso osservato di CNPG+Redis.

## Fine fase

Aggiorno CLAUDE.md, poi piano della **Fase 5** (observability: VictoriaMetrics, Loki, Alloy, Grafana — esposta anch'essa via Tailscale Ingress, stesso schema di ArgoCD).
