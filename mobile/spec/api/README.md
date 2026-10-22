# BuddyBudget backend API — contract for the native apps

This folder describes the HTTP contract that the iOS (SwiftUI) and Android (Jetpack Compose) apps consume. It's
derived from the source of the web app (`buddy-budget`, Next.js 16 App Router, Route Handlers under `app/api/**/route.ts`).
It describes **what exists today**. Required backend changes are listed separately and marked as such.

| Document | Content |
|---|---|
| [auth.md](./auth.md) | How authentication works (better-auth), the session strategy for native clients, **required backend changes R1–R8** |
| [data-model.md](./data-model.md) | Every database entity, its JSON shape, ownership, encrypted fields, **all enums verbatim** |
| [gaps.md](./gaps.md) | Data and logic **not reachable through `app/api`**: browser-computed views, bundle-only constants, gates; proposed endpoints ranked P0–P2 |
| [endpoints/](./endpoints/) | One file per resource: every method, its parameters, body, response, errors and side effects |

Counts: **107 application route paths / 142 method-endpoints** (excluding `/api/auth/*`, 7 cron routes, metrics and
health).

---

## 1. Base URL and environments

| Environment | Base URL | Notes |
|---|---|---|
| Production | `https://app.buddybudget.io` | `APP_URL` = `BETTER_AUTH_URL`. The move of the app from the apex/`www` to `app.` is in progress (CLAUDE.md "Previsto"). Clients must not hard-code the apex. |
| Self-hosted | user-supplied (e.g. `http://192.168.1.10:3000`) | The project supports self-hosting (`docker-compose.yml`). The apps should let advanced users enter a server URL, validated with `GET /api/health`. Google, Resend and GoCardless may be missing on a self-hosted server. Read capabilities from the gaps.md G13 endpoint once it exists. |
| Local dev | `http://localhost:3000` | Non-`__Secure-` cookie names. better-auth rate limiting is **off** outside production. |

All paths in this spec are relative to the base URL and start with `/api/`. All responses also carry security headers:
HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.

## 2. Versioning

**There is no API versioning.** There's no `/v1` prefix, no version header and no content negotiation. The API is
private to the web client and changes in lock-step with it. Each deploy is a release-please version (`0.x.y`) and is
visible at:

```
GET /api/health → 200 { "status": "ok", "version": "0.42.1", "commit": "abc1234", "builtAt": "2026-10-17T09:12:00Z" }   (Cache-Control: no-store)
```

Consequences for the apps:

