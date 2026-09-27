# Osservabilità dell'app, Fase A: l'app si racconta (piano di implementazione)

> **Per chi esegue:** skill consigliata `superpowers:subagent-driven-development` (oppure `superpowers:executing-plans` inline). Gli step usano checkbox (`- [ ]`). Gli step **👤 UTENTE** richiedono un'azione dell'utente (pannelli, password manager, cluster): chi esegue spiega cosa fa e perché, aspetta l'output e lo verifica prima di proseguire.

**Obiettivo:** ogni evento rilevante dell'app (richiesta API, errore, sync GoCardless, cron, job in background, azione di prodotto) produce un segnale strutturato, con nome stabile e senza dati personali. Lo si interroga da Loki (log), VictoriaMetrics (metriche) e Umami (eventi di prodotto).

**Architettura:** un modulo `lib/observability/` senza dipendenze da UI:
- `logger` a campi tipizzati, una riga JSON su stdout/stderr;
- `metrics` con registry `prom-client` singleton;
- `withRoute` che avvolge ogni Route Handler (requestId, durata, status, eccezioni);
- `heartbeat` dei cron su Redis.

Lato client, `lib/analytics/track.ts` manda a Umami eventi tipizzati. `GET /api/metrics` espone le metriche con un bearer token opzionale (senza token risponde 404: su Vercel resta spento). Lato infra (repo `buddy-budget-infra`), Alloy fa lo scrape dei pod app e promuove `level` a label Loki.

**Stack tecnico:** Next.js 16 (Route Handlers, `after()`, `instrumentation.ts` `onRequestError`), `prom-client`, ioredis, Zod 4, Vitest 4, ESLint flat config, Umami tracker (`window.umami.track`), Grafana Alloy.

**Spec:** `docs/superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md`.

**Branch:** `claude/amazing-hamilton-zbn0d1`, portato su `main` con una PR (la CI la verifica).

## Vincoli globali

