# Phase 5 — Observability: VictoriaMetrics + Loki + Alloy + Grafana — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` ("Fase 5" row, updated on 2026-09-27: Slack instead of Telegram)

**Goal:** cluster metrics and logs in Grafana (VictoriaMetrics as TSDB, Loki for logs, Alloy as the collection agent), working Slack alerting and an external uptime check. **Explicit closing criterion from the spec**: a test alert (crashing pod) reaches Slack; the external check reports a simulated shutdown.

## Technical decisions (verified against real docs/repos, not from memory)

- **VictoriaMetrics single** (`victoria-metrics-single`, Helm repo `https://victoriametrics.github.io/helm-charts/`) instead of Prometheus: same scrape/remote-write protocol, a fraction of the RAM — consistent with the spec's existing choice to discard `kube-prometheus-stack`.
- **kube-state-metrics** + **prometheus-node-exporter** (Helm repo `https://prometheus-community.github.io/helm-charts`) are still needed with VictoriaMetrics: they are the exporters of cluster metrics (pod/node state), VictoriaMetrics is only the storage — neither is included in the `victoria-metrics-single` chart.
- **Grafana Alloy** (successor of Grafana Agent, Helm repo `https://grafana.github.io/helm-charts`) as the single collection agent for metrics (scrape + `prometheus.remote_write` to VictoriaMetrics) and logs (`loki.source.kubernetes` + `loki.write` to Loki) — one DaemonSet instead of two separate agents, to stay within the spec's RAM budget (~700MB-1GB for the whole observability namespace).
- **Loki in Monolithic/filesystem mode** (same chart, the historical name `SingleBinary` is deprecated but still accepted), storage on PVC — no S3 object storage for logs: unlike Postgres, no PITR is needed, and keeping it simple reduces RAM/complexity. No backup (same criterion already used for Redis in Phase 4: operational data, not system data).
- **cAdvisor/per-pod container metrics**: deferred. The phase's closing criterion only requires an alert on a crashing pod (from `kube-state-metrics`, which already exposes it) and an uptime check — it does not require per-container CPU/RAM dashboards. Adding it later, if needed, is just one more Alloy configuration block, not an architecture change.
- **Grafana**: alerting provisioned via file (`values.yaml` → `alerting` section, pattern documented by Grafana for Helm — Slack contact point + notification policy + test rule), not by hand from the UI, to stay consistent with the spec's "everything declarative and rebuildable" principle.
- **Slack**: incoming webhook created by the user (same scheme already used for R2/tunnel — the real credential passes through the chat only to create it, then it is encrypted with SOPS and never again in plain text). No bot/commands from Slack to the cluster (decided on 2026-09-27, see "Rimandato consapevolmente" (consciously deferred) in the spec: notifications only, not ChatOps).
- **Grafana exposure**: Tailscale Ingress, same pattern as ArgoCD in Phase 3 (`spec.tls[0].hosts[0]` for the device name, **not** the `tailscale.com/hostname` annotation nor `spec.rules[].host` — a mistake already made and fixed in that phase).
- **External uptime check**: a real public endpoint to monitor is needed, but the app is not yet on the VPS (it arrives in Phase 6) — a minimal endpoint is recreated (`whoami`, same pattern as the `demo` namespace from Phase 3, already removed at the end of that phase) behind a dedicated subdomain, only to test the external alerting pipeline. It will be replaced by the app's real `/api/health` in Phase 6.
- **Managed by ArgoCD** (App-of-Apps, like all components from Phase 3 onward): one file in `argocd/apps/` per component, manifests in `argocd/manifests/<nome>/`.

## Order of steps

1. `kube-state-metrics` + `prometheus-node-exporter` (Helm, via ArgoCD).
2. VictoriaMetrics single (Helm, via ArgoCD).
3. Loki monolithic/filesystem (Helm, via ArgoCD).
4. Grafana Alloy (Helm, via ArgoCD) — River config: scrape kube-state-metrics/node-exporter → remote_write VictoriaMetrics; pod logs → Loki.
5. Grafana admin credentials + Slack webhook → `Secret`s encrypted with SOPS.
6. Grafana (Helm, via ArgoCD) — VictoriaMetrics + Loki datasources, Slack alerting provisioned via file, exposed via Tailscale Ingress.
7. **Verification**: real metrics and logs visible in Grafana (direct queries, not just dashboards).
8. **[closing criterion, part 1] Test alert**: deliberate pod in CrashLoopBackOff → alert reaches Slack.
9. **[closing criterion, part 2] External uptime check**: public test endpoint + the user's UptimeRobot/Healthchecks.io account → simulated shutdown detected.
10. Default-deny NetworkPolicy + `ResourceQuota`/`LimitRange` for the `observability` namespace.

---

### Step 1 — kube-state-metrics + node-exporter

Two separate ArgoCD `Application`s pointing to the official charts `prometheus-community/kube-state-metrics` and `prometheus-community/prometheus-node-exporter`, namespace `observability`. `prometheus-node-exporter` is a DaemonSet: on a single node, a single pod.