- **Decode leniently**: ignore unknown fields, map unknown enum values to an `unknown` case
  (see [data-model.md](./data-model.md#mirroring-guidance-swift--kotlin)), treat missing optional fields as null.
- Nice to have (auth.md N6 / gaps.md G13): `GET /api/meta` exposing `minClientVersion`, so the backend can force
  an upgrade. Until then, breaking changes to routes the apps use need a coordinated release.
- Proposal for new mobile-oriented endpoints: keep them under `/api/` (same auth, same `withRoute` observability).
  Don't introduce `/v1` for a subset only.

## 3. Authentication (summary — full detail in [auth.md](./auth.md))

- Today: better-auth cookie session `__Secure-better-auth.session_token`, obtained via magic link or Google OAuth
  redirect.
- For native: `Authorization: Bearer <token>` once the **`bearer` plugin** is enabled (R1). Sign-in via email OTP (R2)
  and native Google / Apple ID tokens (R3, R4).
- Every non-public route calls `auth.api.getSession({ headers })`. No session → **401 with empty body**.

Public routes (no session): `/api/auth/*`, `/api/health`, `/api/health/ready`, `/api/email/unsubscribe` (signed
token). `/api/cron/*` (`CRON_SECRET`) and `/api/metrics` (`METRICS_TOKEN`) are **server-only; apps must never call
them** ([endpoints/server-only.md](./endpoints/server-only.md)).

### Global gates (middleware `proxy.ts`), checked on every `/api/*` request in this order

| Order | Condition | Response | Allowed exceptions |
|---|---|---|---|
| 1 | no session | `401` empty | public routes |
| 2 | account deactivated (`user.deletionScheduledAt != null`) | `403` empty | `POST /api/user/reactivate` |
| 3 | onboarded and legal acceptance outdated (`legalAcceptedVersion != LEGAL_VERSION`, currently `"2026-10-12"`) | `403` empty | `/api/user/legal-acceptance`, `/api/user/export`, `/api/user/account` |
| 4 | feature not available for `productCountry` (DE) | `403 { "code": "country_feature_unavailable", "error": "…" }` | — |

DE-blocked prefixes: `/api/pension`, `/api/analytics`, `/api/goals`, `/api/sidebar/fire`,
`/api/investments/tax-carryforwards`. Tax fields in `PUT /api/instruments/{id}/settings` and
`PATCH /api/investments/portfolio` are checked inline. `/api/financial-planning` is the reverse: **DE only**.

The onboarding gate is **not** enforced on the API. The client routes to onboarding itself.

## 4. Request conventions

| Topic | Convention |
|---|---|
| Content type | `application/json` request and response bodies. **No multipart anywhere.** Files are sent as JSON string fields (`/api/personal-imports`, `/api/investments/import` `statementCsv`) or as a raw `text/csv` body (`/api/investments/import/parse`, 5 MB max). Server-side body limit is about 51 MB (`proxyClientMaxBodySize`). |
| IDs | UUID strings, except `user.id`, which is an opaque better-auth string. Many `[id]` routes don't validate UUID format, so a malformed id can produce `500 {"error":"Errore interno"}` instead of 404. Only send ids the API returned. |
| Request id | Every response has `x-request-id`. Clients may send their own (`^[A-Za-z0-9-]{8,64}$`) to correlate with server logs. Recommended: one UUID per request, included in crash and support reports. |
| User-Agent | Send `BuddyBudget-iOS/<ver> (<model>; iOS <x>)` / `BuddyBudget-Android/<ver> (…)`. It's shown in Settings → Sessions (auth.md N2). |
| Origin | Not needed, **except** `POST/DELETE /api/personal-imports*`, which require `Origin: <APP_URL origin>` until auth.md R8 ships. |
| Idempotency | No idempotency keys. Some creates are upserts (budgets `PUT`, subscriptions decisions, pension snapshots by date, manual prices by date). Debounce double taps on everything else. |

## 5. Error format

With branch `feat/mobile-api-foundations` (gaps.md **G15b**) **every error body carries a stable machine `code`**:

| Shape | Where |
|---|---|
| empty body | **401 only** (no / invalid session), from the proxy and the routes |
| `{ "code": "<code>" }` | an error a route returns without a body (e.g. many 404s, `{ "code": "not_found" }`) gets the generic code of its status, added by `withRoute` |
| `{ "error": "<human message>", "code": "<code>", "field"?: "<path>" }` | everything else. `error` is the Italian source text, translated to the user's language when the catalog has it; `field` is set on `validation_failed` (first zod issue path) and on bad query params |
| `{ "code": "account_deactivated" }` / `{ "code": "legal_acceptance_required", "version" }` | proxy 403 gates (auth.md R7) |
| resource-specific bodies (unchanged, no `error` → no `code` added) | `/api/investments/import` 400/422 → `ImportResult`; pension import 400 → `{ error, rows, counts }` (gets a code); GoCardless capacity 409 → `{ error, reason }`; manual bank sync → `{ status: "not-eligible" \| "already-running" \| "unavailable", … }`; `/api/instruments/backfill` 503 → `{ status: "unavailable" }` |
| `/api/financial-planning` | `{ "error", "code" }` with `invalid_plan` (400), `plan_changed` (409), `country_feature_unavailable` (403, same localized body as the country gate) |
| `429 { "message": "Too many requests…" }` + `X-Retry-After` | better-auth limiter (`/api/auth/*`); better-auth errors use `{ "message", "code" }` with UPPER_CASE codes (e.g. `INVALID_OTP`, `TOO_MANY_ATTEMPTS`) |

**Codes** (closed list `API_ERROR_CODES`, `lib/http/api-error.ts`; adding one is fine, renaming/removing is breaking):

| Code | Status | Meaning |
|---|---|---|
| `bad_request`, `forbidden`, `not_found`, `conflict`, `unprocessable`, `too_many_requests`, `internal_error` | 400, 403, 404, 409, 422, 429, 5xx | **generic**: the route set no specific code |
| `validation_failed` | 400 | invalid body or param; see `field` |
| `invalid_date`, `invalid_date_range`, `invalid_type`, `invalid_cursor`, `invalid_period` | 400 | malformed query params of list/view endpoints |
| `invalid_account`, `invalid_category` | 400 | referenced account/category missing or not owned |
| `account_not_found`, `transaction_not_found`, `category_not_found` | 404 | resource missing or owned by someone else |
| `linked_account_read_only` | 400 / 403 | manual-only change on a bank-linked account (add transaction, edit type/balance) |
| `linked_transaction_field_locked` | 403 | description/amount/date sent for a bank transaction |
| `linked_transaction_not_deletable` | 400 | delete of a bank transaction |
| `category_direction_mismatch` | 400 | category direction incompatible with the transaction sign |
| `invalid_excluded_amount` | 400 | "Dividi" share out of range |
| `category_exists`, `subscription_exists` | 409 | duplicate name |
| `fallback_category_locked` | 409 / 400 | rename, delete or make-transfer of «Da categorizzare» |
| `transfer_without_budget` | 400 | budget on a transfer category |
| `position_not_sellable` | 422 | `POST /api/investments/taxes/simulate-sale`: instrument not held or without price/FX |
| `pension_fund_not_found` | 404 | `GET /api/pension/view?fundId=` not one of the user's funds |
| `country_feature_unavailable` | 403 | feature not in the product country (country gate, `withCountryGuard`, `/api/financial-planning`); now in `API_ERROR_CODES` |
| `invalid_plan`, `plan_changed` | 400, 409 | `/api/financial-planning` |
| `demo_active` (409), `reauth_required` (403), `country_feature_unavailable` (403), `unsupported_locale` (400), `legal_acceptance_required` (400 on onboarding / 403 gate), `account_deactivated` (403), `demo_read_only` (403) | | pre-existing codes, unchanged |

Specific codes are set today on the routes of the MVP screens (transactions, accounts, categories, budgets,
subscriptions, the view endpoints); other routes get the generic code until they are touched. Fixture with real bodies:
[fixtures/errors.json](./fixtures/errors.json).

Client rules (both platforms, identical):

1. Branch on **status code + `code`** (or `reason` / `status` for the resource-specific bodies), never on the `error` text.
2. Show `error` verbatim only for 400/409/422 validation-style failures, or map `code` to a local string. For anything
   else use a localized generic message.
3. 401 → sign out locally. 403 with `account_deactivated` / `legal_acceptance_required` → refetch `GET /api/me/bootstrap`
   and re-route.

## 6. Pagination

Only `GET /api/transactions` is paginated (gaps.md G4, branch `feat/mobile-api-foundations`), in its **paged mode**:
`limit` (1–200, default 50) and/or `cursor` → `{ items, nextCursor }`, keyset on `(date desc, id desc)`, filters
`from`, `to`, `type` (default `tutte` in this mode), `accountId`, `categoryId`, `q`, `uncategorized=1`. Without `limit`
and `cursor` it keeps the legacy behaviour (whole window, default `type=uscita`). See
[transactions.md](./endpoints/transactions.md#get-apitransactions).

Every other list returns everything. Some are capped silently: `auto-categorized` at 1000 rows, `newTransactionIds` at
200, debts at 600 plan rows per loan, sidebar deadlines at 4.

## 7. Serialization

| Kind | Rule |
|---|---|
| Money from DB rows | Drizzle `numeric`, sent as a **string**: `"1234.50"`, `"-12.30"`, quantities `"0.12345678"`, prices with 8 decimals. Parse as `Decimal` (Swift) / `BigDecimal` (Kotlin). Never use `Double` for these. |
| Money from computed views | **JSON numbers** (floats). Examples: debts, goals, pension `GET`, sidebar, subscriptions `GET`, categorization groups, instrument analysis, personal-import previews. |
| Mixed resources | The same resource can do both. Example: `GET /api/subscriptions` sends numbers, while `POST`/`PATCH` return the raw row with `amount` as a string (and `userId`). Endpoint docs state the type per field; use a decoder that accepts **both** string and number for money. |
| Money in requests | Always JSON **numbers**. Transaction `amount` / `excludedAmount` are positive magnitudes; the server derives the sign from the category direction. |
| Currency | The user's currency is `user.currency` (`EUR`, `USD`, `GBP`, `CHF`). Liquidity amounts have **no per-row currency** and are in the user's currency. Investment `price` / `grossAmount` are in the **instrument's** currency (`instruments.currency`, any ISO-4217). Investment fees and taxes are in the user's currency. FX rates come in the investments overview payload. |
| Percent / rates | Two conventions. **Fractions** (`"0.2600"` = 26%) for investments, tax, categorization confidence, split percentage, analytics and financial-planning. **Percent** (`"3.2500"` = 3.25%) for debt rates. `fundamentals.debtToEquity` is Yahoo percent. |
| Timestamps | ISO-8601 UTC strings with milliseconds (`"2026-10-18T10:00:00.000Z"`) |
| Dates | `"YYYY-MM-DD"` strings (`date` columns, transaction dates, snapshot days). Goals `targetDate` accepts `YYYY-MM` or `YYYY-MM-DD` and stores the first of the month. Map to `LocalDate`, not to an instant. |
| "Today" | Server endpoints use the **UTC** date (debt installment status, net-worth series stop at yesterday). The web computes client-side views with the browser's local day. The view endpoints (`/api/overview`, `/api/liquidity/month`, `/api/accounts?include=…`) take `today=YYYY-MM-DD`: **always send the device's local day**. |
| Encrypted fields | Transaction description and note, debt and investment notes, goal names and others are encrypted at rest but always **plain text** in JSON |
| Localization | Default category names are localized on the server in `GET /api/categories` and in rule `categoryName` (G11); display them as is. View endpoints return their labels and sentences already localized. Error `error` strings are translated when the catalog has them; branch on `code`. Number and date formatting happens on the client (`it-IT`, `en-GB`, `de-DE` from `user.language`). |

## 8. Rate limits and quotas

| Scope | Limit | Response |
|---|---|---|
| better-auth `/api/auth/*` (production only, in-memory per pod, per IP) | 100 / 10 s per path. `/sign-in/*` 3 / 10 s. Magic link send/verify 5 / 60 s. OTP send 3 / 60 s (after R2). | 429 `{ message }` + `X-Retry-After` |
| `POST /api/support` | 5 / hour / user (Redis, fails open) | 429 |
| `POST /api/client-errors` | 20 / 10 min (Redis, fails open) | 429 empty |
| `POST /api/user/notifications/test` | 3 / hour (DB) | 429 |
| `POST /api/instruments/{id}/commentary` | 20 s cooldown per user (Redis) | 429 |
| Manual bank sync | 4 per rolling 24 h plus a 4 h gap, shared with the cron | 409/429 `{ status: "not-eligible", nextEligibleAt, syncsRemainingToday }` |
| GoCardless capacity | 1 bank per user, 3 consent attempts per 31 days, 40 new banks globally (env-tunable) | 409 `{ error, reason }` |
| Personal imports | max 2 running, 10 uploads per 24 h | 4xx `{ error }` |
| Entity caps | 10 pension funds, 5000 snapshots per fund, 20 goals, 12 sources per goal, 10 costs per debt, 10 active alerts per instrument, 1000 rows per pension import | 400/409 `{ error }` |

## 9. Background work and polling

The project standard (CLAUDE.md, "Operazioni lunghe"):

1. The route validates synchronously, creates a job and **returns immediately** with `{ jobId }`.
2. The work runs in Next `after()`.
3. State is kept in **Redis** (TTL 24 h) with **real counters** and a heartbeat.
4. The client polls.

| Job family | Started by | Returns | Poll | Contract |
|---|---|---|---|---|
| Bank import / sync (Redis job) | `POST /api/gocardless/connections/{id}/finalize` (201), `POST /api/gocardless/accounts/{accountId}/sync` (202) | `{ jobId }` | `GET /api/sync-jobs` (**every 1 s while any job is `running`**, stop otherwise); dismiss via `POST /api/sync-jobs/{id}/dismiss` | A job is **stale/interrupted** after 60 s without a heartbeat (server beats every 15 s). Jobs expire after 24 h. There is no `GET /api/sync-jobs/{id}`: filter the list. Statuses and counters: [endpoints/sync-jobs.md](./endpoints/sync-jobs.md). |
| Personal CSV import (DB-backed job, processed by a worker) | `POST /api/personal-imports` (202 `{ id }`) | `{ id }` | `GET /api/personal-imports` every 3 s while a job is `queued` / `processing` | Statuses: `queued`, `processing`, `ready`, `correction_ready`, `review_failed`, `failed`, `imported`, `expired`. A job in `ready` is auto-imported. Users also get an email. [endpoints/personal-imports.md](./endpoints/personal-imports.md) |
| Price-history backfill (fire-and-forget) | `POST /api/instruments`, watch, investment transaction create/edit, import, benchmark change | nothing | `GET /api/instruments/backfill?ids=…` (web: every 2 s), or the `backfilling` / `loading` flags in analysis and price | [endpoints/instruments.md](./endpoints/instruments.md) |
| AI category suggestions | `POST /api/transactions/categorize-suggestions/generate` → `{ status: "started" \| "no_key" \| "disabled" }` | nothing | Re-fetch `GET /api/transactions/categorize-suggestions` | no status endpoint (gaps.md G16) |
| Fire-and-forget, no visibility | auto-categorization after imports, AI auto-apply, Yahoo profile and dividend fetch on investments overview | — | — | — |

Polling rules for both apps: poll only while the screen or the global job indicator is visible **and** a job is
running. Back off to 5 s when the app is in the background or on a metered connection. Show the server counters
(`processed` / `total`), never a time-based estimate.

## 10. Caching

- **No ETag / Last-Modified anywhere.** Almost no `Cache-Control`, so treat every JSON response as uncacheable by HTTP
  and cache in the app's own store instead.
- `Cache-Control: no-store` is set explicitly on: health, health/ready, metrics, user export, personal-imports GETs,
  `investments/import/parse`, `investments/import/reset` GET, `investments/statements` GET.
- Images (`/api/merchant-logos/*`, `/api/instruments/{id}/logo`):
  - `Cache-Control: private, max-age=86400` on 200, `max-age=3600` on 404.
  - Body is binary, usually `image/webp`.
  - They **require the session**: configure the image loader to send `Authorization`.
  - Merchant-logo URLs come pre-signed in `logoPath` fields (relative path with `?s=` HMAC). Resolve them against the
    base URL and never build them yourself.
- Server-side Redis caches (transparent to clients): Yahoo search 6 h, fundamentals 24 h, logos 30 days, LLM commentary
  12 h, crypto catalog 7 days.
- Client cache invalidation must mirror the web's TanStack Query invalidations: after a mutation, refetch the lists of
  the same resource and the derived screens (overview, sidebar, net worth). Each endpoint doc lists side effects to
  guide this.

## 11. Non-JSON responses and redirects

| Endpoint | Response |
|---|---|
| `GET /api/user/export` | `application/zip` attachment (needs a recent login) → save with the share sheet / SAF |
| `GET /api/merchant-logos/*`, `GET /api/instruments/{id}/logo` | image bytes |
| `GET /api/gocardless/callback` | always a 302 to web pages; needs a browser cookie. **Not usable by native** until auth.md R6. |
| `GET /api/email/unsubscribe` | 303 to the web page `/disiscrizione` (email links only) |
| `GET /api/metrics` | Prometheus text (server-only) |
| 204 No Content | e.g. `POST /api/transactions/attention/seen`, `POST /api/analytics/walkthrough`, pension `PATCH`/`DELETE`, `DELETE …/manual-prices` |

---

## 12. Endpoint index

Auth column: **session** = signed-in user (cookie today, Bearer after R1). **public** = no session.
**secret** = server-only. All session routes are subject to the gates in §3.

### Auth (better-auth)

| Path | Methods | Purpose | Auth | Feature area | Doc |
|---|---|---|---|---|---|
| `/api/auth/*` | GET, POST | better-auth handler: `get-session`, `sign-out`, `sign-in/magic-link`, `magic-link/verify`, `sign-in/social`, `link-social`, `callback/google`, **`email-otp/send-verification-otp`, `sign-in/email-otp`** (R2, native sign-in) | public | Auth | [auth.md](./auth.md) |

### Liquidity: accounts, movements, categories, budgets, rules

| Path | Methods | Purpose | Auth | Feature area | Doc |
|---|---|---|---|---|---|
| `/api/accounts` | GET, POST | List accounts (`include=trend,health`: bank, 30-day trend, connection health, status — G5) / create a manual account (POST demo-guarded) | session | Liquidity > Accounts | [accounts.md](./endpoints/accounts.md) |
| `/api/accounts/{id}` | PATCH, DELETE | Edit account (bank-linked: name/color/icon only) / delete account and its transactions; may revoke GoCardless consent | session | Liquidity > Accounts, bank connections | [accounts.md](./endpoints/accounts.md) |
| `/api/transactions` | GET, POST | Paged feed with Movimenti filters (`limit`/`cursor`, G4) or legacy full window / create a manual transaction (demo-guarded) | session | Liquidity > Movements | [transactions.md](./endpoints/transactions.md) |
| `/api/liquidity/month` | GET | Month figures, pace, groups, budget progress, sentence (G3) | session | Liquidity > Movements header, «Il mese» | [liquidity.md](./endpoints/liquidity.md) |
| `/api/transactions/{id}` | PATCH, DELETE | Edit category/split/note (also description/amount/date if manual) / delete a manual transaction | session | Liquidity > Movements | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/attention` | GET | Counts of new and uncategorized transactions | session | Sidebar badge, Overview "Da sistemare" | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/attention/seen` | POST | Mark imported transactions as seen (204) | session | Movements | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/auto-categorized` | GET | Auto-categorized groups not yet reviewed (max 1000 rows) | session | Categorize > "Messe dall'app" | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/auto-categorized/seen` | POST | Mark as reviewed up to `until` | session | Categorize | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/categorize-apply` | POST | Bulk-apply category choices and learn merchant rules (atomic) | session | Categorize | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/categorize-auto` | POST | Apply rules and confident suggestions now | session | Categorize | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/categorize-suggestions` | GET | Uncategorized transactions grouped by merchant, with a suggestion | session | Categorize | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/categorize-suggestions/generate` | POST | Start AI suggestions in the background (`after()`, no jobId) | session | Categorize (AI) | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/recategorize` | GET, POST | Preview / apply a recategorization (synchronous) | session | Categorize > Ricategorizza, Rules | [transactions.md](./endpoints/transactions.md) |
| `/api/transactions/recategorize/undo` | POST | Undo the last run (within 7 days) | session | Categorize > Ricategorizza | [transactions.md](./endpoints/transactions.md) |
| `/api/categories` | GET, POST | List (default names localized in the user's language, G11) / create | session | Categories, pickers | [categories.md](./endpoints/categories.md) |
| `/api/categories/{id}` | PATCH, DELETE | Update (moving to/from transfer rewrites `excludedAmount` and deletes the budget) / delete (transactions go back to the fallback category) | session | Categories | [categories.md](./endpoints/categories.md) |
| `/api/categories/distribute-colors` | POST | Reassign unique colors from the 48-color pool | session | Categories | [categories.md](./endpoints/categories.md) |
| `/api/categories/usage` | GET | `{ categoryId: count }` over the last 365 days | session | Category picker ordering | [categories.md](./endpoints/categories.md) |
| `/api/budgets` | GET | List monthly budgets (amounts only; progress is in `/api/liquidity/month`) | session | Movements > budget | [budgets.md](./endpoints/budgets.md) |
| `/api/budgets/{categoryId}` | PUT | Upsert a monthly budget (no DELETE) | session | Movements > budget | [budgets.md](./endpoints/budgets.md) |
| `/api/categorization-rules` | GET, POST | List rules (with `categoryName`, `logoPath`) / create or replace and apply now | session | Categories and rules, "Ricordala" | [categorization-rules.md](./endpoints/categorization-rules.md) |
| `/api/categorization-rules/{id}` | PATCH, DELETE | Update and apply now / delete | session | Rules | [categorization-rules.md](./endpoints/categorization-rules.md) |
| `/api/merchant-logos/{domain}` | GET | Merchant logo image (signed or dictionary domain), Redis-cached proxy of Logo.dev | session | Merchant avatars | [merchant-logos.md](./endpoints/merchant-logos.md) |
| `/api/merchant-logos/name/{name}` | GET | Merchant logo found by brand-name search (signed) | session | Merchant avatars | [merchant-logos.md](./endpoints/merchant-logos.md) |
| `/api/subscriptions` | GET, POST | Detected and saved subscriptions with totals and logos / save a decision (upsert by key) or add a manual one | session | Liquidity > Abbonamenti | [subscriptions.md](./endpoints/subscriptions.md) |
| `/api/subscriptions/{id}` | PATCH, DELETE | Edit a saved decision / delete (a detected one goes back to "da-confermare") | session | Liquidity > Abbonamenti | [subscriptions.md](./endpoints/subscriptions.md) |

### Bank connections (GoCardless), imports and jobs

| Path | Methods | Purpose | Auth | Feature area | Doc |
|---|---|---|---|---|---|
| `/api/gocardless/institutions` | GET | Banks for a country (`?country=XX`) | session | Accounts > Connect bank | [gocardless.md](./endpoints/gocardless.md) |
| `/api/gocardless/capacity` | GET | Whether the user can connect a new bank; which banks can be renewed | session | Accounts > Connect bank | [gocardless.md](./endpoints/gocardless.md) |
| `/api/gocardless/connections` | GET, POST | Linked-account status list / start a connection → `{ link }` (demo-guarded, capacity-checked) | session | Accounts | [gocardless.md](./endpoints/gocardless.md) |
| `/api/gocardless/callback` | GET | Browser return from bank consent; always a 302 to web pages (**web-only today**, see auth.md R6) | browser cookie | Connect bank | [gocardless.md](./endpoints/gocardless.md) |
| `/api/gocardless/connections/{id}/accounts` | GET | Accounts found at the bank and existing linked accounts | session | "Accounts found" | [gocardless.md](./endpoints/gocardless.md) |
| `/api/gocardless/connections/{id}/finalize` | POST | Create or re-link accounts and start the initial import (**job**, 201 `{ jobId }`) | session | "Accounts found" | [gocardless.md](./endpoints/gocardless.md) |
| `/api/gocardless/accounts/{accountId}/sync` | POST | Manual sync of one account (**job**, 202 `{ jobId }`) | session | Accounts | [gocardless.md](./endpoints/gocardless.md) |
| `/api/sync-jobs` | GET | Bank job list for polling (heartbeat-checked) | session | Global sync indicator | [sync-jobs.md](./endpoints/sync-jobs.md) |
| `/api/sync-jobs/{id}/dismiss` | POST | Hide a job summary | session | Global sync indicator | [sync-jobs.md](./endpoints/sync-jobs.md) |
| `/api/personal-imports` | GET, POST | Formats and import jobs / upload a CSV for AI analysis (**job**, 202 `{ id }`; Origin header required) | session | Imports | [personal-imports.md](./endpoints/personal-imports.md) |
| `/api/personal-imports/{id}` | GET, POST, DELETE | Preview, correction compare or deletion token / confirm, skip errors, reanalyze, replace or discard correction / delete with token | session | Imports, Investments > import management | [personal-imports.md](./endpoints/personal-imports.md) |

### Investments and instruments

| Path | Methods | Purpose | Auth | Feature area | Doc |
|---|---|---|---|---|---|
| `/api/investments/overview` | GET | **All raw portfolio data** (transactions, instruments, prices, FX, targets, profiles, dividends, tax data) for client-side calculation; `?period=1mese\|3mesi\|1anno\|max` | session | Investments (all tabs) | [investments.md](./endpoints/investments.md) |
| `/api/investments/titles` | GET | Watchlist and held titles with last close, day/month change, sparkline, alert counts | session | Investments > Titoli, sidebar | [investments.md](./endpoints/investments.md) |
| `/api/investments/transactions` | POST | Create one investment operation | session | Investments > Operazioni | [investments.md](./endpoints/investments.md) |
| `/api/investments/transactions/{id}` | PATCH, DELETE | Replace / delete an operation (409 if it comes from a reconciled statement) | session | Investments > Operazioni | [investments.md](./endpoints/investments.md) |
| `/api/investments/portfolio` | PATCH | Set the benchmark and/or tax regime of the default portfolio | session | Investments > Performance / Tasse | [investments.md](./endpoints/investments.md) |
| `/api/investments/targets` | PUT | Replace the target allocation | session | Investments > Diversificazione | [investments.md](./endpoints/investments.md) |
| `/api/investments/dividends/dismissed` | POST, DELETE | Dismiss / restore "dividend/coupon to record" proposals | session | Investments > Proventi | [investments.md](./endpoints/investments.md) |
| `/api/investments/tax-carryforwards` | POST | Add a prior capital loss (IT only) | session | Investments > Tasse | [investments.md](./endpoints/investments.md) |
| `/api/investments/tax-carryforwards/{id}` | DELETE | Delete a carry-forward (IT only) | session | Investments > Tasse | [investments.md](./endpoints/investments.md) |
| `/api/investments/import/parse` | POST | Server-side parse of IBKR / DEGIRO / Trade Republic CSV (raw `text/csv` body, 5 MB max) | session | Investments > Import wizard | [investments.md](./endpoints/investments.md) |
| `/api/investments/import/resolve` | POST | Match file instruments to the catalogue or to Yahoo / CoinGecko / OpenFIGI (read-only) | session | Investments > Import wizard | [investments.md](./endpoints/investments.md) |
| `/api/investments/import` | POST | Dry-run preview or all-or-nothing import of operations / a full broker statement (synchronous) | session | Investments > Import wizard | [investments.md](./endpoints/investments.md) |
| `/api/investments/import/reset` | GET, DELETE | Preview (revision hash + counts) / wipe the whole investment history | session | Investments > Rendiconti > Importazioni | [investments.md](./endpoints/investments.md) |
| `/api/investments/statements` | GET | Imported broker statements (NAV, cash, positions, ledger) | session | Investments > Rendiconti | [investments.md](./endpoints/investments.md) |
| `/api/investments/statements/{id}` | DELETE | Delete a statement import and all later ones of the same account | session | Investments > Rendiconti > Importazioni | [investments.md](./endpoints/investments.md) |
| `/api/instruments` | POST | Create or reuse an instrument (yahoo / coingecko / isin / manuale) and start a 30-day price backfill | session | Investments > add operation | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/search` | GET | Search known instruments, Yahoo, CoinGecko, OpenFIGI fallback (`?q=`, at least 2 chars) | session | Investments > add operation | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/backfill` | GET | Price-backfill status (`?ids=`, max 50) | session | Investments (polling) | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}` | PATCH | Rename a private (manual / ISIN-only) instrument | session | Investments > title | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/analysis` | GET | Title page payload: chart, stats, position, watchlist, alerts, fundamentals, statements, dividends, ETF composition (`?period=1M\|3M\|6M\|1A\|5A\|Max`) | session | Investments > Title page | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/breakdown` | PUT | Per-user manual sector / area weights | session | Investments > Diversificazione | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/commentary` | POST | LLM commentary (Ollama, cached 12 h, 20 s cooldown) | session | Title page | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/logo` | GET | Instrument logo image (Logo.dev proxy) | session | Instrument icons | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/manual-prices` | POST, DELETE | Save or replace / delete a per-user manual close (`?date=`) | session | Manual prices | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/price` | GET | Price on a date, to prefill the operation form (`?date=`) | session | Add operation | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/quotation` | GET, POST | List / link Yahoo quotations for a private ISIN instrument | session | Title page | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/settings` | PUT | Per-user tax and coupon settings (tax fields return 403 for DE) | session | Instrument settings | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/watch` | PUT, DELETE | Follow / unfollow (watchlist; PUT starts a 380-day backfill) | session | Titoli / watchlist | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/alerts` | POST | Create a price alert (max 10 active; automatic-price instruments only) | session | Title page | [instruments.md](./endpoints/instruments.md) |
| `/api/instruments/{id}/alerts/{alertId}` | DELETE | Delete a price alert | session | Title page | [instruments.md](./endpoints/instruments.md) |

### Debts, pension, goals, net worth, planning, analytics

| Path | Methods | Purpose | Auth | Feature area | Doc |
|---|---|---|---|---|---|
| `/api/overview` | GET | Overview computed on the server: net-worth series and change, composition, month pace, voice, investments/pension/debts summaries, renewal alerts (G2) | session | Panoramica | [overview.md](./endpoints/overview.md) |
| `/api/debts` | GET, POST | Full computed debts view (plans, overview) / create a loan | session | Debiti | [debts.md](./endpoints/debts.md) |
| `/api/debts/{id}` | PATCH, DELETE | Edit name/costs / delete (events cascade) | session | Debiti | [debts.md](./endpoints/debts.md) |
| `/api/debts/{id}/events` | POST | Add a payment, rate change, balance correction or early repayment | session | Debiti > detail | [debts.md](./endpoints/debts.md) |
| `/api/debts/{id}/events/{eventId}` | DELETE | Delete an event | session | Debiti > detail | [debts.md](./endpoints/debts.md) |
| `/api/debts/{id}/payments/bulk` | POST | Mark overdue installments up to N as paid | session | Debiti > detail | [debts.md](./endpoints/debts.md) |
| `/api/pension` | GET | Pension funds with snapshots (IT only) | session | Pensione | [pension.md](./endpoints/pension.md) |
| `/api/pension/funds` | POST | Create a fund (max 10) | session | Pensione | [pension.md](./endpoints/pension.md) |
| `/api/pension/funds/{id}` | PATCH, DELETE | Rename or change adhesion date / delete (snapshots cascade) | session | Pensione | [pension.md](./endpoints/pension.md) |
| `/api/pension/funds/{id}/snapshots` | POST | Upsert one snapshot per date | session | Pensione | [pension.md](./endpoints/pension.md) |
| `/api/pension/funds/{id}/snapshots/{snapshotId}` | DELETE | Delete a snapshot | session | Pensione | [pension.md](./endpoints/pension.md) |
| `/api/pension/funds/{id}/snapshots/import` | POST | Bulk upsert of client-parsed rows (all-or-nothing, max 1000) | session | Pensione > Import | [pension.md](./endpoints/pension.md) |
| `/api/goals` | GET, POST | Goals view (plan, sources, FIRE comparison) / create (max 20) (IT only) | session | Analitiche > Obiettivi | [goals.md](./endpoints/goals.md) |
| `/api/goals/{id}` | PATCH, DELETE | Update, replace sources, mark achieved or reopened / delete | session | Obiettivi | [goals.md](./endpoints/goals.md) |
| `/api/goals/reorder` | POST | Set the full priority order | session | Obiettivi | [goals.md](./endpoints/goals.md) |
| `/api/net-worth/snapshots` | GET | Daily rows per asset class in `from..to` (stored + derived debts/pension), `compact=1` | session | Panoramica, Analitiche | [net-worth.md](./endpoints/net-worth.md) |
| `/api/financial-planning` | GET, PUT | DE planning document with optimistic concurrency (`revision`) (**DE only**) | session | DE: pension / retirement / tax / income | [financial-planning.md](./endpoints/financial-planning.md) |
| `/api/analytics/assumptions` | GET, PUT | FIRE assumptions (defaults filled in), partial update (IT only) | session | Analitiche | [analytics.md](./endpoints/analytics.md) |
| `/api/analytics/walkthrough` | POST | Mark the first-run guide as seen (204) | session | Analitiche | [analytics.md](./endpoints/analytics.md) |
| `/api/sidebar/summary` | GET | Net worth and month change, portfolio holdings, watchlist, alerts | session | Sidebar / dashboard | [sidebar.md](./endpoints/sidebar.md) |
| `/api/sidebar/deadlines` | GET | Next installments and bank renewals (max 4) | session | Sidebar / dashboard | [sidebar.md](./endpoints/sidebar.md) |
| `/api/sidebar/fire` | GET | FIRE progress (wealth, target, progress, yearsToFire) (IT only) | session | Sidebar FIRE | [sidebar.md](./endpoints/sidebar.md) |

### User, account lifecycle, onboarding, support

| Path | Methods | Purpose | Auth | Feature area | Doc |
|---|---|---|---|---|---|
| `/api/me/bootstrap` | GET | Launch state: profile, gate to show, legal state, country capabilities (branch `feat/mobile-api-foundations`) | session | App launch / routing | [me.md](./endpoints/me.md) |
| `/api/legal` | GET | Current legal version, clauses, document links (branch `feat/mobile-api-foundations`) | public | Onboarding, legal gate | [legal.md](./endpoints/legal.md) |
| `/api/user/settings` | GET, PATCH | Profile and preferences (name, country, language, currency, homePage, hideAmounts) | session | Settings | [user.md](./endpoints/user.md) |
| `/api/user/onboarding` | POST | Complete onboarding (currency, locale, legal, categories, notifications, AI consent) | session | Onboarding | [user.md](./endpoints/user.md) |
| `/api/user/legal-acceptance` | POST | Accept the current Terms / Privacy version | session | Legal gate | [user.md](./endpoints/user.md) |
| `/api/user/notifications` | GET, PATCH | Email notification preferences | session | Settings > Notifications | [user.md](./endpoints/user.md) |
| `/api/user/notifications/test` | POST | Send a sample digest email (3 / hour) | session | Settings > Notifications | [user.md](./endpoints/user.md) |
| `/api/user/ai-categorization` | GET, PATCH | AI consent, instructions, auto-apply | session | Settings > Categorization | [user.md](./endpoints/user.md) |
| `/api/user/sessions` | GET, DELETE | List active sessions / sign out all others | session | Settings > Devices | [user.md](./endpoints/user.md) |
| `/api/user/sessions/{id}` | DELETE | Revoke one other session | session | Settings > Devices | [user.md](./endpoints/user.md) |
| `/api/user/data-summary` | GET | Counts of the user's data | session | Settings > Data & privacy | [user.md](./endpoints/user.md) |
| `/api/user/export` | GET | ZIP download of all data (recent login) | session | Settings > Data & privacy | [user.md](./endpoints/user.md) |
| `/api/user/reset` | POST | Wipe financial data and restart onboarding (recent login) | session | Settings > Data & privacy | [user.md](./endpoints/user.md) |
| `/api/user/deactivate` | POST | Schedule deletion in 30 days (recent login) | session | Settings > Data & privacy | [user.md](./endpoints/user.md) |
| `/api/user/reactivate` | POST | Cancel scheduled deletion | session | Deactivated-account screen | [user.md](./endpoints/user.md) |
| `/api/user/account` | DELETE | Delete the account immediately (recent login + typed email) | session | Settings > Data & privacy | [user.md](./endpoints/user.md) |
| `/api/start` | GET, PATCH | First-steps checklist status / dismiss or reopen | session | Overview checklist | [start.md](./endpoints/start.md) |
| `/api/start/demo` | POST, DELETE | Create / clear sample data | session | Overview sample data | [start.md](./endpoints/start.md) |
| `/api/support` | POST | Support report → `SUP-XXXXXX` reference (5 / hour) | session | Help / "Scrivici" | [support.md](./endpoints/support.md) |
| `/api/client-errors` | POST | Report a client crash to logs and metrics (20 / 10 min) | session | Global | [client-errors.md](./endpoints/client-errors.md) |
| `/api/email/unsubscribe` | GET, POST | One-click unsubscribe with a signed token (GET → 303 to the web page) | public | Email links | [email-unsubscribe.md](./endpoints/email-unsubscribe.md) |

### Server-only (never called by the apps)

| Path | Methods | Purpose | Auth | Doc |
|---|---|---|---|---|
| `/api/cron/{gocardless-sync, gocardless-maintenance, market-prices, net-worth-snapshot, notifications, account-deletion, inactive-accounts}` | GET | Scheduled jobs | secret (`CRON_SECRET`) | [server-only.md](./endpoints/server-only.md) |
| `/api/metrics` | GET | Prometheus scrape | secret (`METRICS_TOKEN`) | [server-only.md](./endpoints/server-only.md) |
| `/api/health` | GET | Liveness and build version (apps may use it for server-URL validation and reachability) | public | [server-only.md](./endpoints/server-only.md) |
| `/api/health/ready` | GET | Readiness of Postgres and Redis (200/503); apps may show a "service degraded" banner | public | [server-only.md](./endpoints/server-only.md) |

---

## 13. What the apps can't do with today's API (one-paragraph summary)

Raw data for almost every screen is reachable. What isn't:

- **Bank linking and Google/Apple sign-in.** They depend on browser cookies and redirects (auth.md R3–R6). Email
  sign-in works natively with the 6-digit code (R2) and Bearer tokens (R1) on branch `feat/mobile-api-foundations`.
- **Interactive simulators.** On that branch the server computes, with the web's own functions, every non-interactive
  view: Overview, Movimenti month, Analisi, accounts trend/health, the investments tabs (incl. Italian taxes, income and
  a debounced sale simulation), pension, debts insights, Analitiche base, the German plan's results, app metadata and
  what's new (see `gaps.md` and [domain/README.md](../domain/README.md)). What stays on the device are the sliders and
  forms ported with golden vectors (FIRE «e se…», Monte Carlo, pension projection, debt simulators, goal wizard, German
  editors).
