# Server-only & infrastructure endpoints

Feature area(s): none (operations). Listed so mobile developers know what NOT to call.
Source: `app/api/cron/*/route.ts`, `app/api/metrics/route.ts`, `app/api/health/route.ts`, `app/api/health/ready/route.ts`, `app/api/auth/[...all]/route.ts`

All prefixes below are public in the proxy (`/api/cron`, `/api/metrics`, `/api/health`, `/api/auth`): no session gate; the cron/metrics routes check their own secret.

## Endpoints

| Method | Path | Purpose | Auth | Mobile |
|---|---|---|---|---|
| GET | `/api/cron/gocardless-sync` | Auto-sync bank accounts that are due (route `cron.gocardless_sync`) | `Authorization: Bearer <CRON_SECRET>` | **never call** |
| GET | `/api/cron/gocardless-maintenance` | Mark expired consents, email renew reminders, clean GoCardless requisitions (`cron.gocardless_maintenance`) | CRON_SECRET | **never call** |
| GET | `/api/cron/market-prices` | Prices, FX, inflation, €STR, profiles, dividends, price alerts (`cron.market_prices`) | CRON_SECRET | **never call** |
| GET | `/api/cron/net-worth-snapshot` | Daily net-worth snapshots for all users (`cron.net_worth_snapshot`) | CRON_SECRET | **never call** |
| GET | `/api/cron/notifications` | Digest / budget / deadline / goal emails (`cron.notifications`) | CRON_SECRET | **never call** |
| GET | `/api/cron/account-deletion` | Purge deactivated accounts past grace + expired sessions/verifications (`cron.account_deletion`) | CRON_SECRET | **never call** |
| GET | `/api/cron/inactive-accounts` | Warn (83 d) / delete (90 d) inactive accounts (`cron.inactive_accounts`) | CRON_SECRET | **never call** |
| GET | `/api/metrics` | Prometheus scrape (`metrics`) | `Authorization: Bearer <METRICS_TOKEN>`; 404 if `METRICS_TOKEN` unset | **never call** |
| GET | `/api/health` | Liveness (`health.live`) | public | may use for reachability |
| GET | `/api/health/ready` | Readiness: Postgres + Redis (`health.ready`) | public | may use for "service degraded" banner |
| GET, POST | `/api/auth/*` | better-auth handler (`toNextJsHandler(auth)`, single route name `auth`; counts 429s from better-auth's built-in rate limiter) | public | yes — see auth spec |

## Cron routes
- Auth: `isAuthorizedCronRequest` — exact constant-time match of `Authorization: Bearer <CRON_SECRET>` (secret ≥ 32 chars; missing/short secret always rejects). Failure → `401` empty.
- Responses: `200 { ok: true, durationMs, ...counts }` / `500 { ok: false }` (some include result counters). All `maxDuration = 300`, `dynamic = "force-dynamic"`.
- Mobile must never call them (no secret on devices). Their effects are visible to the app indirectly (new transactions, `expired` connections, snapshots, emails).

## GET /api/metrics
Prometheus text format (`Content-Type` from prom-client registry), `Cache-Control: no-store`. `404` empty when `METRICS_TOKEN` is not configured; `401` empty on wrong token. Never call from mobile.

## GET /api/health
Route name: `health.live` · public · `Cache-Control: no-store`

**Response** `200`
```ts
interface Health { status: "ok"; version: string; commit: string; builtAt: string }  // build info; commit/builtAt may be ""
```
```json
{ "status": "ok", "version": "0.42.0", "commit": "abc1234def…", "builtAt": "2026-10-17T21:00:00.000Z" }
```
Does not touch DB/Redis. Useful for a reachability check and for logging which server build the app talks to (min-version checks could use `version`, but no compatibility contract exists — unverified/gap).

## GET /api/health/ready
Route name: `health.ready` · public · `Cache-Control: no-store`

**Response** `200` or `503` with
```ts
interface Readiness { ready: boolean; checks: { database: "ok" | "error"; redis: "ok" | "error" } }
```
Each probe has a 2 s timeout. Mobile may use a 503 here to show "service temporarily unavailable"; don't poll it aggressively.

## /api/auth/[...all]
better-auth's own endpoints are mounted here via `toNextJsHandler(auth)` for GET and POST (documented in the auth spec).
