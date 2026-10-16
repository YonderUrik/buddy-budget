# App observability, Phase A: the app tells its own story (implementation plan)

> **For the executor:** recommended skill `superpowers:subagent-driven-development` (or `superpowers:executing-plans` inline). Steps use checkboxes (`- [x]`). Steps marked **👤 USER** require an action from the user (panels, password manager, cluster): the executor explains what it does and why, waits for the output and verifies it before moving on.

**Goal:** every relevant app event (API request, error, GoCardless sync, cron, background job, product action) produces a structured signal, with a stable name and no personal data. It can be queried from Loki (logs), VictoriaMetrics (metrics) and Umami (product events).

**Architecture:** a `lib/observability/` module with no UI dependencies:
- `logger` with typed fields, one JSON line on stdout/stderr;
- `metrics` with a singleton `prom-client` registry;
- `withRoute` wrapping every Route Handler (requestId, duration, status, exceptions);
- cron `heartbeat` on Redis.

Client-side, `lib/analytics/track.ts` sends typed events to Umami. `GET /api/metrics` exposes the metrics with an optional bearer token (without a token it responds 404: on Vercel it stays off). On the infra side (`buddy-budget-infra` repo), Alloy scrapes the app pods and promotes `level` to a Loki label.

**Tech stack:** Next.js 16 (Route Handlers, `after()`, `instrumentation.ts` `onRequestError`), `prom-client`, ioredis, Zod 4, Vitest 4, ESLint flat config, Umami tracker (`window.umami.track`), Grafana Alloy.

**Spec:** `docs/superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md`.

**Branch:** `claude/amazing-hamilton-zbn0d1`, brought to `main` with a PR (CI verifies it).

**Status (2026-09-27):** Tasks 1-9 completed (deviations in the `CLAUDE.md` log and in the spec header). Task 10 done in the infra PR YonderUrik/buddy-budget-infra#3 (token in two separate secrets `app-metrics-token`/`alloy-metrics-token` instead of adding it to `app-secrets.enc.yaml`: that file is encrypted as a whole and can only be edited with the private age key). To do: Task 11, i.e. merge (first YonderUrik/buddy-budget#13, then the infra) and the checklist on the cluster.

## Global constraints

- **Never in logs and never in metric labels:** emails, names, IBANs, amounts, transaction descriptions/notes, merchant names, tokens/secrets, cookies, request bodies, plaintext `userId`. The user appears in logs only as `user` = first 16 hex chars of `sha256(userId)` and never in a label.
- **Static route names** passed by hand to `withRoute` (e.g. `"transactions.update"`), never the real path: this keeps metric cardinality under control.
- `LogFields` is a **closed type**: no `Record<string, unknown>` in the public logger.
- The new variables (`METRICS_TOKEN`, `LOG_LEVEL`) are **optional**: the app on Vercel must keep starting exactly as before.
- No DB schema change (no migration in this plan).
- "Long-running operations" standard unchanged: the sync job stays in `after()`. It only receives a child logger.
- Comments, JSDoc and texts in Italian; minimal JSDoc on every public export; `lib/observability/index.ts` barrel.
- `console.*` remains allowed **only** in the CLI scripts `lib/db/*.ts` (not imported by the app).

## Review focus

1. **Personal data leaking into logs.** The main risk is error messages from external libraries: GoCardless reports paths with account ids, Resend the email address, postgres.js sometimes the parameters. Coverage: closed type, redaction tests (email, IBAN, Bearer, `token=`/`secret=`), truncation at 500 characters and manual review of the places that log `error` from external libraries (Task 7).
2. **Cardinality explosion.** Coverage: a test that fails if a registered route name contains a UUID, a number or `/`. Labels are only closed enums.
3. **The wrapper changes route behaviour.** Status, headers and body must stay identical, including the GoCardless callback redirects and better-auth responses. Coverage: wrapper tests on a pass-through response and on an exception, then a full `pnpm test` after applying it to the 30 routes.
4. **Gauges "read from Redis" that invent values.** If Redis does not respond, the gauge is not emitted (no fake 0). Coverage: test with a fake Redis that throws.
5. **`/api/metrics` exposed without protection.** Coverage: tests for 404 without `METRICS_TOKEN`, 401 with a wrong token, 200 with the right token; constant-time comparison (reuse of `isAuthorizedCronRequest`).