- **Mai nei log e mai nelle etichette delle metriche:** email, nomi, IBAN, importi, descrizioni/note delle transazioni, nomi dei merchant, token/segreti, cookie, body delle richieste, `userId` in chiaro. L'utente compare nei log solo come `user` = primi 16 hex di `sha256(userId)` e mai in una label.
- **Nomi di route statici** passati a mano a `withRoute` (es. `"transactions.update"`), mai il path reale: controlla la cardinalità delle metriche.
- `LogFields` è un **tipo chiuso**: niente `Record<string, unknown>` nel logger pubblico.
- Le variabili nuove (`METRICS_TOKEN`, `LOG_LEVEL`) sono **opzionali**: l'app su Vercel deve continuare ad avviarsi identica.
- Nessun cambio di schema DB (nessuna migration in questo piano).
- Standard "Operazioni lunghe" invariato: il job di sync resta in `after()`. Riceve solo un logger figlio.
- Commenti, JSDoc e testi in italiano; JSDoc minimo su ogni export pubblico; barrel `lib/observability/index.ts`.
- I `console.*` restano ammessi **solo** negli script CLI `lib/db/*.ts` (non importati dall'app).

## Focus della review

1. **Fughe di dati personali nei log.** Il rischio principale sono i messaggi d'errore di librerie esterne: GoCardless riporta path con id di conto, Resend l'indirizzo email, postgres.js a volte i parametri. Copertura: tipo chiuso, test di redazione (email, IBAN, Bearer, `token=`/`secret=`), troncamento a 500 caratteri e revisione manuale dei punti che loggano `error` di librerie esterne (Task 7).
2. **Esplosione di cardinalità.** Copertura: test che fallisce se un nome di route registrato contiene un UUID, un numero o `/`. Le etichette sono solo enum chiusi.
3. **Il wrapper cambia il comportamento delle route.** Status, header e body devono restare identici, compresi i redirect del callback GoCardless e le risposte di better-auth. Copertura: test del wrapper su risposta passante e su eccezione, poi `pnpm test` completo dopo l'applicazione alle 30 route.
4. **Gauge "lette da Redis" che inventano valori.** Se Redis non risponde, la gauge non viene emessa (niente 0 fittizio). Copertura: test con Redis finto che lancia.
5. **`/api/metrics` esposto senza protezione.** Copertura: test 404 senza `METRICS_TOKEN`, 401 con token sbagliato, 200 con token giusto; confronto a tempo costante (riuso di `isAuthorizedCronRequest`).

---

### Task 1: logger strutturato

**File:** creare `lib/observability/logger.ts`, `lib/observability/redact.ts`, `lib/observability/user-hash.ts`, `lib/observability/index.ts` e i relativi `*.test.ts`. Modificare `lib/env.ts` (+ test).

- [ ] **Env:** aggiungere a `serverEnvSchema` `LOG_LEVEL: z.enum(["debug","info","warn","error"]).optional()` e `METRICS_TOKEN: z.string().min(CRON_SECRET_MIN_LENGTH).optional()`. Test: env senza le due variabili valido; `METRICS_TOKEN` corto invalido e segnalato per nome.
- [ ] **`redact.ts`:** `redactText(s: string): string`. Sostituisce email → `[email]`, IBAN (`/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/`) → `[iban]`, `Bearer <x>` → `Bearer [redacted]`, `(token|secret|code|access|refresh)=<x>` → `$1=[redacted]`, UUID → `[id]`, e tronca a `MAX_ERROR_MESSAGE_LENGTH = 500`. Test per ogni pattern più un caso "testo innocuo invariato".
- [ ] **`user-hash.ts`:** `hashUserId(id: string): string` = primi 16 hex di `sha256` (`node:crypto`). Test: deterministico, lunghezza 16, diverso per id diversi.
- [ ] **`logger.ts`:**
  ```ts
  export type LogLevel = "debug" | "info" | "warn" | "error";
  export interface LogFields {
    requestId?: string; route?: string; method?: string; status?: number; durationMs?: number;
    user?: string; accountId?: string; jobId?: string; connectionId?: string; cron?: string;
    phase?: string; trigger?: string; outcome?: string; reason?: string;
    inserted?: number; categorized?: number; uncategorized?: number; processed?: number; total?: number; count?: number;
    error?: unknown;
  }
  export interface Logger {
    debug(event: string, fields?: LogFields): void; info(...): void; warn(...): void; error(...): void;
    child(fields: LogFields): Logger;
  }
  export function createLogger(opts?: { level?: LogLevel; write?: (line: string, level: LogLevel) => void; base?: LogFields }): Logger;
  export const logger: Logger; // livello da process.env.LOG_LEVEL, default "info" ("debug" se NODE_ENV=development)
  ```
  Ogni riga contiene `ts`, `level`, `event`, `service: "buddy-budget"`, `version`/`commit` da `APP_BUILD_INFO`, più i campi. `error` viene serializzato in `{ name, message: redactText(message), stack? }`; lo stack solo a livello `error`, passato anch'esso da `redactText`. Un valore non-Error diventa `{ message: redactText(String(x)) }`. `warn`/`error` vanno su stderr, gli altri su stdout. `JSON.stringify` è protetto: un campo non serializzabile non fa lanciare il logger.
- [ ] **Test del logger** (writer finto): livello minimo rispettato; `child` eredita e sovrascrive; `error` redatto e troncato; stack assente a `warn`; nessuna eccezione con un riferimento circolare dentro `error.cause`.
- [ ] **Barrel** `lib/observability/index.ts`, poi `pnpm test lib/observability lib/env.test.ts` e `pnpm tsc --noEmit`.
- [ ] Commit `feat(observability): logger JSON a campi tipizzati con redazione`.

### Task 2: registry delle metriche ed endpoint `/api/metrics`

**File:** creare `lib/observability/metrics.ts` (+ test) e `app/api/metrics/route.ts` (+ test). Modificare `proxy.ts` (+ test) e `package.json`.

- [ ] `pnpm add prom-client`.
- [ ] **`metrics.ts`:** registry singleton su `globalThis.__bbMetrics` (sopravvive all'HMR). Il primo accesso chiama `collectDefaultMetrics({ register, prefix: "buddybudget_process_" })` e crea le metriche della tabella della spec: counter e histogram con le etichette indicate e bucket di durata `[0.05,0.1,0.25,0.5,1,2.5,5,10,30,60,120,300]`. `buddybudget_build_info{version,commit} 1`. Funzioni di dominio esportate invece degli oggetti prom-client grezzi (così le etichette restano un enum tipizzato):
  - `recordHttpRequest(route, method, status, durationMs)` (`status_class` = `"2xx"`…`"5xx"`);
  - `recordGoCardlessSync(trigger: "manual"|"cron"|"finalize", outcome: "synced"|"limited"|"expired"|"error", durationMs)`;
  - `recordGoCardlessApiRequest(endpoint: GoCardlessEndpoint, status)`, con `GoCardlessEndpoint` enum dei template (`"token.new"`, `"institutions.list"`, `"requisitions.create"`, `"requisitions.get"`, `"accounts.details"`, `"accounts.balances"`, `"accounts.transactions"`);
  - `recordTransactionsImported(categorized: number, uncategorized: number)`;
  - `recordCronRun(cron: CronName, outcome: "success"|"error")`;
  - `recordAuthEvent(event: "magic_link_sent"|"magic_link_failed"|"sign_in"|"rate_limited")`.
- [ ] **Gauge asincrone** (`collect()`) registrate con `registerAsyncGauges(deps)`:
  - `buddybudget_dependency_up{dependency}`: riusa `checkReadiness`;
  - `buddybudget_cron_last_success_timestamp_seconds{cron}`, `buddybudget_sync_jobs_active`, `buddybudget_sync_jobs_stale`: leggono da Redis tramite funzioni iniettate.

  Se una lettura lancia, la gauge non emette nulla per quello scrape (`gauge.reset()` senza `set`).
- [ ] **Test** (`register.metrics()` sul testo): ogni funzione incrementa la serie attesa; gauge asincrona con dipendenza che lancia → metrica senza campioni; **test di cardinalità**: `recordHttpRequest` rifiuta, con `throw` in dev/test e log `warn` in produzione, un nome route che matcha `/[0-9a-f]{8}-|\/|\d{3,}/`.
- [ ] **`app/api/metrics/route.ts`:** `dynamic = "force-dynamic"`.
  - `process.env.METRICS_TOKEN` assente → 404;
  - `isAuthorizedCronRequest(header, METRICS_TOKEN)` falso → 401;
  - altrimenti 200 con `register.metrics()`, `Content-Type: register.contentType` e `Cache-Control: no-store`.

  Test sui tre casi.
- [ ] **`proxy.ts`:** aggiungere `"/api/metrics"` a `PUBLIC_PATH_PREFIXES`, con un test in `proxy.test.ts` (o in quello esistente) che `/api/metricsx` non sia pubblico.
- [ ] Verifica: `pnpm test`, `pnpm tsc --noEmit`. Poi `pnpm dev` con `METRICS_TOKEN` in `.env.local` e `curl -H "Authorization: Bearer $METRICS_TOKEN" localhost:3000/api/metrics | grep buddybudget_`.
- [ ] Commit `feat(observability): metriche Prometheus e /api/metrics protetto da token`.

### Task 3: wrapper `withRoute`

**File:** creare `lib/observability/with-route.ts` (+ test).

- [ ] Firma:
  ```ts
  export interface RouteContext { requestId: string; log: Logger }
  export function withRoute<A extends unknown[]>(
    name: string,
    handler: (request: Request, ...rest: [...A, RouteContext]) => Promise<Response> | Response,
    opts?: { quietOnSuccess?: boolean }
  ): (request: Request, ...rest: A) => Promise<Response>;
  ```
  Il `RouteContext` va **in coda** agli argomenti originali, così le route dinamiche (`{ params }`) restano invariate nella firma che Next.js vede.
- [ ] Comportamento:
  - `requestId` = header `x-request-id` se matcha `/^[A-Za-z0-9-]{8,64}$/`, altrimenti `crypto.randomUUID()`;
  - `log = logger.child({ requestId, route: name, method })`;
  - l'handler viene eseguito e ne esce una risposta; alla risposta si aggiunge l'header `x-request-id` clonando gli header solo se sono mutabili, altrimenti `new Response(body, …)`, **senza cambiare status né body**;
  - log `http.request.completed` con `status` e `durationMs`: livello `info` per <400, `info` per 4xx tranne 429 (`warn`), `error` per 5xx; con `quietOnSuccess` non logga sotto 400;
  - eccezione → log `http.request.failed` (`error`) e risposta `Response.json({ error: "Errore interno" }, { status: 500 })`;
  - sempre `recordHttpRequest`.
- [ ] L'utente: helper `withUser(log, userId)` = `log.child({ user: hashUserId(userId) })`, chiamato dalle route dopo aver letto la sessione. Il wrapper non legge la sessione: non tutte le route sono autenticate e non si vuole una query in più.
- [ ] Test: risposta 200 passante con body/status/header originali più `x-request-id`; `x-request-id` valido riusato, non valido rigenerato; handler che lancia → 500 generico e riga di log con `error` redatto; `quietOnSuccess` non logga il 200 ma logga il 503; `recordHttpRequest` chiamato con `status_class` corretto; redirect 307 (`Response.redirect`, header immutabili) resta 307 con `Location` intatta.
- [ ] Commit `feat(observability): wrapper withRoute per i Route Handler`.

### Task 4: applicare `withRoute` alle 30 route

**File:** tutti gli `app/api/**/route.ts`.

- [ ] Convenzione dei nomi: `<risorsa>.<azione>` dal path e dal metodo, per esempio:

  | Route | Nome |
  |---|---|
  | `GET /api/transactions` | `transactions.list` |
  | `PATCH /api/transactions/[id]` | `transactions.update` |
  | `POST /api/gocardless/connections/[id]/finalize` | `gocardless.connections.finalize` |
  | `GET /api/cron/gocardless-sync` | `cron.gocardless_sync` |
  | `GET\|POST /api/auth/[...all]` | `auth` (un solo nome: le sotto-route di better-auth non vanno in label) |

  Health, ready e metrics usano `quietOnSuccess: true`.
- [ ] Nelle route autenticate usare `withUser(ctx.log, session.user.id)` per i log di dominio interni alla richiesta.
- [ ] Esempio (`app/api/transactions/[id]/route.ts`):
  ```ts
  export const PATCH = withRoute("transactions.update", async (request, { params }: { params: Promise<{ id: string }> }, ctx) => { … });
  ```
- [ ] Verificare la compatibilità di tipi con Next.js 16 (i validator dei tipi di route generati in `.next/types`) con `pnpm build`. Se un export avvolto non passa il type-check di Next, dichiarare esplicitamente il tipo del secondo argomento come nell'esempio.
- [ ] `pnpm test` completo: i test di route esistenti devono passare senza modifiche alle asserzioni. Se un test chiama l'handler con un solo argomento, il wrapper deve funzionare con `rest` vuoto.
- [ ] Commit `refactor(api): tutte le route passano da withRoute`.

### Task 5: errori non intercettati (`onRequestError`)

**File:** modificare `instrumentation.ts`.

- [ ] Aggiungere
  ```ts
  export async function onRequestError(error: unknown, request: { path: string; method: string }, context: { routerKind: string; routePath: string; routeType: string }) {
    const { logger } = await import("@/lib/observability");
    logger.error("next.request_error", { route: context.routePath, method: request.method, reason: context.routeType, error });
  }
  ```
  Si usa `routePath` (template, es. `/transazioni`), non `request.path` (può contenere query).
- [ ] Verifica manuale su `pnpm dev`: una pagina server che lancia (temporaneamente) produce una riga JSON `next.request_error`. Poi si rimuove il lancio.
- [ ] Commit `feat(observability): log degli errori non intercettati via onRequestError`.

### Task 6: heartbeat dei cron e gauge da Redis

**File:** creare `lib/observability/heartbeat.ts` e `lib/observability/ops-store.ts` (+ test). Modificare le due route cron, `lib/sync-jobs/run.ts` e la registrazione delle gauge in `metrics.ts`.

- [ ] **`ops-store.ts`** (su un'interfaccia KV iniettabile, come `SyncJobKv`, con implementazione Redis e implementazione in memoria per i test):
  - `setCronSuccess(cron, epochSeconds)` → `SET ops:heartbeat:cron:<cron>` senza TTL;
  - `getCronSuccesses(): Promise<Record<CronName, number | null>>`;
  - `markJobRunning(jobId, now)` → `ZADD ops:sync-jobs:running now jobId`, `touchJob` idem;
  - `markJobDone(jobId)` → `ZREM`;
  - `countJobs(now) → { active, stale }`: `stale` = score < now − `SYNC_JOB_STALE_MS`, `active` = il resto. Prima pulisce con `ZREMRANGEBYSCORE` le voci più vecchie di `SYNC_JOB_TTL_SECONDS`.
- [ ] **`heartbeat.ts`:** `recordCronRun(cron, outcome, durationMs, deps)`. Chiama `recordCronRun` delle metriche e logga `cron.<cron>.completed|failed`. Su successo esegue `setCronSuccess`; se la scrittura su Redis fallisce logga `warn` `cron.heartbeat.write_failed` senza rilanciare.
- [ ] **Route cron:** `runDueSyncs()` e `runDailySnapshots()` in try/catch con `recordCronRun`. Sostituiscono il `console.error`.
- [ ] **`run.ts`:** `markJobRunning` all'avvio di `runSyncJob`, `touchJob` a ogni heartbeat già esistente, `markJobDone` in `finally`. Gli errori di questi tre passi sono loggati e non interrompono il job.
- [ ] Gauge asincrone collegate a `getCronSuccesses`/`countJobs` (nel Task 2 erano state predisposte con deps iniettate).
- [ ] Test: heartbeat scritto solo su successo; scrittura fallita → nessuna eccezione e un log `warn`; `countJobs` separa active/stale e pulisce le voci vecchie; il job segna done anche se il sync di un conto lancia.
- [ ] Commit `feat(observability): heartbeat dei cron e job attivi/bloccati su Redis`.

### Task 7: strumentazione di GoCardless e dell'autenticazione, migrazione dei `console.*`

**File:** `lib/gocardless/client.ts`, `lib/gocardless/sync.ts`, `lib/gocardless/scheduler.ts`, `lib/sync-jobs/run.ts`, `lib/net-worth/scheduler.ts`, `lib/auth/index.ts`, le route GoCardless/sync-jobs con `console.*` ed `eslint.config.mjs`.

- [ ] **`client.ts`:** ogni `fetch` chiama `recordGoCardlessApiRequest(<template>, response.status)`, con il template passato dai chiamanti e **mai** il path con gli id. Bug pre-esistente da correggere: il messaggio di `GoCardlessError` interpola `response.text`, cioè la funzione, non il testo. Il messaggio diventa `GoCardless <template> ha risposto <status>`, senza il path reale con gli id di conto e senza il body.
- [ ] **`sync.ts` / `run.ts` / `scheduler.ts`:** `recordGoCardlessSync(trigger, outcome, durationMs)` (trigger: `finalize` e `manual` dal job, secondo `SyncJobKind` `initial-import` → `finalize`, `manual-sync` → `manual`; `cron` dallo scheduler). Poi `recordTransactionsImported(categorized, uncategorized)` dal `SyncResult` e il log `gocardless.sync.completed|limited|expired|failed` con `accountId`, `jobId`, `trigger`, `inserted`, `categorized`, `uncategorized`, `durationMs`. `runSyncJob` riceve un `log` opzionale nelle deps: le route passano `ctx.log.child({ jobId })`, così richiesta e job sono collegati da `requestId`.
- [ ] **`lib/auth/index.ts`:** `recordAuthEvent("magic_link_sent"|"magic_link_failed")` in `sendMagicLink` e log `auth.magic_link.failed` con `reason: error.name` (**mai** `error.message` di Resend, che può contenere l'indirizzo). `sign_in` da `databaseHooks.session.create.after` (verificare che l'hook esista nella versione installata di better-auth, altrimenti rimandarlo e annotarlo). `rate_limited`: se la configurazione rate limit di better-auth espone un hook, usarlo; altrimenti contare i 429 della route `auth` dalla metrica HTTP (già coperti da `status_class="4xx"` + log `warn`) e annotare la scelta.
- [ ] **Migrazione dei `console.*` rimanenti** fuori da `lib/db/*` (elenco di partenza: `grep -rn "console\." app lib components | grep -v "lib/db/"`): ciascuno diventa `logger.<level>("<dominio>.<oggetto>.<esito>", {...})`.
- [ ] **ESLint:**
  ```js
  { files: ["app/**", "lib/**", "components/**"], ignores: ["lib/db/**"], rules: { "no-console": "error" } }
  ```
  `pnpm lint` deve restare senza nuovi errori (i 2 pre-esistenti noti vanno verificati: se nel frattempo sono stati risolti, meglio).
- [ ] **Revisione manuale dei dati personali:** per ogni chiamata `logger.*` con `error` proveniente da GoCardless, Resend, postgres.js o better-auth, verificare quali stringhe può contenere quel messaggio. Annotare nel report del task i punti controllati.
- [ ] Commit `feat(observability): metriche GoCardless/auth e fine dei console.* nel codice server`.

### Task 8: eventi di prodotto Umami

**File:** creare `lib/analytics/track.ts`, `lib/analytics/index.ts` (+ test). Modificare i componenti/mutation che corrispondono agli eventi della spec.

- [ ] **`track.ts`:**
  ```ts
  export type ProductEvent =
    | { name: "onboarding_completed"; props: { currency: string } }
    | { name: "bank_connect_started"; props?: undefined }
    | { name: "bank_connect_completed"; props: { accounts: number } }
    | { name: "account_sync_manual"; props?: undefined }
    | { name: "transaction_added"; props: { direction: "entrata" | "uscita" } }
    | { name: "transaction_category_changed"; props: { source: "row" | "categorizza" } }
    | { name: "categorization_applied"; props: { groups: number } }
    | { name: "categorization_rule_saved"; props: { matchType: "merchant" | "contains" } }
    | { name: "transaction_split"; props?: undefined }
    | { name: "category_created"; props: { group: string } }
    | { name: "pwa_installed"; props?: undefined };
  export function track<E extends ProductEvent>(name: E["name"], props?: E["props"]): void;
  ```
  È no-op se `typeof window === "undefined"` o se `window.umami?.track` non esiste; qualunque eccezione del tracker viene ingoiata (l'analytics non deve mai rompere la UI).
- [ ] Chiamate negli `onSuccess` delle mutation TanStack Query corrispondenti (`lib/queries/*`) o nei componenti, dove l'informazione (direction, source) è disponibile. `pwa_installed`: listener `appinstalled` in un piccolo client component montato nel root layout.
- [ ] Test: no-op senza `window.umami`; inoltro di nome e props con un `umami` finto; eccezione del tracker ingoiata.
- [ ] Commit `feat(analytics): eventi di prodotto Umami tipizzati`.

### Task 9: documentazione

- [ ] `CLAUDE.md`, sezione "Principi di architettura": nuova sottosezione **"Osservabilità (standard)"** che riassume: logger al posto di `console.*` (bloccato da ESLint); cosa non va mai nei log e nelle label; `withRoute(name)` su ogni nuova route con nome statico; eventi `dominio.oggetto.esito`; metriche `buddybudget_*` con unità nel nome; `track()` per le azioni di prodotto, senza dati.
- [ ] `CLAUDE.md`: voce di log e aggiornamento di "Stato del progetto".
- [ ] `.env.local.example`: `METRICS_TOKEN=` e `LOG_LEVEL=` commentati con spiegazione.
- [ ] Commit `docs: standard di osservabilità e log Fase A`.

### Task 10: infra (repo `buddy-budget-infra`, 👤 UTENTE + chi esegue)

Da eseguire dopo il merge dell'app su `main` e il rollout (la CI aggiorna il tag immagine). Richiede l'accesso al repo infra e a `kubectl`: da una sessione che li abbia, o guidando l'utente.

- [ ] **👤 Segreto:** generare `METRICS_TOKEN` (`openssl rand -hex 32`), aggiungerlo cifrato SOPS a `app-secrets.enc.yaml` (namespace `app`) e a un nuovo secret `alloy-metrics-token` in `observability` (con `kustomization.yaml` + `generator.yaml` KSOPS **nello stesso commit**: lezione della dashboard Traefik e di Grafana).
- [ ] **Scrape Alloy:** `discovery.kubernetes "app_pods"` (role pod, namespace `app`, selettore `app=buddy-budget`) → `discovery.relabel` (porta 3000, path `/api/metrics`) → `prometheus.scrape "app"` con `bearer_token_file` dal secret montato e `scrape_interval = "30s"` → `prometheus.remote_write` già esistente.
- [ ] **Log Alloy:** nel pipeline `loki.process` aggiungere `stage.json { expressions = { level = "level" } }` + `stage.labels { values = { level = "" } }`, **solo** per lo stream dei pod `app=buddy-budget`. Nessun'altra label.
- [ ] **NetworkPolicy:** nel namespace `app`, `allow-observability-to-app`: da namespace `observability` (pod Alloy) verso i pod `app: buddy-budget` porta 3000. **Stesso commit** dello scrape.
- [ ] **RBAC Alloy:** verificare che il ClusterRole del chart permetta `list/watch pods` in `app` (per lo scrape di kube-state-metrics dovrebbe già esserci).
- [ ] **Verifica:**
  - in Grafana → Explore → VictoriaMetrics, `buddybudget_build_info` mostra due serie (due pod) col commit giusto;
  - `buddybudget_cron_last_success_timestamp_seconds` compare dopo il primo CronJob (o dopo un `kubectl create job --from=cronjob/...`);
  - in Loki, `{namespace="app", level="error"} | json` restituisce righe JSON;
  - un errore provocato (per esempio `curl` con un id malformato su una route che lancia, o un test temporaneo) compare filtrabile per `requestId`.
- [ ] **Umami:** fare un'azione (es. aggiungere una transazione) e verificare l'evento in Umami → Events.

### Task 11: chiusura

- [ ] `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test` e `pnpm build` puliti. `grep -rn "console\." app lib components | grep -v lib/db/` vuoto.
- [ ] PR verso `main`, CI verde, merge.
- [ ] Aggiornare la spec: stato "implementata" e deviazioni (es. `sign_in`/`rate_limited` se rimandati).

## Slack (preparazione per la Fase B, stato al 2026-09-27)

I canali `#bb-allarmi`, `#bb-avvisi`, `#bb-deploy` e `#bb-riepiloghi` sono stati creati (privati) nel workspace `buddybudget` via connettore Slack. Gli incoming webhook, uno per canale, sono stati creati dall'utente e salvati da lui: **non** vanno incollati in chat né committati in chiaro. In Fase B finiranno cifrati SOPS nel repo infra come contact point Grafana (`#bb-allarmi`/`#bb-avvisi`, instradati per `severity`) e come notifiche ArgoCD (`#bb-deploy`). Questa fase non li usa.
