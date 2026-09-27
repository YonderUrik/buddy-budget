# Osservabilità dell'app — Fase A: l'app si racconta — design

Data: 2026-09-27
Stato: **approvata dall'utente il 2026-09-27**. Piano: `docs/superpowers/plans/2026-09-27-osservabilita-app-fase-a.md`.
Contesto: gli strumenti di osservabilità esistono già nel cluster (Fase 5 migrazione VPS: VictoriaMetrics, Loki, Alloy, Grafana, alert Slack, UptimeRobot; ArgoCD da Fase 3; Umami da Fase 6), ma l'app non produce segnali utili: ~80 `console.*` in testo libero, nessuna metrica applicativa, nessun evento di prodotto.

## Visione in tre fasi (questa spec copre solo la A)

| Fase | Cosa | Dove | Esito |
|------|------|------|-------|
| **A — l'app si racconta** | log strutturati, metriche Prometheus, heartbeat dei cron, eventi di prodotto Umami | repo app | i segnali esistono e hanno nomi stabili |
| B — strumenti configurati per un umano | dashboard Grafana as-code, alert con runbook, canali Slack separati, notifiche ArgoCD, guida "come capire se qualcosa va storto" | repo infra + Slack | l'utente sa leggere lo stato dell'app |
| C — accesso per agenti | MCP in sola lettura (Grafana, ArgoCD, Umami), service account per ruolo, base per Paperclip | fuori dalla VPS di produzione | agenti con ruoli che interrogano gli stessi segnali |

Ordine voluto: un agente (C) è utile solo quanto i segnali che legge (A) e le domande che sappiamo già porci (B). La Fase A precede anche il cutover (Fase 7 migrazione VPS): non si sposta la produzione senza poter vedere se l'app sta bene.

## Obiettivo della Fase A

Ogni evento rilevante dell'app (richiesta API, errore, sync GoCardless, cron, job in background, azione di prodotto) produce un segnale **strutturato, con nome stabile, senza dati personali**, interrogabile da Loki (log), VictoriaMetrics (metriche) e Umami (eventi di prodotto).

Criterio di "fatto":
- nessun `console.*` residuo nel codice server (eccetto script CLI in `lib/db/*` che parlano a un terminale umano);
- `GET /api/metrics` (con token) restituisce le metriche elencate sotto, verificato con `curl` su dev e sul cluster;
- un errore provocato di proposito compare in Loki come riga JSON filtrabile per `event`, `requestId`, `level`;
- un cron eseguito aggiorna la metrica "ultimo successo" leggibile da qualunque pod;
- gli eventi di prodotto compaiono in Umami → Events;
- test unitari per logger (redazione), wrapper di route e registry metriche.

## Decisioni