**Verification:** `kubectl get pods -n observability` both `Running`; `kubectl get svc -n observability` shows `kube-state-metrics:8080` and `prometheus-node-exporter:9100`.

---

### Step 2 — VictoriaMetrics single

ArgoCD `Application` pointing to the `victoria-metrics-single` chart (repo `https://victoriametrics.github.io/helm-charts/`), namespace `observability`.

```yaml
server:
  retentionPeriod: "3"   # 3 months, consistent with the 100GB NVMe disk shared with Postgres
  persistentVolume:
    enabled: true
    size: 10Gi
  resources:
    requests: { cpu: 50m, memory: 128Mi }
    limits: { cpu: 300m, memory: 400Mi }
```

**Verification:** `kubectl get pods -n observability` → `vmsingle` pod (or similar, depends on the release name) `Running`; `curl http://<pod-ip>:8428/health` (via `kubectl exec` or port-forward) → `OK`.

---

### Step 3 — Loki (monolithic, filesystem)

ArgoCD `Application` pointing to the `grafana/loki` chart, namespace `observability`, monolithic mode with filesystem storage (PVC), no MinIO/S3 (the MinIO subchart is deprecated and not needed here).

```yaml
loki:
  commonConfig:
    replication_factor: 1
  storage:
    type: filesystem
  schemaConfig:
    configs:
      - from: "2026-09-27"
        store: tsdb
        object_store: filesystem
        schema: v13
        index: { prefix: loki_index_, period: 24h }
deploymentMode: SingleBinary
singleBinary:
  replicas: 1
  persistence:
    size: 10Gi
  resources:
    requests: { cpu: 50m, memory: 128Mi }
    limits: { cpu: 300m, memory: 400Mi }
```

**Verification:** `kubectl get pods -n observability` → `loki-0` pod (or similar) `Running`; `kubectl get svc -n observability` shows the `loki` service (push endpoint `/loki/api/v1/push`) and `loki-gateway` if the chart creates it.

---

### Step 4 — Grafana Alloy

ArgoCD `Application` pointing to the `grafana/alloy` chart, namespace `observability`, `controller.type: daemonset` (default). River config in `alloy.configMap.content`:

```river
discovery.kubernetes "pods" {
  role = "pod"
}

discovery.relabel "pod_logs" {
  targets = discovery.kubernetes.pods.targets

  rule {
    source_labels = ["__meta_kubernetes_namespace"]
    target_label  = "namespace"
  }
  rule {
    source_labels = ["__meta_kubernetes_pod_name"]
    target_label  = "pod"
  }
  rule {
    source_labels = ["__meta_kubernetes_pod_container_name"]
    target_label  = "container"
  }
}

loki.source.kubernetes "pods" {
  targets    = discovery.relabel.pod_logs.output
  forward_to = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki.observability.svc.cluster.local:3100/loki/api/v1/push"
  }
}

prometheus.scrape "kube_state_metrics" {
  targets = [{"__address__" = "kube-state-metrics.observability.svc.cluster.local:8080"}]
  forward_to = [prometheus.remote_write.vm.receiver]
}

prometheus.scrape "node_exporter" {
  targets = [{"__address__" = "prometheus-node-exporter.observability.svc.cluster.local:9100"}]
  forward_to = [prometheus.remote_write.vm.receiver]
}

prometheus.remote_write "vm" {
  endpoint {
    url = "http://vmsingle-victoria-metrics-single-server.observability.svc.cluster.local:8428/api/v1/write"
  }
}
```

The exact Service names (`loki`, `vmsingle-victoria-metrics-single-server`) depend on the Helm release name given to the charts in Steps 2-3: verify them with `kubectl get svc -n observability` before writing this ConfigMap, do not assume them.

**Verification:** `kubectl get pods -n observability -l app.kubernetes.io/name=alloy` `Running` on every node; no connection errors in the Alloy logs towards Loki/VictoriaMetrics (`kubectl logs`).

---

### Step 5 — Credentials (Grafana admin + Slack webhook)

Grafana password: generated by the user, never in plain text in the repo — `Secret` with keys `admin-user`/`admin-password`, encrypted with SOPS, referenced by `admin.existingSecret` in the Grafana values (Step 6). Same scheme already used for R2/tunnel credentials in the previous phases.

Slack: the user creates a Slack App with an **Incoming Webhook** (or uses an existing webhook) on the workspace/channel chosen for alerts. The webhook URL is a real secret (whoever has it can post as the bot) — I get it in the chat only to create its `Secret`, then encrypt it with SOPS.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-slack-webhook
  namespace: observability
type: Opaque
stringData:
  url: "https://hooks.slack.com/services/..."
```

**Verification:** `sops -d` on the encrypted file rebuilds the correct URL; no plain-text secret left on disk outside the encrypted repo.

---

### Step 6 — Grafana

ArgoCD `Application` pointing to the `grafana/grafana` chart, namespace `observability`.

```yaml
admin:
  existingSecret: grafana-admin
  userKey: admin-user
  passwordKey: admin-password

datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
      - name: VictoriaMetrics
        type: prometheus
        url: http://vmsingle-victoria-metrics-single-server.observability.svc.cluster.local:8428
        isDefault: true
      - name: Loki
        type: loki
        url: http://loki.observability.svc.cluster.local:3100

alerting:
  contactpoints.yaml:
    apiVersion: 1
    contactPoints:
      - orgId: 1
        name: slack-alerts
        receivers:
          - uid: slack1
            type: slack
            settings:
              url: "${SLACK_WEBHOOK_URL}"   # from extraSecretEnv, read from the Secret of Step 5
  policies.yaml:
    apiVersion: 1
    policies:
      - orgId: 1
        receiver: slack-alerts
  rules.yaml:
    apiVersion: 1
    groups:
      - orgId: 1
        name: pod-crash
        folder: default
        interval: 1m
        rules:
          - uid: pod-crashloop
            title: "Pod in CrashLoopBackOff"
            condition: C
            data:
              - refId: A
                datasourceUid: <VictoriaMetrics uid, to be retrieved after the deploy>
                model:
                  expr: 'kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}'
              - refId: C
                datasourceUid: __expr__
                model:
                  type: threshold
                  expression: A
                  conditions:
                    - evaluator: { type: gt, params: [0] }
            noDataState: OK
            execErrState: Alerting
            for: 1m

envFromSecret: grafana-slack-webhook   # exposes SLACK_WEBHOOK_URL as GF_... or a mapped var; verify the chart's exact syntax at deploy time

ingress:
  enabled: true
  ingressClassName: tailscale
  hosts: []
  tls:
    - hosts:
        - grafana   # Tailscale device name, same pattern as ArgoCD in Phase 3
```

The rule's `datasourceUid` field must be resolved with the real UID of the VictoriaMetrics datasource after the first deploy (`kubectl exec` into Grafana or the UI, a one-off to note in the manifest before the final commit) — it cannot be guessed before Grafana exists.

**Verification:** `kubectl get pods -n observability -l app.kubernetes.io/name=grafana` `Running`; login at `https://grafana.<tailnet>.ts.net` (via Tailscale) with the credentials from Step 5; the VictoriaMetrics and Loki datasources show "connected" in **Connections → Data sources**.

---

### Step 7 — Verify real metrics and logs

- In Grafana → **Explore**, VictoriaMetrics datasource: the `up` query must show the Alloy scrape targets (kube-state-metrics, node-exporter).
- In Grafana → **Explore**, Loki datasource: the `{namespace="observability"}` query must show real logs (e.g. Alloy's own logs).

If either is empty, the problem is in the Alloy pipeline (Step 4) — do not proceed to Step 8 without real data, otherwise the test alert could not work anyway.

---

### Step 8 — Test alert (closing criterion, part 1)

```
kubectl run crash-test --image=busybox -n observability -- sh -c "exit 1"
```

This pod goes into `CrashLoopBackOff` by design (a command that exits immediately, restarted forever by Kubernetes).

**Verification:** within ~1-2 minutes (the rule's evaluation interval, Step 6) a message reaches the configured Slack channel. Then:
```
kubectl delete pod crash-test -n observability
```

If the alert does not arrive: check **Alerting → Alert rules** in Grafana for the rule's state (`Pending`/`Firing`/`Error`) before assuming a network problem towards Slack.

---

### Step 9 — External uptime check (closing criterion, part 2)

Minimal public test endpoint (same `whoami` pattern as the `demo` namespace from Phase 3), dedicated namespace `uptime-test`, exposed on a subdomain (e.g. `status.buddybudget.io`) through the same `cloudflared`+Traefik already configured — no change to the tunnel, just a new `IngressRoute` and a Cloudflare DNS entry.

The user creates a monitor on **UptimeRobot** or **Healthchecks.io** (external account, decision already taken in the spec) pointing at `https://status.buddybudget.io`.

**Verification:** the external monitor reports "up". Then, simulated shutdown:
```
kubectl scale deployment whoami -n uptime-test --replicas=0
```
The external monitor must report "down" within its check interval. Restore with `--replicas=1` once the verification is done; the `uptime-test` namespace stays (unlike the `demo` one from Phase 3) because it is still needed as the external monitor's target until the real app replaces it in Phase 6 — at that point the monitor is updated to point to `/api/health` and this namespace is removed.

---

### Step 10 — NetworkPolicy + quotas

Same scheme as the previous phases: `default-deny-ingress` on the `observability` namespace, with an explicit exception for Alloy → Loki/VictoriaMetrics traffic (same namespace, so it already covers most of it) and for the Tailscale ingress to Grafana. `ResourceQuota`/`LimitRange` with headroom above the usage observed at the end of the phase (the spec's budget target: ~700MB-1GB for the whole namespace).

## End of phase

Update CLAUDE.md with the outcome (including the real outcome of the test alert and the uptime check, not just "done"). Next step: the **Phase 6** plan (app in parallel — deploy on a test subdomain with a copy of the Neon data, CronJob, Umami, automatic tag update).
