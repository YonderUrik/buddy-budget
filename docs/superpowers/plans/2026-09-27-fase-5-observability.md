# Fase 5 — Observability: VictoriaMetrics + Loki + Alloy + Grafana — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (riga "Fase 5", aggiornata il 2026-09-27: Slack invece di Telegram)

**Obiettivo:** metriche e log del cluster in Grafana (VictoriaMetrics come TSDB, Loki per i log, Alloy come agente di raccolta), alert Slack funzionante e un check di uptime esterno. **Criterio di chiusura esplicito della spec**: un alert di prova (pod in crash) arriva su Slack; il check esterno segnala uno spegnimento simulato.

## Decisioni tecniche (verificate su doc/repo reali, non a memoria)

- **VictoriaMetrics single** (`victoria-metrics-single`, repo Helm `https://victoriametrics.github.io/helm-charts/`) invece di Prometheus: stesso protocollo di scrape/remote-write, frazione della RAM — coerente con la scelta già in spec di scartare `kube-prometheus-stack`.
- **kube-state-metrics** + **prometheus-node-exporter** (repo Helm `https://prometheus-community.github.io/helm-charts`) restano necessari anche con VictoriaMetrics: sono gli esportatori delle metriche del cluster (stato pod/nodi), VictoriaMetrics è solo lo storage — nessuno dei due è incluso nel chart `victoria-metrics-single`.
- **Grafana Alloy** (successore di Grafana Agent, repo Helm `https://grafana.github.io/helm-charts`) come unico agente di raccolta per metriche (scrape + `prometheus.remote_write` verso VictoriaMetrics) e log (`loki.source.kubernetes` + `loki.write` verso Loki) — un solo DaemonSet invece di due agenti separati, per restare nel budget RAM della spec (~700MB-1GB per l'intero namespace observability).
- **Loki in modalità Monolithic/filesystem** (stesso chart, il nome storico `SingleBinary` è deprecato ma ancora accettato), storage su PVC — niente object storage S3 per i log: a differenza di Postgres non serve PITR, e tenerlo semplice riduce RAM/complessità. Nessun backup (stesso criterio già usato per Redis in Fase 4: dati operativi, non di sistema).
- **cAdvisor/metriche container per-pod**: deferito. Il criterio di chiusura della fase richiede solo un alert su pod in crash (da `kube-state-metrics`, che già lo espone) e un check di uptime — non richiede dashboard di CPU/RAM per container. Aggiungerlo dopo, se serve, è un solo blocco di configurazione Alloy in più, non un cambio di architettura.
- **Grafana**: alerting provisionato via file (`values.yaml` → sezione `alerting`, pattern documentato da Grafana per Helm — contact point Slack + policy di notifica + regola di test), non a mano dalla UI, per restare coerente col principio "tutto dichiarativo e ricostruibile" della spec.
- **Slack**: incoming webhook creato dall'utente (stesso schema già usato per R2/tunnel — la credenziale vera passa in chat solo per crearla, poi cifrata con SOPS e mai più in chiaro). Nessun bot/comando da Slack verso il cluster (deciso il 2026-09-27, vedi "Rimandato consapevolmente" della spec: solo notifiche, non ChatOps).
- **Esposizione Grafana**: Tailscale Ingress, stesso pattern di ArgoCD in Fase 3 (`spec.tls[0].hosts[0]` per il nome del device, **non** l'annotazione `tailscale.com/hostname` né `spec.rules[].host` — errore già fatto e corretto in quella fase).
- **Uptime check esterno**: serve un endpoint pubblico reale da monitorare, ma l'app non è ancora sulla VPS (arriva in Fase 6) — si ricrea un endpoint minimo (`whoami`, stesso pattern del namespace `demo` di Fase 3, già rimosso a fine fase) dietro un sottodominio dedicato, solo per provare la pipeline di alerting esterno. Verrà sostituito dal vero `/api/health` dell'app in Fase 6.
- **Gestito da ArgoCD** (App-of-Apps, come tutti i componenti dalla Fase 3 in poi): un file in `argocd/apps/` per componente, manifest in `argocd/manifests/<nome>/`.

## Ordine dei passi

1. `kube-state-metrics` + `prometheus-node-exporter` (Helm, via ArgoCD).
2. VictoriaMetrics single (Helm, via ArgoCD).
3. Loki monolithic/filesystem (Helm, via ArgoCD).
4. Grafana Alloy (Helm, via ArgoCD) — River config: scrape kube-state-metrics/node-exporter → remote_write VictoriaMetrics; log pod → Loki.
5. Credenziali Grafana admin + Slack webhook → `Secret` cifrati con SOPS.
6. Grafana (Helm, via ArgoCD) — datasource VictoriaMetrics + Loki, alerting Slack provisionato via file, esposto via Tailscale Ingress.
7. **Verifica**: metriche e log reali visibili in Grafana (query dirette, non solo dashboard).
8. **[criterio di chiusura, parte 1] Alert di prova**: pod in CrashLoopBackOff deliberato → alert arriva su Slack.
9. **[criterio di chiusura, parte 2] Uptime check esterno**: endpoint pubblico di test + account UptimeRobot/Healthchecks.io dell'utente → spegnimento simulato rilevato.
10. NetworkPolicy default-deny + `ResourceQuota`/`LimitRange` per il namespace `observability`.

---

### Passo 1 — kube-state-metrics + node-exporter

Due `Application` ArgoCD separate verso i chart ufficiali `prometheus-community/kube-state-metrics` e `prometheus-community/prometheus-node-exporter`, namespace `observability`. `prometheus-node-exporter` è un DaemonSet: su un nodo singolo, un solo pod.

**Verifica:** `kubectl get pods -n observability` entrambi `Running`; `kubectl get svc -n observability` mostra `kube-state-metrics:8080` e `prometheus-node-exporter:9100`.

---

### Passo 2 — VictoriaMetrics single

`Application` ArgoCD verso il chart `victoria-metrics-single` (repo `https://victoriametrics.github.io/helm-charts/`), namespace `observability`.

```yaml
server:
  retentionPeriod: "3"   # 3 mesi, coerente col disco NVMe da 100GB condiviso con Postgres
  persistentVolume:
    enabled: true
    size: 10Gi
  resources:
    requests: { cpu: 50m, memory: 128Mi }
    limits: { cpu: 300m, memory: 400Mi }
```

**Verifica:** `kubectl get pods -n observability` → pod `vmsingle` (o simile, dipende dal nome release) `Running`; `curl http://<pod-ip>:8428/health` (via `kubectl exec` o port-forward) → `OK`.

---

### Passo 3 — Loki (monolithic, filesystem)

`Application` ArgoCD verso il chart `grafana/loki`, namespace `observability`, modalità monolitica con storage su filesystem (PVC), nessun MinIO/S3 (il subchart MinIO è deprecato e non serve qui).

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

**Verifica:** `kubectl get pods -n observability` → pod `loki-0` (o simile) `Running`; `kubectl get svc -n observability` mostra il servizio `loki` (endpoint push `/loki/api/v1/push`) e `loki-gateway` se il chart lo crea.

---

### Passo 4 — Grafana Alloy

`Application` ArgoCD verso il chart `grafana/alloy`, namespace `observability`, `controller.type: daemonset` (default). Config River in `alloy.configMap.content`:

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

I nomi esatti dei Service (`loki`, `vmsingle-victoria-metrics-single-server`) dipendono dal nome della release Helm data ai chart dei Passi 2-3: verificarli con `kubectl get svc -n observability` prima di scrivere questo ConfigMap, non assumerli.

**Verifica:** `kubectl get pods -n observability -l app.kubernetes.io/name=alloy` `Running` su ogni nodo; nessun errore di connessione nei log Alloy verso Loki/VictoriaMetrics (`kubectl logs`).

---

### Passo 5 — Credenziali (Grafana admin + Slack webhook)

Password Grafana: generata dall'utente, mai in chiaro nel repo — `Secret` con chiavi `admin-user`/`admin-password`, cifrato con SOPS, referenziato da `admin.existingSecret` nei values di Grafana (Passo 6). Stesso schema già usato per R2/credenziali tunnel nelle fasi precedenti.

Slack: l'utente crea una Slack App con un **Incoming Webhook** (o usa un webhook esistente) sul workspace/canale scelto per gli alert. L'URL del webhook è un segreto vero (chi lo ha può postare come il bot) — lo recupero in chat solo per crearne il `Secret`, poi cifro con SOPS.

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

**Verifica:** `sops -d` sul file cifrato ricostruisce l'URL corretto; nessun segreto in chiaro rimasto su disco fuori dal repo cifrato.

---

### Passo 6 — Grafana

`Application` ArgoCD verso il chart `grafana/grafana`, namespace `observability`.

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
              url: "${SLACK_WEBHOOK_URL}"   # da extraSecretEnv, letto dal Secret del Passo 5
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
                datasourceUid: <uid VictoriaMetrics, da recuperare dopo il deploy>
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

envFromSecret: grafana-slack-webhook   # espone SLACK_WEBHOOK_URL come GF_... o var mappata; verificare sintassi esatta del chart al momento del deploy

ingress:
  enabled: true
  ingressClassName: tailscale
  hosts: []
  tls:
    - hosts:
        - grafana   # nome del device Tailscale, stesso pattern di ArgoCD in Fase 3
```

Il campo `datasourceUid` della regola va risolto con l'UID reale del datasource VictoriaMetrics dopo il primo deploy (`kubectl exec` in Grafana o UI, one-off da annotare nel manifest prima del commit finale) — non è indovinabile prima che Grafana esista.

**Verifica:** `kubectl get pods -n observability -l app.kubernetes.io/name=grafana` `Running`; login su `https://grafana.<tailnet>.ts.net` (via Tailscale) con le credenziali del Passo 5; datasource VictoriaMetrics e Loki mostrano "connesso" in **Connections → Data sources**.

---

### Passo 7 — Verifica metriche e log reali

- In Grafana → **Explore**, datasource VictoriaMetrics: query `up` deve mostrare i target Alloy scrape (kube-state-metrics, node-exporter).
- In Grafana → **Explore**, datasource Loki: query `{namespace="observability"}` deve mostrare log reali (es. i log di Alloy stesso).

Se una delle due è vuota, il problema è nella pipeline Alloy (Passo 4) — non procedere al Passo 8 senza dati reali, altrimenti l'alert di prova non potrebbe funzionare comunque.

---

### Passo 8 — Alert di prova (criterio di chiusura, parte 1)

```
kubectl run crash-test --image=busybox -n observability -- sh -c "exit 1"
```

Questo pod entra in `CrashLoopBackOff` per design (comando che esce subito, riavviato all'infinito da Kubernetes).

**Verifica:** entro ~1-2 minuti (intervallo di valutazione della regola, Passo 6) un messaggio arriva sul canale Slack configurato. Poi:
```
kubectl delete pod crash-test -n observability
```

Se l'alert non arriva: controllare **Alerting → Alert rules** in Grafana per lo stato della regola (`Pending`/`Firing`/`Error`) prima di ipotizzare un problema di rete verso Slack.

---

### Passo 9 — Uptime check esterno (criterio di chiusura, parte 2)

Endpoint pubblico minimo di test (stesso pattern `whoami` del namespace `demo` di Fase 3), namespace dedicato `uptime-test`, esposto su un sottodominio (es. `status.buddybudget.io`) tramite lo stesso `cloudflared`+Traefik già configurato — nessuna modifica al tunnel, solo un nuovo `IngressRoute` e una voce DNS Cloudflare.

L'utente crea un monitor su **UptimeRobot** o **Healthchecks.io** (account esterno, decisione già presa in spec) puntato su `https://status.buddybudget.io`.

**Verifica:** il monitor esterno segnala "up". Poi, spegnimento simulato:
```
kubectl scale deployment whoami -n uptime-test --replicas=0
```
Il monitor esterno deve segnalare "down" entro il suo intervallo di check. Ripristinare con `--replicas=1` a verifica completata; il namespace `uptime-test` resta (a differenza del `demo` di Fase 3) perché serve ancora come target del monitor esterno finché l'app reale non lo sostituisce in Fase 6 — a quel punto si aggiorna il monitor per puntare a `/api/health` e si rimuove questo namespace.

---

### Passo 10 — NetworkPolicy + quote

Stesso schema delle fasi precedenti: `default-deny-ingress` sul namespace `observability`, con eccezione esplicita per il traffico Alloy → Loki/VictoriaMetrics (stesso namespace, quindi copre già la maggior parte) e per l'ingress Tailscale verso Grafana. `ResourceQuota`/`LimitRange` con margine sopra l'uso osservato a fine fase (obiettivo di budget della spec: ~700MB-1GB per l'intero namespace).

## Fine fase

Aggiornare CLAUDE.md con l'esito (incluso l'esito reale dell'alert di prova e del check di uptime, non solo "fatto"). Prossimo passo: piano della **Fase 6** (app in parallelo — deploy su sottodominio di prova con copia dati Neon, CronJob, Umami, aggiornamento tag automatico).