---

### Task 1: structured logger

**File:** create `lib/observability/logger.ts`, `lib/observability/redact.ts`, `lib/observability/user-hash.ts`, `lib/observability/index.ts` and the related `*.test.ts`. Modify `lib/env.ts` (+ test).

- [x] **Env:** add to `serverEnvSchema` `LOG_LEVEL: z.enum(["debug","info","warn","error"]).optional()` and `METRICS_TOKEN: z.string().min(CRON_SECRET_MIN_LENGTH).optional()`. Tests: env without the two variables is valid; a short `METRICS_TOKEN` is invalid and reported by name.
- [x] **`redact.ts`:** `redactText(s: string): string`. Replaces emails → `[email]`, IBANs (`/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/`) → `[iban]`, `Bearer <x>` → `Bearer [redacted]`, `(token|secret|code|access|refresh)=<x>` → `$1=[redacted]`, UUIDs → `[id]`, and truncates at `MAX_ERROR_MESSAGE_LENGTH = 500`. One test per pattern plus a "harmless text unchanged" case.
- [x] **`user-hash.ts`:** `hashUserId(id: string): string` = first 16 hex chars of `sha256` (`node:crypto`). Tests: deterministic, length 16, different for different ids.
- [x] **`logger.ts`:**
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
  export const logger: Logger; // level from process.env.LOG_LEVEL, default "info" ("debug" if NODE_ENV=development)
  ```
  Every line contains `ts`, `level`, `event`, `service: "buddy-budget"`, `version`/`commit` from `APP_BUILD_INFO`, plus the fields. `error` is serialized into `{ name, message: redactText(message), stack? }`; the stack only at `error` level, also passed through `redactText`. A non-Error value becomes `{ message: redactText(String(x)) }`. `warn`/`error` go to stderr, the others to stdout. `JSON.stringify` is guarded: a non-serializable field does not make the logger throw.
- [x] **Logger tests** (fake writer): minimum level respected; `child` inherits and overrides; `error` redacted and truncated; stack absent at `warn`; no exception with a circular reference inside `error.cause`.
- [x] **Barrel** `lib/observability/index.ts`, then `pnpm test lib/observability lib/env.test.ts` and `pnpm tsc --noEmit`.
- [x] Commit `feat(observability): logger JSON a campi tipizzati con redazione`.

### Task 2: metrics registry and `/api/metrics` endpoint

**File:** create `lib/observability/metrics.ts` (+ test) and `app/api/metrics/route.ts` (+ test). Modify `proxy.ts` (+ test) and `package.json`.

- [x] `pnpm add prom-client`.
- [x] **`metrics.ts`:** singleton registry on `globalThis.__bbMetrics` (survives HMR). The first access calls `collectDefaultMetrics({ register, prefix: "buddybudget_process_" })` and creates the metrics in the spec's table: counters and histograms with the indicated labels and duration buckets `[0.05,0.1,0.25,0.5,1,2.5,5,10,30,60,120,300]`. `buddybudget_build_info{version,commit} 1`. Domain functions are exported instead of the raw prom-client objects (so labels stay a typed enum):
  - `recordHttpRequest(route, method, status, durationMs)` (`status_class` = `"2xx"`…`"5xx"`);
  - `recordGoCardlessSync(trigger: "manual"|"cron"|"finalize", outcome: "synced"|"limited"|"expired"|"error", durationMs)`;
  - `recordGoCardlessApiRequest(endpoint: GoCardlessEndpoint, status)`, with `GoCardlessEndpoint` an enum of the templates (`"token.new"`, `"institutions.list"`, `"requisitions.create"`, `"requisitions.get"`, `"accounts.details"`, `"accounts.balances"`, `"accounts.transactions"`);
  - `recordTransactionsImported(categorized: number, uncategorized: number)`;
  - `recordCronRun(cron: CronName, outcome: "success"|"error")`;
  - `recordAuthEvent(event: "magic_link_sent"|"magic_link_failed"|"sign_in"|"rate_limited")`.
- [x] **Async gauges** (`collect()`) registered with `registerAsyncGauges(deps)`:
  - `buddybudget_dependency_up{dependency}`: reuses `checkReadiness`;
  - `buddybudget_cron_last_success_timestamp_seconds{cron}`, `buddybudget_sync_jobs_active`, `buddybudget_sync_jobs_stale`: read from Redis through injected functions.

  If a read throws, the gauge emits nothing for that scrape (`gauge.reset()` without `set`).
- [x] **Tests** (`register.metrics()` on the text): every function increments the expected series; async gauge with a throwing dependency → metric without samples; **cardinality test**: `recordHttpRequest` rejects, with a `throw` in dev/test and a `warn` log in production, a route name matching `/[0-9a-f]{8}-|\/|\d{3,}/`.
- [x] **`app/api/metrics/route.ts`:** `dynamic = "force-dynamic"`.
  - `process.env.METRICS_TOKEN` missing → 404;
  - `isAuthorizedCronRequest(header, METRICS_TOKEN)` false → 401;
  - otherwise 200 with `register.metrics()`, `Content-Type: register.contentType` and `Cache-Control: no-store`.

  Tests on the three cases.
- [x] **`proxy.ts`:** add `"/api/metrics"` to `PUBLIC_PATH_PREFIXES`, with a test in `proxy.test.ts` (or in the existing one) that `/api/metricsx` is not public.
- [x] Verification: `pnpm test`, `pnpm tsc --noEmit`. Then `pnpm dev` with `METRICS_TOKEN` in `.env.local` and `curl -H "Authorization: Bearer $METRICS_TOKEN" localhost:3000/api/metrics | grep buddybudget_`.
- [x] Commit `feat(observability): metriche Prometheus e /api/metrics protetto da token`.

### Task 3: `withRoute` wrapper

**File:** create `lib/observability/with-route.ts` (+ test).

- [x] Signature:
  ```ts
  export interface RouteContext { requestId: string; log: Logger }
  export function withRoute<A extends unknown[]>(
    name: string,
    handler: (request: Request, ...rest: [...A, RouteContext]) => Promise<Response> | Response,
    opts?: { quietOnSuccess?: boolean }
  ): (request: Request, ...rest: A) => Promise<Response>;
  ```
  The `RouteContext` goes **at the end** of the original arguments, so dynamic routes (`{ params }`) keep the signature Next.js sees unchanged.
- [x] Behaviour:
  - `requestId` = the `x-request-id` header if it matches `/^[A-Za-z0-9-]{8,64}$/`, otherwise `crypto.randomUUID()`;
  - `log = logger.child({ requestId, route: name, method })`;
  - the handler is run and yields a response; the `x-request-id` header is added to the response by cloning the headers only if they are mutable, otherwise `new Response(body, …)`, **without changing status or body**;
  - `http.request.completed` log with `status` and `durationMs`: `info` level for <400, `info` for 4xx except 429 (`warn`), `error` for 5xx; with `quietOnSuccess` it does not log below 400;
  - exception → `http.request.failed` log (`error`) and response `Response.json({ error: "Errore interno" }, { status: 500 })`;
  - always `recordHttpRequest`.
- [x] The user: helper `withUser(log, userId)` = `log.child({ user: hashUserId(userId) })`, called by the routes after reading the session. The wrapper does not read the session: not all routes are authenticated and we do not want an extra query.
- [x] Tests: pass-through 200 response with original body/status/headers plus `x-request-id`; valid `x-request-id` reused, invalid one regenerated; throwing handler → generic 500 and a log line with redacted `error`; `quietOnSuccess` does not log the 200 but logs the 503; `recordHttpRequest` called with the correct `status_class`; 307 redirect (`Response.redirect`, immutable headers) stays 307 with `Location` intact.
- [x] Commit `feat(observability): wrapper withRoute per i Route Handler`.

### Task 4: apply `withRoute` to the 30 routes

**File:** all `app/api/**/route.ts`.

- [x] Naming convention: `<resource>.<action>` from the path and the method, for example:

  | Route | Name |
  |---|---|
  | `GET /api/transactions` | `transactions.list` |
  | `PATCH /api/transactions/[id]` | `transactions.update` |
  | `POST /api/gocardless/connections/[id]/finalize` | `gocardless.connections.finalize` |
  | `GET /api/cron/gocardless-sync` | `cron.gocardless_sync` |
  | `GET\|POST /api/auth/[...all]` | `auth` (a single name: better-auth's sub-routes do not go into labels) |

  Health, ready and metrics use `quietOnSuccess: true`.
- [x] In authenticated routes use `withUser(ctx.log, session.user.id)` for the domain logs inside the request.
- [x] Example (`app/api/transactions/[id]/route.ts`):
  ```ts
  export const PATCH = withRoute("transactions.update", async (request, { params }: { params: Promise<{ id: string }> }, ctx) => { … });
  ```
- [x] Check type compatibility with Next.js 16 (the route type validators generated in `.next/types`) with `pnpm build`. If a wrapped export does not pass Next's type check, declare the type of the second argument explicitly as in the example.
- [x] Full `pnpm test`: the existing route tests must pass without changes to the assertions. If a test calls the handler with a single argument, the wrapper must work with an empty `rest`.
- [x] Commit `refactor(api): tutte le route passano da withRoute`.

### Task 5: uncaught errors (`onRequestError`)

**File:** modify `instrumentation.ts`.

- [x] Add
  ```ts
  export async function onRequestError(error: unknown, request: { path: string; method: string }, context: { routerKind: string; routePath: string; routeType: string }) {
    const { logger } = await import("@/lib/observability");
    logger.error("next.request_error", { route: context.routePath, method: request.method, reason: context.routeType, error });
  }
  ```
  `routePath` (the template, e.g. `/transazioni`) is used, not `request.path` (it may contain a query).
- [x] Manual check on `pnpm dev`: a server page that (temporarily) throws produces a `next.request_error` JSON line. Then the throw is removed.
- [x] Commit `feat(observability): log degli errori non intercettati via onRequestError`.

### Task 6: cron heartbeat and gauges from Redis

**File:** create `lib/observability/heartbeat.ts` and `lib/observability/ops-store.ts` (+ test). Modify the two cron routes, `lib/sync-jobs/run.ts` and the gauge registration in `metrics.ts`.

- [x] **`ops-store.ts`** (on an injectable KV interface, like `SyncJobKv`, with a Redis implementation and an in-memory implementation for tests):
  - `setCronSuccess(cron, epochSeconds)` → `SET ops:heartbeat:cron:<cron>` without TTL;
  - `getCronSuccesses(): Promise<Record<CronName, number | null>>`;
  - `markJobRunning(jobId, now)` → `ZADD ops:sync-jobs:running now jobId`, `touchJob` likewise;
  - `markJobDone(jobId)` → `ZREM`;
  - `countJobs(now) → { active, stale }`: `stale` = score < now − `SYNC_JOB_STALE_MS`, `active` = the rest. It first cleans up with `ZREMRANGEBYSCORE` the entries older than `SYNC_JOB_TTL_SECONDS`.
- [x] **`heartbeat.ts`:** `recordCronRun(cron, outcome, durationMs, deps)`. Calls the metrics' `recordCronRun` and logs `cron.<cron>.completed|failed`. On success it runs `setCronSuccess`; if the Redis write fails it logs a `warn` `cron.heartbeat.write_failed` without rethrowing.
- [x] **Cron routes:** `runDueSyncs()` and `runDailySnapshots()` in try/catch with `recordCronRun`. They replace the `console.error`.
- [x] **`run.ts`:** `markJobRunning` when `runSyncJob` starts, `touchJob` at every already existing heartbeat, `markJobDone` in `finally`. Errors in these three steps are logged and do not interrupt the job.
- [x] Async gauges wired to `getCronSuccesses`/`countJobs` (in Task 2 they had been prepared with injected deps).
- [x] Tests: heartbeat written only on success; failed write → no exception and a `warn` log; `countJobs` separates active/stale and cleans up old entries; the job marks done even if the sync of an account throws.
- [x] Commit `feat(observability): heartbeat dei cron e job attivi/bloccati su Redis`.

### Task 7: instrumenting GoCardless and authentication, migrating `console.*`

**File:** `lib/gocardless/client.ts`, `lib/gocardless/sync.ts`, `lib/gocardless/scheduler.ts`, `lib/sync-jobs/run.ts`, `lib/net-worth/scheduler.ts`, `lib/auth/index.ts`, the GoCardless/sync-jobs routes with `console.*` and `eslint.config.mjs`.

- [x] **`client.ts`:** every `fetch` calls `recordGoCardlessApiRequest(<template>, response.status)`, with the template passed by the callers and **never** the path with the ids. Pre-existing bug to fix: the `GoCardlessError` message interpolates `response.text`, i.e. the function, not the text. The message becomes `GoCardless <template> ha risposto <status>` ("GoCardless <template> responded <status>"), without the real path with account ids and without the body.
- [x] **`sync.ts` / `run.ts` / `scheduler.ts`:** `recordGoCardlessSync(trigger, outcome, durationMs)` (trigger: `finalize` and `manual` from the job, according to `SyncJobKind` `initial-import` → `finalize`, `manual-sync` → `manual`; `cron` from the scheduler). Then `recordTransactionsImported(categorized, uncategorized)` from the `SyncResult` and the log `gocardless.sync.completed|limited|expired|failed` with `accountId`, `jobId`, `trigger`, `inserted`, `categorized`, `uncategorized`, `durationMs`. `runSyncJob` receives an optional `log` in its deps: routes pass `ctx.log.child({ jobId })`, so request and job are linked by `requestId`.
- [x] **`lib/auth/index.ts`:** `recordAuthEvent("magic_link_sent"|"magic_link_failed")` in `sendMagicLink` and an `auth.magic_link.failed` log with `reason: error.name` (**never** Resend's `error.message`, which may contain the address). `sign_in` from `databaseHooks.session.create.after` (check that the hook exists in the installed version of better-auth, otherwise defer it and note it). `rate_limited`: if better-auth's rate limit configuration exposes a hook, use it; otherwise count the 429s of the `auth` route from the HTTP metric (already covered by `status_class="4xx"` + `warn` log) and note the choice.
- [x] **Migration of the remaining `console.*`** outside `lib/db/*` (starting list: `grep -rn "console\." app lib components | grep -v "lib/db/"`): each one becomes `logger.<level>("<domain>.<object>.<outcome>", {...})`.
- [x] **ESLint:**
  ```js
  { files: ["app/**", "lib/**", "components/**"], ignores: ["lib/db/**"], rules: { "no-console": "error" } }
  ```
  `pnpm lint` must stay free of new errors (the 2 known pre-existing ones must be checked: if they have been fixed in the meantime, all the better).
- [x] **Manual review of personal data:** for every `logger.*` call with an `error` coming from GoCardless, Resend, postgres.js or better-auth, check which strings that message can contain. Note the checked places in the task report.
- [x] Commit `feat(observability): metriche GoCardless/auth e fine dei console.* nel codice server`.

### Task 8: Umami product events

**File:** create `lib/analytics/track.ts`, `lib/analytics/index.ts` (+ test). Modify the components/mutations corresponding to the spec's events.

- [x] **`track.ts`:**
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
  It is a no-op if `typeof window === "undefined"` or if `window.umami?.track` does not exist; any tracker exception is swallowed (analytics must never break the UI).
- [x] Calls in the `onSuccess` of the corresponding TanStack Query mutations (`lib/queries/*`) or in the components, where the information (direction, source) is available. `pwa_installed`: `appinstalled` listener in a small client component mounted in the root layout.
- [x] Tests: no-op without `window.umami`; forwarding of name and props with a fake `umami`; tracker exception swallowed.
- [x] Commit `feat(analytics): eventi di prodotto Umami tipizzati`.

### Task 9: documentation

- [x] `CLAUDE.md`, "Principi di architettura" (Architecture principles) section: a new **"Osservabilità (standard)"** ("Observability (standard)") subsection summarising: logger instead of `console.*` (blocked by ESLint); what never goes into logs and labels; `withRoute(name)` on every new route with a static name; `domain.object.outcome` events; `buddybudget_*` metrics with the unit in the name; `track()` for product actions, without data.
- [x] `CLAUDE.md`: log entry and update of "Stato del progetto" (Project status).
- [x] `.env.local.example`: `METRICS_TOKEN=` and `LOG_LEVEL=` commented out with an explanation.
- [x] Commit `docs: standard di osservabilità e log Fase A`.

### Task 10: infra (`buddy-budget-infra` repo, 👤 USER + executor)

To be run after the app is merged to `main` and rolled out (CI updates the image tag). Requires access to the infra repo and to `kubectl`: from a session that has them, or by guiding the user.

- [ ] **👤 Secret:** generate `METRICS_TOKEN` (`openssl rand -hex 32`), add it SOPS-encrypted to `app-secrets.enc.yaml` (namespace `app`) and to a new secret `alloy-metrics-token` in `observability` (with KSOPS `kustomization.yaml` + `generator.yaml` **in the same commit**: lesson from the Traefik dashboard and from Grafana).
- [ ] **Alloy scrape:** `discovery.kubernetes "app_pods"` (role pod, namespace `app`, selector `app=buddy-budget`) → `discovery.relabel` (port 3000, path `/api/metrics`) → `prometheus.scrape "app"` with `bearer_token_file` from the mounted secret and `scrape_interval = "30s"` → the already existing `prometheus.remote_write`.
- [ ] **Alloy logs:** in the `loki.process` pipeline add `stage.json { expressions = { level = "level" } }` + `stage.labels { values = { level = "" } }`, **only** for the stream of the `app=buddy-budget` pods. No other label.
- [ ] **NetworkPolicy:** in the `app` namespace, `allow-observability-to-app`: from the `observability` namespace (Alloy pod) to the `app: buddy-budget` pods on port 3000. **Same commit** as the scrape.
- [ ] **Alloy RBAC:** check that the chart's ClusterRole allows `list/watch pods` in `app` (for the kube-state-metrics scrape it should already be there).
- [ ] **Verification:**
  - in Grafana → Explore → VictoriaMetrics, `buddybudget_build_info` shows two series (two pods) with the right commit;
  - `buddybudget_cron_last_success_timestamp_seconds` appears after the first CronJob (or after a `kubectl create job --from=cronjob/...`);
  - in Loki, `{namespace="app", level="error"} | json` returns JSON lines;
  - a provoked error (for example `curl` with a malformed id on a route that throws, or a temporary test) shows up, filterable by `requestId`.
- [ ] **Umami:** perform an action (e.g. add a transaction) and check the event in Umami → Events.

### Task 11: wrap-up

- [ ] `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test` and `pnpm build` clean. `grep -rn "console\." app lib components | grep -v lib/db/` empty.
- [ ] PR to `main`, green CI, merge.
- [ ] Update the spec: status "implemented" and deviations (e.g. `sign_in`/`rate_limited` if deferred).

## Slack (preparation for Phase B, status as of 2026-09-27)

The channels `#bb-allarmi`, `#bb-avvisi`, `#bb-deploy` and `#bb-riepiloghi` (alarms, warnings, deploy, summaries) were created (private) in the `buddybudget` workspace via the Slack connector. The incoming webhooks, one per channel, were created by the user and saved by them: they must **not** be pasted into the chat nor committed in plain text. In Phase B they will end up SOPS-encrypted in the infra repo as Grafana contact points (`#bb-allarmi`/`#bb-avvisi`, routed by `severity`) and as ArgoCD notifications (`#bb-deploy`). This phase does not use them.
