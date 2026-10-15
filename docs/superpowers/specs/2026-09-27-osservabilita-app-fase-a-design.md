# App observability — Phase A: the app tells its own story — design

Date: 2026-09-27
Status: **approved by the user on 2026-09-27, app side implemented** (Tasks 1-9 of the plan `docs/superpowers/plans/2026-09-27-osservabilita-app-fase-a.md`; the infra work, Task 10, is missing). Deviations in the implementation: request context via AsyncLocalStorage (`requestLogger()`/`bindRequestUser()`) instead of `ctx.log`; `buddybudget_sync_jobs{state}` instead of `buddybudget_sync_jobs_active`/`_stale`; `rate_limited` counted on the 429s of the `auth` route.
Context: the observability tools already exist in the cluster (VPS migration Phase 5: VictoriaMetrics, Loki, Alloy, Grafana, Slack alerts, UptimeRobot; ArgoCD since Phase 3; Umami since Phase 6), but the app produces no useful signals: ~80 free-text `console.*` calls, no application metrics, no product events.

## Three-phase vision (this spec covers only A)

| Phase | What | Where | Outcome |
|------|------|------|-------|
| **A — the app tells its story** | structured logs, Prometheus metrics, cron heartbeats, Umami product events | app repo | the signals exist and have stable names |
| B — tools configured for a human | Grafana dashboards as code, alerts with runbooks, separate Slack channels, ArgoCD notifications, guide "how to tell if something is wrong" | infra repo + Slack | the user can read the app's state |
| C — access for agents | read-only MCP (Grafana, ArgoCD, Umami), service accounts per role, groundwork for Paperclip | outside the production VPS | agents with roles querying the same signals |

Intended order: an agent (C) is only as useful as the signals it reads (A) and the questions we already know how to ask (B). Phase A also comes before the cutover (VPS migration Phase 7): production isn't moved without being able to see whether the app is healthy.

## Goal of Phase A

Every relevant event in the app (API request, error, GoCardless sync, cron, background job, product action) produces a **structured signal, with a stable name, without personal data**, queryable from Loki (logs), VictoriaMetrics (metrics) and Umami (product events).

"Done" criterion:
- no `console.*` left in server code (except CLI scripts in `lib/db/*` that talk to a human terminal);
- `GET /api/metrics` (with token) returns the metrics listed below, verified with `curl` on dev and on the cluster;
- a deliberately triggered error shows up in Loki as a JSON line filterable by `event`, `requestId`, `level`;
- a cron run updates the "last success" metric, readable from any pod;
- product events show up in Umami → Events;
- unit tests for the logger (redaction), the route wrapper and the metrics registry.

## Decisions