1. **Logger proprio, sottile, a campi tipizzati** (`lib/observability/logger.ts`), non `pino`. Scrive una riga JSON per evento su stdout/stderr. Motivi: i campi ammessi sono un tipo TypeScript chiuso (non si può passare "un oggetto qualunque" che si porta dietro importi o descrizioni), zero dipendenze, nessun problema di bundling con l'output `standalone` di Next (i transport di pino usano worker thread). Il formato resta quello standard che Loki/Grafana si aspettano (JSON per riga), quindi nulla di non trasferibile. Se in futuro servono prestazioni o feature di pino, la sostituzione è interna al modulo.
2. **Metriche con `prom-client`** (libreria standard Prometheus per Node), registry singleton su `globalThis` (sopravvive all'HMR in dev), metriche di processo di default attive (heap, event loop lag, GC, CPU).
3. **Endpoint `/api/metrics` protetto da token** (`METRICS_TOKEN`, bearer, confronto a tempo costante come `CRON_SECRET`). Variabile **opzionale**: se assente l'endpoint risponde 404 (su Vercel non serve). Difesa in profondità: anche se l'IngressRoute pubblica instrada tutto `app.buddybudget.io`, senza token non si legge nulla.
4. **Stato dei cron su Redis, non in memoria**: i contatori `prom-client` sono per-pod e si azzerano a ogni riavvio, e il CronJob colpisce un pod a caso. "Il cron X è riuscito l'ultima volta alle…" va quindi scritto su Redis (`ops:heartbeat:<nome>` → timestamp, nessun TTL) e letto al momento dello scrape come gauge. Così l'alert "cron non eseguito da 26h" (Fase B) è affidabile con 2 repliche e sopravvive ai rollout.
5. **Wrapper per le route API** (`withRoute("transactions.list", handler)`) invece di logica nel `proxy.ts`: il proxy non vede status né durata della risposta. Il nome passato al wrapper è un **template statico** (mai il path reale con id), per non esplodere la cardinalità delle metriche.
6. **Identificativo utente pseudonimizzato**: nei log compare `user` = primi 16 caratteri esadecimali di `sha256(userId)`. Non reversibile senza il DB (gli id sono UUID casuali), ricalcolabile da chi ha accesso al DB per un debug mirato. Mai in etichette di metrica (cardinalità).
7. **Umami: eventi tipizzati, senza dati** — helper `track(event, props?)` con unione chiusa di nomi evento e props solo categoriche/booleane (mai importi, nomi, descrizioni, id). No-op se lo script Umami non è caricato.
8. **Naming**: eventi di log `dominio.oggetto.esito` (es. `gocardless.sync.failed`), metriche con prefisso `buddybudget_` e unità nel nome (`_seconds`, `_total`).

## Componenti

### 1. Logger — `lib/observability/logger.ts`

```ts
logger.info("gocardless.sync.completed", { accountId, jobId, durationMs, inserted: 12 });
logger.error("cron.gocardless_sync.failed", { error });
const log = logger.child({ requestId, route: "transactions.list", user: hashUserId(session.user.id) });
```

Ogni riga: `ts` (ISO), `level` (`debug|info|warn|error`), `event`, `service: "buddy-budget"`, `version`/`commit` (da `APP_BUILD_INFO`), più i campi contestuali.

Campi ammessi (tipo chiuso `LogFields`): `requestId`, `route`, `method`, `status`, `durationMs`, `user` (già hashato), `accountId`, `jobId`, `connectionId`, `cron`, `phase`, `count`/contatori numerici nominati (`inserted`, `categorized`, `uncategorized`, `processed`, `total`), `reason` (stringa enumerata dal chiamante), `error`.

`error` viene serializzato come `{ name, message, stack }` (stack solo se `level` è `error`). Il messaggio di un errore esterno può contenere testo arbitrario: il logger tronca `message` a 500 caratteri e applica una redazione di pattern noti (email, IBAN, `Bearer …`, parametri `token=`/`secret=` in URL). La redazione è una rete di sicurezza, non il meccanismo principale: il principale è il tipo chiuso.

**Mai nei log**: email, nomi, IBAN, importi, descrizioni/note delle transazioni, nomi dei merchant, token/segreti, cookie, body delle richieste, `userId` in chiaro. Regola da riportare in `CLAUDE.md` (sezione "Principi di architettura").

Livello minimo da `LOG_LEVEL` (opzionale, default `info`; `debug` in dev).

### 2. Wrapper delle route — `lib/observability/with-route.ts`

`withRoute(name, handler)` per ogni Route Handler in `app/api/**` (30 file oggi):
- genera o riusa `requestId` (header `x-request-id` se presente e valido, altrimenti UUID) e lo rimanda in risposta;
- misura la durata; al termine logga `http.request.completed` (`info` per 2xx/3xx/4xx previsti, `warn` per 429, `error` per 5xx) — le probe `/api/health*` e lo scrape `/api/metrics` loggano solo se falliscono, per non riempire Loki;
- cattura le eccezioni non gestite: log `http.request.failed` con `error`, risposta 500 generica (nessun dettaglio al client);
- aggiorna `buddybudget_http_requests_total{route,method,status_class}` e `buddybudget_http_request_duration_seconds{route,method}`.
- espone il logger figlio al handler (`ctx.log`) così i log di dominio dentro la richiesta ereditano `requestId`/`route`/`user`.

Il lavoro in `after()` (job di sync) riceve un logger figlio con `requestId` e `jobId`, così la richiesta che ha avviato il job e il job stesso sono collegabili in Loki.

### 3. Errori non intercettati — `instrumentation.ts`

Aggiunta di `onRequestError` (hook di Next.js) che logga `next.request_error` con path template, tipo di route (page/route/action) e `error`. Copre errori in Server Components e pagine che non passano dal wrapper.

### 4. Metriche — `lib/observability/metrics.ts` + `app/api/metrics/route.ts`

| Metrica | Tipo | Etichette | Serve a |
|---|---|---|---|
| `buddybudget_http_requests_total` | counter | `route`, `method`, `status_class` | tasso di errori per route |
| `buddybudget_http_request_duration_seconds` | histogram | `route`, `method` | latenze p50/p95 |
| `buddybudget_gocardless_sync_total` | counter | `trigger` (`manual`/`cron`/`finalize`), `outcome` (`synced`/`limited`/`expired`/`error`) | sync falliti o limitati |
| `buddybudget_gocardless_sync_duration_seconds` | histogram | `trigger` | sync lenti |
| `buddybudget_gocardless_api_requests_total` | counter | `endpoint` (template), `status_class` | salute dell'API esterna, 429 |
| `buddybudget_transactions_imported_total` | counter | `categorized` (`true`/`false`) | resa della categorizzazione automatica |
| `buddybudget_sync_jobs_active` | gauge (letto da Redis allo scrape) | — | job in corso |
| `buddybudget_sync_jobs_stale` | gauge (letto da Redis allo scrape) | — | job con heartbeat scaduto |
| `buddybudget_cron_last_success_timestamp_seconds` | gauge (letto da Redis allo scrape) | `cron` | "il cron è girato?" |
| `buddybudget_cron_runs_total` | counter | `cron`, `outcome` | fallimenti dei cron |
| `buddybudget_auth_events_total` | counter | `event` (`magic_link_sent`/`magic_link_failed`/`sign_in`/`rate_limited`) | problemi di login/email |
| `buddybudget_dependency_up` | gauge (allo scrape, timeout 2s) | `dependency` (`postgres`/`redis`) | riusa `lib/health/readiness.ts` |
| `buddybudget_build_info` | gauge = 1 | `version`, `commit` | quale versione gira su ogni pod |
| metriche di processo di default | — | — | memoria, event loop lag |

Nessuna etichetta ad alta cardinalità (id utente, id conto, path reali). Le gauge "lette da Redis" sono calcolate con `collect()` di `prom-client` al momento dello scrape: se Redis non risponde, la gauge non viene emessa (assenza del dato, gestibile in alert con `absent()`), mai un valore inventato.

`/api/metrics`: aggiunto ai percorsi pubblici di `proxy.ts` (come `/api/cron`, protetto dal proprio token), `dynamic = "force-dynamic"`, `Cache-Control: no-store`, content-type Prometheus.

### 5. Heartbeat dei cron — `lib/observability/heartbeat.ts`

`recordCronRun(name, outcome, durationMs)`: incrementa `buddybudget_cron_runs_total`, logga `cron.<name>.completed|failed`, e solo su successo scrive `ops:heartbeat:cron:<name>` = epoch su Redis. Errori di scrittura su Redis sono loggati (`warn`) ma non fanno fallire il cron.

### 6. Eventi di prodotto Umami — `lib/analytics/track.ts`

Eventi iniziali (tutti client-side, dopo l'esito positivo della mutation corrispondente):

| Evento | Props ammesse |
|---|---|
| `onboarding_completed` | `currency` (codice ISO) |
| `bank_connect_started` | — |
| `bank_connect_completed` | `accounts` (conteggio) |
| `account_sync_manual` | — |
| `transaction_added` | `direction` (`entrata`/`uscita`) |
| `transaction_category_changed` | `source` (`row`/`categorizza`) |
| `categorization_applied` | `groups` (conteggio) |
| `categorization_rule_saved` | `matchType` |
| `transaction_split` | — |
| `category_created` | `group` |
| `pwa_installed` | — (evento `appinstalled`) |

Tipo chiuso `ProductEvent` = unione dei nomi con le props tipizzate per ciascuno. Nessun importo, nome, id.

### 7. Migrazione dei `console.*` esistenti

Ogni `console.error/warn/log` nel codice server diventa una chiamata al logger con un `event` nominato (es. `"Sync fallito per il conto X"` → `logger.error("gocardless.sync.failed", { accountId, error })`). Restano `console.*` solo negli script CLI `lib/db/*.ts` (output per un umano al terminale). Regola ESLint `no-console` attiva su `app/`, `lib/` (esclusi `lib/db/*` script CLI) e `components/`, così la regressione è bloccata in CI.

### 8. Nuove variabili d'ambiente (opzionali)

- `METRICS_TOKEN` — min 32 caratteri; assente ⇒ `/api/metrics` risponde 404.
- `LOG_LEVEL` — `debug|info|warn|error`, default `info`.

Aggiunte a `serverEnvSchema` come opzionali (l'app su Vercel continua ad avviarsi senza).

## Lavoro lato infra (runbook nel repo `buddy-budget-infra`, parte del piano ma eseguito lì)

- Secret `METRICS_TOKEN` cifrato SOPS nel namespace `app` (env dell'app) e nel namespace `observability` (per Alloy).
- Alloy: `discovery.kubernetes` sui pod `app: buddy-budget` + `prometheus.scrape` di `/api/metrics` con `bearer_token_file`, intervallo 30s → `remote_write` verso VictoriaMetrics (stessa catena già esistente).
- Alloy log: `stage.json` + `stage.labels` per promuovere **solo** `level` a label Loki (bassa cardinalità); il resto si interroga con `| json` in LogQL.
- NetworkPolicy: eccezione `observability` → pod app porta 3000 nel namespace `app` (default-deny già attivo — stessa lezione di Tailscale/CNPG: va nello stesso commit dello scrape).

## Canali Slack (preparazione per la Fase B, decisa ora)

Scelta dell'utente: canali separati per tipo di messaggio.

| Canale | Contenuto | Rumore atteso |
|---|---|---|
| `#bb-allarmi` | alert `severity=critical`: app giù, tasso 5xx alto, backup fallito, disco quasi pieno | raro, si guarda subito |
| `#bb-avvisi` | alert `severity=warning`: cron non eseguito, sync falliti ripetuti, latenze alte, rate limit GoCardless | qualche volta a settimana |
| `#bb-deploy` | notifiche ArgoCD (deploy riuscito/fallito, app fuori sync) e CI | a ogni merge |
| `#bb-riepiloghi` | riepiloghi periodici (in futuro: report degli agenti della Fase C) | giornaliero/settimanale |

In Grafana ogni canale diventa un contact point (un webhook per canale); la notification policy instrada per label `severity`. **Stato (2026-09-27):** i quattro canali sono stati creati come **privati** nel workspace `buddybudget` tramite il connettore Slack (collegato dall'utente dopo la stesura della spec), ognuno con un messaggio che ne spiega lo scopo. Gli incoming webhook, uno per canale, li ha creati l'utente e li conserva lui: finiranno cifrati SOPS nel repo infra in Fase B, mai in chiaro in chat o nel repo.

## Fuori scope, consapevolmente

- **Tracing distribuito (OpenTelemetry/Tempo)**: con un solo servizio e un DB, `requestId` nei log dà già la correlazione necessaria; Tempo costerebbe RAM su una VPS da 8 GB. Da rivalutare se arrivano più servizi.
- **Error tracking dedicato (Sentry/GlitchTip)**: gli errori finiscono in Loki con stack e contesto; un alert su `level=error` copre il bisogno. GlitchTip self-hosted resta un'opzione se il volume di errori rende utile il raggruppamento.
- **Real User Monitoring / Web Vitals**: rimandato; eventualmente via Umami o un endpoint dedicato in Fase B.
- **Metriche di business sensibili** (importi totali, numero di transazioni per utente): mai come metriche; se servono analisi, si fanno sul DB, non nel sistema di osservabilità che leggeranno anche gli agenti.
- **Dashboard, alert, guida alla lettura dei log, notifiche ArgoCD**: Fase B.
- **MCP e agenti**: Fase C.

## Rischi e attenzioni

- **Cardinalità**: una label sbagliata (path reale, id) può far crescere VictoriaMetrics senza limite. Mitigazione: nomi di route statici passati a mano al wrapper, test che verifica l'assenza di pattern UUID nei nomi di route registrati.
- **Rumore nei log**: probe e scrape ogni 10-30s per 2 pod. Mitigazione: loggate solo se falliscono.
- **Vercel fino al cutover**: log JSON funzionano anche lì (li mostra nei Runtime Logs), `/api/metrics` resta spento (niente `METRICS_TOKEN`). Nessuna regressione.
- **Dati personali in messaggi di errore esterni** (es. errori GoCardless che riportano parametri): troncamento + redazione nel logger, e revisione manuale dei punti che loggano errori di librerie esterne durante l'implementazione.
