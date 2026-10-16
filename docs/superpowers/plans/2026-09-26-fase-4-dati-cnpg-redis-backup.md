# Phase 4 — Data: CloudNativePG + Redis + R2 backups — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` ("Fase 4" row)

**Goal:** Postgres and Redis in the cluster, with continuous, verifiable backups and **a real restore test** before considering the phase closed (explicit criterion of the spec).

## Technical decisions (verified against real docs/issues, not from memory)

- **CloudNativePG** (operator) + **Barman Cloud plugin** (CNPG-I, the modern backup mechanism — the "in-tree" one is deprecated) for backups to R2 (S3-compatible).
- **`cert-manager` is a prerequisite** of the Barman Cloud plugin (it manages the internal gRPC certificates between operator and plugin) — not installed yet, it must be added.
- **R2 has a known S3-compat bug** (checksum `x-amz-content-sha256`, issue [cloudnative-pg/plugin-barman-cloud#411](https://github.com/cloudnative-pg/plugin-barman-cloud/issues/411)): officially documented workaround with two environment variables on the sidecar (`AWS_REQUEST_CHECKSUM_CALCULATION`/`AWS_RESPONSE_CHECKSUM_VALIDATION: when_required`), applied **preventively** from the very first manifest. A second report in the same issue, read in full, turned out to be a **usage error** (restore into a cluster with the same name as the origin, not a real bug) — the correct pattern (restore cluster with a different name, via `externalClusters`) is the one we use here.
- **Redis**: no backup (ephemeral data by design — rate limit, cache, job state), only AOF persistence on a PVC.
- **Managed by ArgoCD** (App-of-Apps, like Traefik): no other bootstrap outside GitOps beyond what was already done in Phase 3. The only real secret (R2 credentials) is encrypted with KSOPS.

## Order of the steps

1. `cert-manager` (Helm, via ArgoCD).
2. CloudNativePG operator (Helm, via ArgoCD).
3. Barman Cloud plugin (official manifest, `kubectl apply` — same namespace as the operator, not managed by ArgoCD for the same reason as ArgoCD/Traefik: it must exist before any `Cluster` with `plugins:` can work).
4. R2 credentials (from Phase 1) → `Secret` encrypted with SOPS, `ObjectStore` towards the `buddybudget-backups` bucket.
5. Postgres `Cluster` (1 instance, WAL archiving active towards R2) + daily `ScheduledBackup`.
6. **Backup check**: on-demand backup, checking that the objects really appear on R2 (not just that the job says "succeeded").
7. **[closing criterion] Real restore test**: I write a test row in the DB, back up, create a **throwaway** restore `Cluster` (different name) from that backup, verify that the row is there, delete the test cluster.
8. Redis (Deployment + AOF PVC, no backup).
9. Default-deny NetworkPolicy + `ResourceQuota`/`LimitRange` for the `data` namespace.

---

### Step 1 — cert-manager

ArgoCD `Application` towards the official Helm chart `jetstack/cert-manager` (namespace `cert-manager`, CRDs included).

**Check:** `kubectl get pods -n cert-manager` all `Running`.

---

### Step 2 — CloudNativePG operator

ArgoCD `Application` towards the official Helm chart `cnpg/cloudnative-pg` (namespace `cnpg-system`).

**Check:** `kubectl get pods -n cnpg-system` `Running`; `kubectl get crd | grep postgresql.cnpg.io`.

---

### Step 3 — Barman Cloud plugin

```
kubectl apply --server-side -n cnpg-system -f https://github.com/cloudnative-pg/plugin-barman-cloud/releases/download/v0.15.0/manifest.yaml
```
(same namespace as the operator, required by the plugin's documentation).

**Check:** plugin pod `Running` in `cnpg-system`.

---

### Step 4 — R2 credentials + ObjectStore

The R2 keys (Access Key ID, Secret Access Key, endpoint) are the ones created in Phase 1 — **I ask you for them in chat only when needed**, use them right away to create the `Secret`, then encrypt them with SOPS before anything touches the repo.

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

**Check:** `kubectl get objectstore -n data`; no errors in the plugin logs.

---

### Step 5 — Postgres cluster

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

**Check:** `kubectl get cluster -n data` → `Cluster in healthy state`; `kubectl get secret buddybudget-pg-app -n data` exists (automatically generated credentials, needed in Phase 6).

---

### Step 6 — Real backup check

```
kubectl cnpg backup -n data buddybudget-pg --method=plugin --plugin-name=barman-cloud.cloudnative-pg.io
```
**Check:** `Backup` status → `completed`; direct check on R2 (via `rclone`/`aws s3 ls` with the same credentials, not just the Kubernetes status) that the objects really exist in the bucket.

---

### Step 7 — Real restore test (closing criterion of the phase)

1. I write a marked row (`INSERT INTO ... VALUES ('fase4-restore-test', ...)`) via `kubectl exec` on `psql`.
2. On-demand backup (as in Step 6).
3. Restore `Cluster`, **different name** (`buddybudget-pg-restore-test`), `bootstrap.recovery` + `externalClusters` towards the same `barmanObjectName`/`serverName: buddybudget-pg`.
4. I wait for it to be `healthy`, query `psql` on the new cluster: the marked row must be there.
5. I delete the test cluster (`kubectl delete cluster buddybudget-pg-restore-test -n data`).

If a step fails because of the known R2 bug (checksum), the Step 4 workaround should already cover it — if it shows up anyway, the specific error is analysed instead of assuming it is the same bug.

---

### Step 8 — Redis

`Deployment` (1 replica) + `PVC` + `ConfigMap` with `appendonly yes`, managed by ArgoCD. No `ObjectStore`/backup: ephemeral data by design.

**Check:** `redis-cli -h ... ping` → `PONG`; restart the pod, the data written before stays (AOF works).

---

### Step 9 — NetworkPolicy + quotas

Same pattern as Phase 3: `default-deny-ingress` on the `data` namespace, **no exceptions yet** (the app that will connect to Postgres/Redis arrives only in Phase 6 — we'll add the exception together with the `app` namespace). `ResourceQuota`/`LimitRange` with a margin above the observed usage of CNPG+Redis.

## End of phase

I update CLAUDE.md, then the plan for **Phase 5** (observability: VictoriaMetrics, Loki, Alloy, Grafana — also exposed via Tailscale Ingress, same pattern as ArgoCD).