1. **Own thin logger with typed fields** (`lib/observability/logger.ts`), not `pino`. It writes one JSON line per event to stdout/stderr. Reasons: the allowed fields are a closed TypeScript type (you can't pass "any object" that drags amounts or descriptions along), zero dependencies, no bundling issues with Next's `standalone` output (pino transports use worker threads). The format remains the standard one Loki/Grafana expect (JSON per line), so nothing non-transferable. If pino's performance or features are needed in the future, the replacement is internal to the module.
2. **Metrics with `prom-client`** (the standard Prometheus library for Node), singleton registry on `globalThis` (survives HMR in dev), default process metrics enabled (heap, event loop lag, GC, CPU).
3. **`/api/metrics` endpoint protected by a token** (`METRICS_TOKEN`, bearer, constant-time comparison like `CRON_SECRET`). **Optional** variable: if absent the endpoint responds 404 (not needed on Vercel). Defense in depth: even though the public IngressRoute routes all of `app.buddybudget.io`, nothing can be read without the token.
4. **Cron state on Redis, not in memory**: `prom-client` counters are per pod and reset on every restart, and the CronJob hits a random pod. "Cron X last succeeded at…" must therefore be written to Redis (`ops:heartbeat:<name>` → timestamp, no TTL) and read as a gauge at scrape time. This way the "cron hasn't run for 26h" alert (Phase B) is reliable with 2 replicas and survives rollouts.
5. **Wrapper for API routes** (`withRoute("transactions.list", handler)`) instead of logic in `proxy.ts`: the proxy sees neither the status nor the duration of the response. The name passed to the wrapper is a **static template** (never the real path with ids), so as not to blow up metric cardinality.
6. **Pseudonymized user identifier**: in logs `user` appears as the first 16 hex characters of `sha256(userId)`. Not reversible without the DB (ids are random UUIDs), recomputable by whoever has DB access for targeted debugging. Never in metric labels (cardinality).
7. **Umami: typed events, without data** — helper `track(event, props?)` with a closed union of event names and only categorical/boolean props (never amounts, names, descriptions, ids). No-op if the Umami script isn't loaded.
8. **Naming**: log events `domain.object.outcome` (e.g. `gocardless.sync.failed`), metrics with the `buddybudget_` prefix and the unit in the name (`_seconds`, `_total`).

## Components

### 1. Logger — `lib/observability/logger.ts`

```ts
logger.info("gocardless.sync.completed", { accountId, jobId, durationMs, inserted: 12 });
logger.error("cron.gocardless_sync.failed", { error });
const log = logger.child({ requestId, route: "transactions.list", user: hashUserId(session.user.id) });
```

Each line: `ts` (ISO), `level` (`debug|info|warn|error`), `event`, `service: "buddy-budget"`, `version`/`commit` (from `APP_BUILD_INFO`), plus the contextual fields.

Allowed fields (closed type `LogFields`): `requestId`, `route`, `method`, `status`, `durationMs`, `user` (already hashed), `accountId`, `jobId`, `connectionId`, `cron`, `phase`, `count`/named numeric counters (`inserted`, `categorized`, `uncategorized`, `processed`, `total`), `reason` (string enumerated by the caller), `error`.

`error` is serialized as `{ name, message, stack }` (stack only if `level` is `error`). The message of an external error can contain arbitrary text: the logger truncates `message` to 500 characters and applies redaction of known patterns (emails, IBANs, `Bearer …`, `token=`/`secret=` parameters in URLs). Redaction is a safety net, not the main mechanism: the main one is the closed type.

**Never in logs**: emails, names, IBANs, amounts, transaction descriptions/notes, merchant names, tokens/secrets, cookies, request bodies, plaintext `userId`. Rule to be carried over into `CLAUDE.md` ("Architecture principles" section).

Minimum level from `LOG_LEVEL` (optional, default `info`; `debug` in dev).

### 2. Route wrapper — `lib/observability/with-route.ts`

`withRoute(name, handler)` for every Route Handler in `app/api/**` (30 files today):
- generates or reuses `requestId` (`x-request-id` header if present and valid, otherwise a UUID) and sends it back in the response;
- measures the duration; at the end logs `http.request.completed` (`info` for 2xx/3xx/expected 4xx, `warn` for 429, `error` for 5xx) — the `/api/health*` probes and the `/api/metrics` scrape log only if they fail, so as not to flood Loki;
- catches unhandled exceptions: logs `http.request.failed` with `error`, generic 500 response (no details to the client);
- updates `buddybudget_http_requests_total{route,method,status_class}` and `buddybudget_http_request_duration_seconds{route,method}`.
- exposes the child logger to the handler (`ctx.log`) so domain logs inside the request inherit `requestId`/`route`/`user`.

Work in `after()` (sync jobs) receives a child logger with `requestId` and `jobId`, so the request that started the job and the job itself can be correlated in Loki.

### 3. Uncaught errors — `instrumentation.ts`

Addition of `onRequestError` (Next.js hook) that logs `next.request_error` with path template, route type (page/route/action) and `error`. It covers errors in Server Components and pages that don't go through the wrapper.

### 4. Metrics — `lib/observability/metrics.ts` + `app/api/metrics/route.ts`

| Metric | Type | Labels | Used for |
|---|---|---|---|
| `buddybudget_http_requests_total` | counter | `route`, `method`, `status_class` | error rate per route |
| `buddybudget_http_request_duration_seconds` | histogram | `route`, `method` | p50/p95 latencies |
| `buddybudget_gocardless_sync_total` | counter | `trigger` (`manual`/`cron`/`finalize`), `outcome` (`synced`/`limited`/`expired`/`error`) | failed or limited syncs |
| `buddybudget_gocardless_sync_duration_seconds` | histogram | `trigger` | slow syncs |
| `buddybudget_gocardless_api_requests_total` | counter | `endpoint` (template), `status_class` | health of the external API, 429s |
| `buddybudget_transactions_imported_total` | counter | `categorized` (`true`/`false`) | yield of automatic categorization |
| `buddybudget_sync_jobs` | gauge (read from Redis at scrape) | `state` (`active`/`stale`) | running jobs / jobs with expired heartbeat |
| `buddybudget_cron_last_success_timestamp_seconds` | gauge (read from Redis at scrape) | `cron` | "did the cron run?" |
| `buddybudget_cron_runs_total` | counter | `cron`, `outcome` | cron failures |
| `buddybudget_auth_events_total` | counter | `event` (`magic_link_sent`/`magic_link_failed`/`sign_in`/`rate_limited`) | login/email problems |
| `buddybudget_dependency_up` | gauge (at scrape, 2s timeout) | `dependency` (`postgres`/`redis`) | reuses `lib/health/readiness.ts` |
| `buddybudget_build_info` | gauge = 1 | `version`, `commit` | which version runs on each pod |
| default process metrics | — | — | memory, event loop lag |

No high-cardinality labels (user id, account id, real paths). The gauges "read from Redis" are computed with `prom-client`'s `collect()` at scrape time: if Redis doesn't respond, the gauge is not emitted (missing data, manageable in alerts with `absent()`), never a made-up value.

`/api/metrics`: added to the public paths of `proxy.ts` (like `/api/cron`, protected by its own token), `dynamic = "force-dynamic"`, `Cache-Control: no-store`, Prometheus content-type.

### 5. Cron heartbeat — `lib/observability/heartbeat.ts`

`recordCronRun(name, outcome, durationMs)`: increments `buddybudget_cron_runs_total`, logs `cron.<name>.completed|failed`, and only on success writes `ops:heartbeat:cron:<name>` = epoch to Redis. Redis write errors are logged (`warn`) but don't make the cron fail.

### 6. Umami product events — `lib/analytics/track.ts`

Initial events (all client-side, after the successful outcome of the corresponding mutation):

| Event | Allowed props |
|---|---|
| `onboarding_completed` | `currency` (ISO code) |
| `bank_connect_started` | — |
| `bank_connect_completed` | `accounts` (count) |
| `account_sync_manual` | — |
| `transaction_added` | `direction` (`entrata`/`uscita`) |
| `transaction_category_changed` | `source` (`row`/`categorizza`) |
| `categorization_applied` | `groups` (count) |
| `categorization_rule_saved` | `matchType` |
| `transaction_split` | — |
| `category_created` | `group` |
| `pwa_installed` | — (`appinstalled` event) |

Closed type `ProductEvent` = union of the names with typed props for each. No amounts, names, ids.

### 7. Migration of existing `console.*` calls

Every `console.error/warn/log` in server code becomes a logger call with a named `event` (e.g. `"Sync fallito per il conto X"` ("Sync failed for account X") → `logger.error("gocardless.sync.failed", { accountId, error })`). `console.*` remains only in the CLI scripts `lib/db/*.ts` (output for a human at the terminal). ESLint rule `no-console` active on `app/`, `lib/` (excluding the `lib/db/*` CLI scripts) and `components/`, so regressions are blocked in CI.

### 8. New environment variables (optional)

- `METRICS_TOKEN` — min 32 characters; absent ⇒ `/api/metrics` responds 404.
- `LOG_LEVEL` — `debug|info|warn|error`, default `info`.

Added to `serverEnvSchema` as optional (the app on Vercel keeps starting without them).

## Infra-side work (runbook in the `buddy-budget-infra` repo, part of the plan but carried out there)

- SOPS-encrypted `METRICS_TOKEN` Secret in the `app` namespace (app env) and in the `observability` namespace (for Alloy).
- Alloy: `discovery.kubernetes` on the `app: buddy-budget` pods + `prometheus.scrape` of `/api/metrics` with `bearer_token_file`, 30s interval → `remote_write` to VictoriaMetrics (the same chain that already exists).
- Alloy logs: `stage.json` + `stage.labels` to promote **only** `level` to a Loki label (low cardinality); the rest is queried with `| json` in LogQL.
- NetworkPolicy: exception `observability` → app pod port 3000 in the `app` namespace (default-deny already active — same lesson as Tailscale/CNPG: it goes in the same commit as the scrape).

## Slack channels (preparation for Phase B, decided now)

User's choice: separate channels per type of message.

| Channel | Content | Expected noise |
|---|---|---|
| `#bb-allarmi` | `severity=critical` alerts: app down, high 5xx rate, failed backup, disk almost full | rare, looked at immediately |
| `#bb-avvisi` | `severity=warning` alerts: cron not run, repeated failed syncs, high latencies, GoCardless rate limit | a few times a week |
| `#bb-deploy` | ArgoCD notifications (deploy succeeded/failed, app out of sync) and CI | on every merge |
| `#bb-riepiloghi` | periodic summaries (in future: reports from the Phase C agents) | daily/weekly |

In Grafana each channel becomes a contact point (one webhook per channel); the notification policy routes by the `severity` label. **Status (2026-09-27):** the four channels have been created as **private** in the `buddybudget` workspace via the Slack connector (connected by the user after the spec was drafted), each with a message explaining its purpose. The incoming webhooks, one per channel, were created by the user and are kept by them: they will end up SOPS-encrypted in the infra repo in Phase B, never in plaintext in chat or in the repo.

## Out of scope, knowingly

- **Distributed tracing (OpenTelemetry/Tempo)**: with a single service and one DB, `requestId` in the logs already gives the needed correlation; Tempo would cost RAM on an 8 GB VPS. To be reconsidered if more services arrive.
- **Dedicated error tracking (Sentry/GlitchTip)**: errors end up in Loki with stack and context; an alert on `level=error` covers the need. Self-hosted GlitchTip remains an option if the error volume makes grouping useful.
- **Real User Monitoring / Web Vitals**: deferred; possibly via Umami or a dedicated endpoint in Phase B.
- **Sensitive business metrics** (total amounts, number of transactions per user): never as metrics; if analysis is needed, it's done on the DB, not in the observability system that agents will also read.
- **Dashboards, alerts, log-reading guide, ArgoCD notifications**: Phase B.
- **MCP and agents**: Phase C.

## Risks and caveats

- **Cardinality**: a wrong label (real path, id) can make VictoriaMetrics grow without limit. Mitigation: static route names passed by hand to the wrapper, a test that checks for the absence of UUID patterns in registered route names.
- **Log noise**: probes and scrapes every 10-30s for 2 pods. Mitigation: logged only if they fail.
- **Vercel until the cutover**: JSON logs work there too (shown in Runtime Logs), `/api/metrics` stays off (no `METRICS_TOKEN`). No regression.
- **Personal data in external error messages** (e.g. GoCardless errors echoing parameters): truncation + redaction in the logger, and manual review of the places that log errors from external libraries during implementation.
