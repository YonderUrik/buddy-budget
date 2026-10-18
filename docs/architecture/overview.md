# System overview

BuddyBudget is one Next.js App Router application that turns a user's bank data, investment transactions, debts and pension snapshots into one net worth figure and the screens around it. The browser talks only to Route Handlers under [`app/api/`](../../app/api/). These read and write Postgres through Drizzle and use Redis for ephemeral state. Pages under [`app/`](../../app/) compose React components from [`components/`](../../components/). Domain logic and pure calculations live in [`lib/`](../../lib/). The marketing site is a separate static project in [`landing/`](../../landing/). Deployment manifests are in the separate `buddy-budget-infra` repository.

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Edge gate | Every request except static assets | Redirect, 401/403, or pass-through | [`proxy.ts`](../../proxy.ts) `proxy` |
| Page render | Route under `app/(app)` or `app/(auth)` | Server-rendered shell + client components | [`app/(app)/layout.tsx`](../../app/(app)/layout.tsx), [`app/(auth)/layout.tsx`](../../app/(auth)/layout.tsx), [`app/layout.tsx`](../../app/layout.tsx) |
| Client data | User interaction | `fetch` to `/api/*`, cached by TanStack Query | [`lib/queries/`](../../lib/queries/), [`components/query-provider.tsx`](../../components/query-provider.tsx) |
| Route handler | HTTP request | JSON response | `app/api/**/route.ts`, wrapped by [`lib/observability/with-route.ts`](../../lib/observability/with-route.ts) `withRoute` |
| Validation | JSON body | Typed input or 400 | [`lib/validation/`](../../lib/validation/) (zod) |
| Domain logic | Typed input, rows | Rows to write, views to return | `lib/<feature>/`, pure engines in [`lib/calc/`](../../lib/calc/) |
| Persistence | Drizzle queries | Postgres rows | [`lib/db/client.ts`](../../lib/db/client.ts), [`lib/db/schema/`](../../lib/db/schema/) |
| Ephemeral state | Jobs, caches, rate limits, heartbeats | Redis keys with TTL | [`lib/redis/client.ts`](../../lib/redis/client.ts) |
| Background work | `after()`, CronJobs, CSV worker | Data written later | [background-jobs.md](background-jobs.md) |
| Signals | Every route and job | JSON logs, Prometheus metrics, Umami events | [`lib/observability/`](../../lib/observability/), [`lib/analytics/`](../../lib/analytics/) |

```text
 browser ── HTTPS ──► Cloudflare Tunnel ──► Traefik ──► app pod (Next.js standalone, 2-4 replicas)
                                                          │  proxy.ts → page or route handler
                                                          ├──► Postgres (CloudNativePG)   via postgres.js + Drizzle
                                                          ├──► Redis                       via ioredis
                                                          └──► external: GoCardless, Yahoo and other price sources,
                                                               Resend, OpenRouter, Logo.dev, Umami
 k8s CronJobs ── curl + CRON_SECRET ──► /api/cron/*
 csv-worker pod ── polls personal_import_jobs in Postgres
 ArgoCD PreSync Job ── pnpm db:migrate ──► Postgres, before each rollout
```

## 2. Principles

**P1 — Route Handlers only, no Server Actions.** All writes go through `app/api/**/route.ts`. The client calls them with `fetch` inside TanStack Query hooks in `lib/queries/`.

**P2 — Every route is wrapped by `withRoute` with a static name.** All 118 `route.ts` files export their methods as `withRoute("<resource>.<action>", handler)`. The name becomes a metric label, so it never contains ids.

**P3 — Every query is scoped by the session user.** Authenticated handlers call `auth.api.getSession`, return 401 without a session, call `bindRequestUser(session.user.id)`, and filter by `userId`. `sessionOrUnauthorized` in [`lib/account/route-session.ts`](../../lib/account/route-session.ts) packages the same three steps.

**P4 — Derived figures are computed, not stored.** Positions, schedules and projections are recalculated from transactions, events and assumptions by pure functions in `lib/calc/` and feature folders. Stored history (net worth snapshots, prices) is either a daily record or a cache that can be rebuilt.

**P5 — Schema changes only through committed migrations.** `drizzle-kit generate` writes SQL into [`lib/db/migrations/`](../../lib/db/migrations/). Production applies them with a separate migrator image before the new app version starts.

**P6 — Ephemeral or cross-pod state goes to Redis, never to pod memory.** Job progress, cron heartbeats, rate-limit counters and provider caches are Redis keys. Pods can be replaced at any time.

**P7 — Country and language are independent.** `productCountry` decides which financial features exist. `language` changes only text and number formatting. One central function, `isCountryPathAvailable`, gates routes for both pages and APIs.

**P8 — Optional integrations degrade, they do not break.** [`lib/env.ts`](../../lib/env.ts) requires only `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL` and `CRON_SECRET`. Without Google the Google button does not work, without Resend the magic link is logged, without GoCardless only manual accounts and imports exist, without `DATA_ENCRYPTION_KEY` fields are stored in plain text.

## 3. Data model

The schema is split by area in [`lib/db/schema/`](../../lib/db/schema/) and re-exported from [`index.ts`](../../lib/db/schema/index.ts). User-owned tables have a `user_id` referencing `auth_user` with `on delete cascade`. Two references use `set null` instead: `bank_connection_attempts.user_id`, kept to count GoCardless slots after a deletion, and `instruments.created_by_user_id`. Tables shared across users (instruments and their prices, FX rates, inflation and interest rates) have no owner.

| Schema file | Tables | Domain doc |
|---|---|---|
| `auth.ts` | `auth_user`, `auth_session`, `auth_account`, `auth_verification` | this page, §4.3 |
| `accounts.ts`, `transactions.ts`, `budgets.ts` | `accounts`, `transactions`, `budgets` | [bank-sync-and-imports.md](bank-sync-and-imports.md) |
| `bank-connections.ts` | `bank_connections`, `bank_account_links`, `bank_connection_attempts`, `gocardless_token` | [bank-sync-and-imports.md](bank-sync-and-imports.md) |
| `categories.ts`, `categorization-*.ts` | `categories`, `categorization_rules`, `categorization_suggestions`, `categorization_runs`, `categorization_run_items` | [categorisation.md](categorisation.md) |
| `investments.ts` | `instruments`, `instrument_symbols`, `instrument_prices`, `user_instrument_prices`, `fx_rates`, `investment_portfolios`, `investment_transactions`, `investment_plans`, `inflation_index`, `instrument_profiles`, `user_instrument_breakdowns`, `investment_targets`, `interest_rates`, `user_instrument_settings`, `investment_tax_carryforwards`, `instrument_dividends`, `user_dismissed_dividends`, `user_watchlist_items`, `user_price_alerts` | [investments.md](investments.md), [market-data.md](market-data.md), [taxes.md](taxes.md) |
| `broker-statements.ts`, `broker-import-accounts.ts`, `import-format-profiles.ts`, `personal-imports.ts` | `broker_statements`, `broker_import_accounts`, `import_format_profiles`, `personal_formats`, `personal_parsers`, `personal_import_jobs`, `personal_import_receipts` | [bank-sync-and-imports.md](bank-sync-and-imports.md) |
| `debts.ts` | `debts`, `debt_events` | [debts.md](debts.md) |
| `pension.ts` | `pension_funds`, `pension_snapshots` | [pension.md](pension.md) |
| `net-worth-snapshots.ts` | `net_worth_snapshots` | [net-worth.md](net-worth.md) |
| `analytics.ts`, `goals.ts`, `financial-plans.ts` | `analytics_assumptions`, `goals`, `goal_sources`, `financial_plans` | [analytics-and-goals.md](analytics-and-goals.md) |
| `subscriptions.ts`, `notifications.ts` | `subscriptions`, `notification_preferences`, `notification_log` | [background-jobs.md](background-jobs.md) for the notifications cron |

`auth_user` carries the app's own profile fields, declared to better-auth as `additionalFields` with `input: false` so that `/api/auth/update-user` cannot set them: `productCountry` (default `IT`), `language` (default `it`), `currency` (default `EUR`), `onboardingCompleted`, `homePage`, `hideAmounts`, `deletionScheduledAt`, `legalAcceptedAt`, `legalAcceptedVersion`.

Redis holds no data that cannot be lost. The key families are listed in §4.6.

## 4. How it works

### 4.1 Component layers

```text
app/                     layer 3  routes: pages and layouts orchestrate the layers below
components/domain/<x>/   layer 2  financial UI, one folder per feature, each with an index.ts barrel (27 folders)
components/layout/       layer 2  shell, sidebar, bottom nav, mobile top bar; barrel index.ts
components/motion/       shared   animated number, text morph, animated list, MotionProvider
components/ui/           layer 1  shadcn primitives on @base-ui/react
lib/                     no React components except providers/contexts (localization, analitiche, pension)
```

The dependency direction is enforced by convention, not by a lint rule. As of today `components/layout/` imports no domain component, and nothing under `components/` or `lib/` imports from `app/`. `components/ui/` is not dependency-free: `button.tsx` uses `components/motion/text-morph`, `dialog.tsx`, `alert-dialog.tsx` and `popover.tsx` use `lib/motion/sheet` (bottom sheets on the phone), `popover.tsx` uses `lib/hooks/use-media-query`, and `chart.tsx` uses `lib/localization/provider`.

Providers mounted in [`app/layout.tsx`](../../app/layout.tsx), outermost first: `LocalizationProvider` (profile from `getLocaleProfile`), `QueryProvider` (one `QueryClient` per browser session, default options), `ThemeProvider` (`next-themes`, class strategy, system default), `MotionProvider`. The Umami script is loaded from `/stats/script.js`.

[`app/(app)/layout.tsx`](../../app/(app)/layout.tsx) adds `PrivacyProvider` (hide amounts, initial value from `session.user.hideAmounts`), `QuickReportProvider` (the «Scrivici» — "Write to us" — support sheet), `BackHistoryRecorder`, `AttentionShell` (sidebar, bottom nav and badges), `DemoBannerContainer`, and the global `SyncProgressIndicator` with `PersonalImportIsland`.

### 4.2 Request lifecycle

1. **[`proxy.ts`](../../proxy.ts)** runs on every path except static assets (`_next/static`, `_next/image`, icons, manifest, brand and instrument icons). In order:
   - `/login` with a valid session redirects to `safeRedirectPath(?redirect)`.
   - Public prefixes pass: `/login`, `/api/auth`, `/api/health`, `/api/cron`, `/api/metrics`, `/api/email`, `/disiscrizione`, `/_next`, `/favicon.ico`. Cron and metrics routes check their own bearer token.
   - No session: APIs get 401, pages redirect to `/login?redirect=<path>`.
   - `deletionScheduledAt` set: only `/account-disattivato` and `POST /api/user/reactivate` are reachable; other APIs get 403.
   - Onboarding done but legal version outdated (`needsLegalAcceptance`): only `/accetta-termini` and the APIs for acceptance, export and account deletion are reachable.
   - Onboarding not done: pages redirect to `/onboarding`.
   - `isCountryPathAvailable(productCountry, pathname)` false: APIs get 403 `{ code: "country_feature_unavailable" }`, pages redirect to `/country-unavailable`.
2. **`withRoute(name, handler)`** creates the request context (`requestId` from a valid `x-request-id` header or a new UUID, `route`, `method`), runs the handler, turns an uncaught exception into a generic 500, logs `http.request.completed` or `http.request.failed`, records `buddybudget_http_requests_total` and the duration histogram, and returns `x-request-id`. Error responses get a stable `code` when the handler set none (`withErrorCode` in [`lib/http/api-error.ts`](../../lib/http/api-error.ts): a JSON body with `error` gets the generic code of its status, `bad_request`, `not_found`, `conflict`…, an empty 4xx body becomes `{ code }`, 401 stays empty) and the `error` message in the user's language. Routes set specific codes with `apiError(status, code, message)` and `validationError(zodError)` (`validation_failed` + `field`); the closed list is `API_ERROR_CODES`.
3. **The handler** reads the session, calls `bindRequestUser` (the log field `user` is `hashUserId(id)`, an HMAC with `LOG_HASH_SECRET`), optionally checks `rejectIfDemoActive`, parses the body with a zod schema from `lib/validation/`, runs Drizzle queries filtered by `userId`, and returns `Response.json`. 14 handlers for country-gated areas (goals, pension, sidebar FIRE, tax carry-forwards, analytics) are also wrapped in `withCountryGuard` from [`lib/localization/guard.ts`](../../lib/localization/guard.ts), which repeats the proxy check.
4. **The client** uses a hook from `lib/queries/<area>.ts`. Mutations call `track(<event>)` from `lib/analytics` on success and invalidate the query keys they change.

Worked example. A user with `productCountry = "DE"` requests `GET /api/pension`. The proxy finds a session, onboarding done, legal version current, then `isCountryPathAvailable("DE", "/api/pension")`: the path is not one of the dedicated planning routes, and `/api/pension` is in the blocked prefix list, so the response is 403 `country_feature_unavailable`. The same user requesting `/investimenti/tasse` passes, because `isPlanningAvailable("DE", "tax")` is `true`.

### 4.3 Authentication

[`lib/auth/index.ts`](../../lib/auth/index.ts) configures better-auth with the Drizzle adapter on the four `auth_*` tables.

| Aspect | Behaviour |
|---|---|
| Methods | Magic link (plugin `magicLink`, expires after `MAGIC_LINK_EXPIRES_MINUTES` = 10), Google OAuth (only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set) and, for the native apps, a 6-digit emailed code (plugin `emailOTP`, `SIGN_IN_OTP_EXPIRES_MINUTES` = 10, stored hashed, 3 attempts; `POST /api/auth/email-otp/send-verification-otp` then `POST /api/auth/sign-in/email-otp`) |
| Native sessions | Plugin `bearer`: `Authorization: Bearer <token>` works wherever `getSession` runs; sign-in responses return the token in `set-auth-token` |
| Email | Resend when `RESEND_API_KEY` is set; otherwise `logMagicLink` writes the link to the server log (self-hosting). A Resend error throws, so the UI does not claim the email was sent. Sign-in codes: outside production, when Resend is missing or fails, `logDevOtp` writes the code in the `auth.otp.dev_code` event (field `devCode`); in production the code is never logged (`auth.otp.undeliverable` / `auth.otp.failed`). Metrics `auth_events_total{event="otp_sent"\|"otp_failed"}` |
| Last method | Plugin `lastLoginMethod` sets a cookie the login page reads |
| Sessions | `expiresIn` 7 days, `updateAge` 1 day (`SESSION_EXPIRES_IN_DAYS`, `SESSION_UPDATE_AGE_DAYS`) |
| OAuth tokens | `encryptOAuthTokens: true` (encrypted with `BETTER_AUTH_SECRET`); account linking enabled |
| Hooks | Session create: IP truncated (`truncateIp`), `auth_events_total{event="sign_in"}`, `touchLastActive`. Session update: `touchLastActive` (feeds the inactive-accounts cron). User create: default categories inserted |
| Rate limiting | better-auth's built-in limiter. `app/api/auth/[...all]/route.ts` counts its 429 responses as `auth_events_total{event="rate_limited"}`. No Redis storage is configured for it |

### 4.4 Postgres, Drizzle and migrations

[`lib/db/client.ts`](../../lib/db/client.ts) creates one `postgres.js` client and one Drizzle instance with the full schema. `resolveDbSsl` ([`lib/db/ssl.ts`](../../lib/db/ssl.ts)) forces `ssl: "require"` in production unless the URL sets `sslmode` explicitly.

Migration flow:

| Step | Command or component | Detail |
|---|---|---|
| Generate | `pnpm db:generate` | `drizzle-kit generate` from `lib/db/schema/index.ts` into `lib/db/migrations/` ([`drizzle.config.ts`](../../drizzle.config.ts)) |
| Apply locally and in CI | `pnpm db:migrate` | [`lib/db/migrate.ts`](../../lib/db/migrate.ts) runs Drizzle's `migrate`; CI runs it before the test shards |
| Apply in production | `migrator` Docker target | Image `buddy-budget-migrate`, run by the ArgoCD `PreSync` hook Job `buddy-budget-migrate` (infra `argocd/manifests/app/migration-job.yaml`, `backoffLimit: 2`). The rollout waits for it |
| Apply in self-hosting | `migrate` service in [`docker-compose.yml`](../../docker-compose.yml) | Same image; the app depends on it |
| Baseline | `pnpm db:mark-baseline` | One-off: inserts the baseline row into Drizzle's journal on an existing database ([`lib/db/baseline.ts`](../../lib/db/baseline.ts)) |

The journal ([`meta/_journal.json`](../../lib/db/migrations/meta/_journal.json)) lists 40 migrations, from `0000_baseline` to `0040`. The number 0030 is not used; the journal, not the file numbering, is authoritative.

### 4.5 Field encryption

[`lib/crypto/field-encryption.ts`](../../lib/crypto/field-encryption.ts) encrypts selected text columns with AES-256-GCM and the 32-byte key `DATA_ENCRYPTION_KEY` (base64). The column type `encryptedText` ([`lib/db/schema/encrypted-text.ts`](../../lib/db/schema/encrypted-text.ts)) is a Drizzle custom type: the database column stays `text`, `toDriver` calls `sealForDb`, `fromDriver` calls `openFromDb`.

```text
stored = "enc:v1:" + base64( iv[12 bytes] | authTag[16 bytes] | ciphertext[n bytes] )
write:  key set   → encrypt (an already encrypted value is returned unchanged)
        key unset → plain text
read:   no "enc:v1:" prefix → returned as is
        prefix, key set     → decrypt
        prefix, key unset   → throw
```

Worked example. A 5-byte description becomes 12 + 16 + 5 = 33 bytes, which is 44 base64 characters, so the stored value is 7 + 44 = 51 characters long. The IV is random, so the same text gives a different value each time.

Encrypted columns (also the list in `ENCRYPTED_COLUMNS` of [`lib/db/encrypt-fields.ts`](../../lib/db/encrypt-fields.ts)): `transactions.description`, `transactions.raw_description`, `transactions.note`, `debt_events.note`, `investment_transactions.note`, `investment_tax_carryforwards.note`, `gocardless_token.access_token`, `goals.name`, `import_format_profiles.metadata`. These columns must not be filtered, sorted or grouped in SQL. Existing plain rows are encrypted by `pnpm db:encrypt-fields` (count only) and `pnpm db:encrypt-fields --execute`; in the cluster these are two suspended CronJobs run by hand.

Two other encryption mechanisms exist and are separate: personal CSV files and previews use `PERSONAL_CSV_ENCRYPTION_KEY` with the owner id as additional authenticated data ([`lib/personal-import/crypto.ts`](../../lib/personal-import/crypto.ts)), and Google OAuth tokens are encrypted by better-auth.

### 4.6 Redis

One `ioredis` client with `lazyConnect` ([`lib/redis/client.ts`](../../lib/redis/client.ts)). `REDIS_URL` is required; the module throws at import without it.

| Use | Key families | Code |
|---|---|---|
| Sync job state and per-account locks | `sync-job:*`, `sync-jobs:*`, `sync-lock:*` | [`lib/sync-jobs/redis-store.ts`](../../lib/sync-jobs/redis-store.ts) |
| Cron heartbeats and running-job index | `ops:heartbeat:cron:*`, `ops:sync-jobs:running` | [`lib/observability/redis-ops-store.ts`](../../lib/observability/redis-ops-store.ts) |
| GoCardless API rate limits | per external account and endpoint | [`lib/gocardless/redis-rate-limit-store.ts`](../../lib/gocardless/redis-rate-limit-store.ts) |
| Market data: backfill state, provider daily budget, Yahoo session and cooldown, search caches, crypto catalog, fundamentals cache, attempt markers | `market:*` | [`lib/market-data/redis-stores.ts`](../../lib/market-data/redis-stores.ts), [`lib/market-data/fundamentals.ts`](../../lib/market-data/fundamentals.ts), [`lib/market-data/runtime.ts`](../../lib/market-data/runtime.ts) |
| AI commentary cache and per-user cooldown | `market:commentary:*`, `market:commentary-cooldown:*` | [`app/api/instruments/[id]/commentary/route.ts`](../../app/api/instruments/[id]/commentary/route.ts) |
| Investment history fingerprint (skip recompute when nothing changed) | `net-worth:investments:fingerprint:*` | [`lib/net-worth/redis-history-state.ts`](../../lib/net-worth/redis-history-state.ts) |
| Merchant and instrument logo caches | domain cache per name | [`lib/categorization/merchant-logo/redis-store.ts`](../../lib/categorization/merchant-logo/redis-store.ts), [`lib/investments/logos/redis-logo-store.ts`](../../lib/investments/logos/redis-logo-store.ts) |
| Per-user quotas | `client-errors:*`, `support:report:*` | [`lib/client-errors/quota.ts`](../../lib/client-errors/quota.ts), [`lib/support/send.ts`](../../lib/support/send.ts) |
| Readiness | `PING` | [`app/api/health/ready/route.ts`](../../app/api/health/ready/route.ts) |

Account reset deletes the user's sync-job keys and investment fingerprint ([`lib/account/lifecycle.ts`](../../lib/account/lifecycle.ts)).

### 4.7 Observability in short

| Signal | Mechanism | Code |
|---|---|---|
| Logs | One JSON line per event, `event` in `domain.object.outcome` form, fields restricted to the closed `LogFields` type, errors passed through `redactText`; `console.*` is blocked by ESLint | [`lib/observability/logger.ts`](../../lib/observability/logger.ts), [`redact.ts`](../../lib/observability/redact.ts) |
| Request context | `requestLogger()` inherits `requestId`, `route`, `user` | [`request-context.ts`](../../lib/observability/request-context.ts) |
| Metrics | prom-client registry with prefix `buddybudget_`, `record*` functions with closed label enums; Redis-backed gauges read at scrape | [`metrics.ts`](../../lib/observability/metrics.ts), [`scrape-deps.ts`](../../lib/observability/scrape-deps.ts) |
| Scrape | `GET /api/metrics` with `Bearer <METRICS_TOKEN>`; 404 when the token is not configured | [`app/api/metrics/route.ts`](../../app/api/metrics/route.ts) |
| Uncaught render errors | `onRequestError` logs `next.request_error` with the route template | [`instrumentation.ts`](../../instrumentation.ts) |
| Boot | `register` validates the env with `parseServerEnv` and logs `app.process.started` | [`instrumentation.ts`](../../instrumentation.ts) |
| Probes | `/api/health` (liveness), `/api/health/ready` (Postgres `select 1` and Redis `PING`, 2 s timeout each) | [`lib/health/readiness.ts`](../../lib/health/readiness.ts) |
| Product events | `track()` to self-hosted Umami, event names in the closed `ProductEvents` interface | [`lib/analytics/track.ts`](../../lib/analytics/track.ts) |

### 4.8 Localization

[`lib/localization/`](../../lib/localization/) separates two settings stored on `auth_user`:

| Setting | Values | Decides |
|---|---|---|
| `productCountry` | `IT`, `DE` | Which financial models and routes exist (`FINANCIAL_COUNTRIES` in [`financial-country.ts`](../../lib/localization/financial-country.ts), `PLANNING_AVAILABILITY` in [`planning-availability.ts`](../../lib/localization/planning-availability.ts)) |
| `language` | `it`, `en`, `de` | Text and formatting locale (`it-IT`, `en-GB`, `de-DE`) |

Allowed pairs (`COUNTRY_LANGUAGES`): `IT` with `it` or `en`, `DE` with `en` or `de`. `resolveProfile` maps unknown stored values to `IT`/`it`, and a `DE` account with an unsupported language to `en`. Signed-out pages read the `bb-language` cookie; the country is then always `IT`.

Country capabilities today:

| Capability | IT | DE |
|---|---|---|
| Taxes engine (`features.taxes`) | Yes | No |
| Pension, retirement, income forecasts | Yes | No |
| Inflation | Yes (area `IT`) | Yes (area `DE`) |
| Stamp duty rate on investments | 0.2% | 0 |
| Dedicated German planning screens: tax, income | n/a | Yes (`/investimenti/tasse`, `/investimenti/proventi`, `/api/financial-planning`) |
| Dedicated German screens: pension, retirement, simulations | n/a | Hidden (`false` in `PLANNING_AVAILABILITY`) |
| Blocked prefixes | None | `/pensione`, `/analitiche`, `/investimenti/tasse` and `/investimenti/proventi` subpages, `/api/pension`, `/api/analytics`, `/api/goals`, `/api/sidebar/fire`, `/api/investments/tax-carryforwards` |

Strings: Italian is the source language. `translate(language, source)` in [`messages.ts`](../../lib/localization/messages.ts) looks the Italian source string up in [`catalogs/en.json`](../../lib/localization/catalogs/en.json) and [`catalogs/de.json`](../../lib/localization/catalogs/de.json) (German falls back to English, then to the source) and fills `{name}` placeholders. Server code uses `getTranslator()`; client code uses `useLocalization()` from [`provider.tsx`](../../lib/localization/provider.tsx). User-entered names and imported descriptions are never translated. German planning models live in [`lib/financial-planning/`](../../lib/financial-planning/).

### 4.9 Feature catalog

[`lib/features/catalog.ts`](../../lib/features/catalog.ts) is the single list of product features: `FEATURES` entries with `id`, `area` (one of `FEATURE_AREAS`), `name`, `description`, `status` (`live`, `new`, `soon`) and an optional `appPath`. The landing keeps a generated copy in [`landing/content/catalog.generated.ts`](../../landing/content/catalog.generated.ts), written by `pnpm sync:features` in `landing/`; the landing CI job runs `pnpm check:features` and fails if the copy differs. [`lib/features/catalog.test.ts`](../../lib/features/catalog.test.ts) checks unique ids and names, consistent counts, and that every sidebar entry in `NAV_ITEMS` has a catalog entry with the same status.

### 4.10 Landing

[`landing/`](../../landing/) is a separate Next.js project with its own `package.json`, lockfile, tests and Dockerfile. It builds with `output: "export"` and is served by nginx on port 3000 ([`landing/nginx.conf`](../../landing/nginx.conf)), which also serves a Markdown version of each page when the request sends `Accept: text/markdown`. It shares no runtime code with the app: it reads the generated catalog copy and screenshots in `landing/public/screens/`. CI builds and deploys it as its own image (`buddy-budget-landing`).

### 4.11 Mobile and PWA

The app is a responsive web app. Native iOS/Android apps are specified in the separate `buddy-budget-mobile-spec` repo and use the same API with `Authorization: Bearer` sessions (better-auth `bearer` plugin, email OTP sign-in). For them the server also computes views the web computes in the browser, with the same functions (`lib/views`): `GET /api/overview`, `GET /api/liquidity/month`, `GET /api/liquidity/analysis`, `GET /api/investments/{view,performance}`, the Italian `GET /api/investments/{income,taxes}` and `POST /api/investments/taxes/simulate-sale`, `GET /api/pension/view`, `GET /api/analytics/base`, `GET /api/debts?include=insights`, `GET /api/accounts?include=trend,health`, the paged `GET /api/transactions?limit&cursor` (`lib/liquidity/transactions-list.ts`), and default category names localized in `GET /api/categories`.

| Aspect | Behaviour | Code |
|---|---|---|
| Install | Web manifest with `display: "standalone"`, 192 and 512 px icons (any and maskable); `appleWebApp.capable` in metadata | [`app/manifest.ts`](../../app/manifest.ts), [`app/layout.tsx`](../../app/layout.tsx) |
| Offline | None: no service worker is registered | [`app/manifest.ts`](../../app/manifest.ts) |
| Install tracking | `PwaInstallTracker` sends `pwa_installed` on the browser's install event | [`components/analytics/pwa-install-tracker.tsx`](../../components/analytics/pwa-install-tracker.tsx) |
| Navigation | Bottom bar under 768 px: a floating rounded capsule inset from the edges (translucent with blur, above the safe area), active tab on a light grey pill with the brand teal icon, «Altro» ("More") menu; mobile top bar with the back button | [`components/layout/bottom-nav.tsx`](../../components/layout/bottom-nav.tsx), [`mobile-topbar.tsx`](../../components/layout/mobile-topbar.tsx), [`mobile-more-menu.tsx`](../../components/layout/mobile-more-menu.tsx) |
| Dialogs | Popovers, dialogs and alert dialogs render as draggable bottom sheets on the phone | [`lib/motion/sheet.ts`](../../lib/motion/sheet.ts), `components/ui/{dialog,alert-dialog,popover}.tsx` |
| Safe areas | `viewportFit: "cover"` | [`app/layout.tsx`](../../app/layout.tsx) |

### 4.12 Route groups

| Group | Path | Shell | Contents |
|---|---|---|---|
| `app/(app)` | `/`, `/panoramica`, `/liquidita` (+ `analisi`, `conti`, `categorie`, `regole`, `abbonamenti`), `/categorizza`, `/conti/collega/[connectionId]`, `/investimenti` (+ `operazioni`, `performance`, `diversificazione`, `proventi`, `tasse`, `rendiconti`, `rendiconti/importazioni`, `titoli`, `titoli/[id]`), `/pensione` (+ `andamento`, `dati`, `proiezione`, `scenari`), `/debiti` (+ `finanziamenti`, `simulatore`), `/analitiche` (+ `costi`, `crescita`, `prelievi`, `rischio`, `simulazione`, `obiettivi`, `obiettivi/[id]`), `/importazioni`, `/impostazioni`, `/aiuto`, `/country-unavailable`, `/style-guide` | `AttentionShell` with sidebar, bottom nav, sync panel | Authenticated product screens |
| `app/(auth)` | `/login`, `/onboarding`, `/accetta-termini`, `/account-disattivato` | `AuthFrame` with the language picker; preview panel hidden on `/onboarding` | Sign-in, onboarding and account gates |
| `app/disiscrizione` | `/disiscrizione` | Root layout only | Public email unsubscribe page |
| `app/api` | `/api/*` (118 handlers in 28 top-level folders) | None | Route Handlers, including `/api/cron/*` and `/api/auth/[...all]` |
| Root files | `manifest.webmanifest`, `robots.txt`, `icon.svg`, `global-error.tsx` | n/a | Metadata routes and the global error boundary |

Permanent redirects in [`next.config.ts`](../../next.config.ts) keep old paths working: `/spese`, `/transazioni`, `/movimenti` → `/liquidita`; `/cash-flow` → `/liquidita/analisi`; `/categorie` → `/liquidita/categorie`; `/movimenti/{analisi,categorie,regole}` → `/liquidita/...`; `/conti` → `/liquidita/conti`. The same file sets security headers (HSTS, `nosniff`, `X-Frame-Options: DENY`, referrer and permissions policies) and `output: "standalone"`.

### 4.13 Map of `lib/`

| Folder | Responsibility |
|---|---|
| `account/` | Account lifecycle: export, reset, deactivation and deletion, inactivity policy, sessions, last activity, `route-session` helpers |
| `analitiche/` | Analitiche ("Analytics") assumptions, data period, scenarios, simulations, plan |
| `analytics/` | Umami `track()` and the `ProductEvents` type, opt-out |
| `app-version/` | Build version, commit and time baked into the bundle |
| `attention/` | Badge counts and labels for items that need the user's attention |
| `auth/` | better-auth server config, client, magic link email, returning-user memory |
| `calc/` | Pure calculation engines (cash flow, expenses, returns, FX, FIRE, Monte Carlo, amortisation, early repayment, debt plan, pension, net worth, costs) |
| `categories/` | Default categories, spending groups (Dovute/Volute/Te futuro/Saltuarie — needs, wants, future you, occasional), seeding, picker |
| `categorization/` | Rules, merchant names and keys, AI suggestions, auto-apply at 90%, recategorise, merchant logos |
| `client-errors/` | Browser error reports and their per-user quota |
| `cron/` | `isAuthorizedCronRequest` |
| `crypto/` | Field encryption |
| `db/` | Drizzle client, schema, migrations, migration and maintenance scripts |
| `debts/` | Debt data loading, events, views, forms |
| `email/` | Shared email HTML template |
| `dev/` | Guards for dev-only tools (local database, test addresses) |
| `env.ts`, `format.ts`, `utils.ts` | Env validation, number/date formatting, class-name helper |
| `features/` | Feature catalog |
| `financial-planning/` | German tax, income, pension and AVD models |
| `goals/` | Savings goals: data, plan, views |
| `gocardless/` | GoCardless client, sync, scheduler, eligibility, rate limits, capacity, cleanup, consent notices |
| `health/` | Readiness checks |
| `http/` | Request helpers for route handlers: same-origin check for cookie writes, stable API error codes |
| `hooks/` | Small client hooks (media query, persisted flags, sidebar preferences) |
| `imports/` | Format metadata learned from imports |
| `investments/` | Positions, returns, allocation, exposure, dividends, alerts, broker imports, instrument icons and logos |
| `legal/` | Legal document links, version, acceptance |
| `liquidity/` | Liquidità ("Cash") view helpers: split, day groups, account series, spend curve, paged and filtered transaction feed |
| `llm/` | OpenRouter decision client used by categorisation |
| `localization/` | Country and language profile, route policy, translation catalogs, formatting |
| `market-data/` | Price, FX, inflation, rate, profile and dividend providers and their stores |
| `motion/` | Springs, dialog origin, bottom-sheet gestures |
| `navigation/` | Back-button history and logical parents |
| `net-worth/` | Daily snapshots, history rebuilds, scheduler |
| `notifications/` | Digest and alert emails, preferences, unsubscribe tokens, cron run |
| `observability/` | Logger, metrics, `withRoute`, ops store, redaction, user hashing |
| `overview/` | Panoramica ("Overview") sentence builder |
| `pension/` | Pension fund data, limits, import, context |
| `personal-import/` | AI-assisted personal CSV import queue and worker |
| `queries/` | TanStack Query hooks per area (client only) |
| `redis/` | Redis client |
| `release/` | Test that keeps package versions aligned |
| `sidebar/` | Sidebar summary, deadlines, FIRE module, module preferences |
| `start/` | «Primi passi» ("First steps") checklist and demo data |
| `subscriptions/` | Recurring charge detection views |
| `support/` | Support reports and their sending |
| `sync-jobs/` | Background sync job store, runner, views |
| `validation/` | zod schemas for API inputs |
| `views/` | Server-computed views for the native apps (Overview, Liquidità month and analysis, Investimenti tabs, Pensione, account extras): pure builders over the web's own calc functions, loaders in `views/server`, zod response schemas |
| `whats-new/` | «Novità» ("What's new") entries |

### 4.14 Architecture documents by domain

| Area | Document |
|---|---|
| Background jobs, crons, CSV worker | [background-jobs.md](background-jobs.md) |
| Investments: positions, returns, risk | [investments.md](investments.md) |
| Prices, FX, inflation, rates, profiles | [market-data.md](market-data.md) |
| Italian and German taxes | [taxes.md](taxes.md) |
| Pension funds and TFR | [pension.md](pension.md) |
| Debts and amortisation | [debts.md](debts.md) |
| Net worth snapshots and history | [net-worth.md](net-worth.md) |
| GoCardless sync, CSV and broker imports | [bank-sync-and-imports.md](bank-sync-and-imports.md) |
| Categories, rules, AI suggestions | [categorisation.md](categorisation.md) |
| Analitiche, FIRE, goals | [analytics-and-goals.md](analytics-and-goals.md) |

## 5. Limits and out of scope

- The layer rule is a convention; no lint rule enforces it, and `components/ui/` depends on `components/motion/` and `lib/`.
- No offline support and no push notifications: the PWA is installable only.
- better-auth's rate limiter is not backed by Redis, so its counters are per pod.
- `resolveDbSsl` can throw on multi-host Postgres URLs, and the migrator image does not force TLS (CLAUDE.md "Known technical debt").
- better-auth writes its internal errors to the console, outside `logger`.
- The "hide amounts" mask covers only values formatted with `formatCurrency`.
- No Content Security Policy header is set (comment in `next.config.ts`).
- Only strings passed through `translate` (server `getTranslator`, client `useLocalization`) change with the language; anything rendered as a literal stays Italian.

## 6. Tests

Tests run with Vitest against `DATABASE_URL` (a migrated database; CI runs `pnpm db:migrate` first, then two shards). Files ending in `.integration.test.ts` use the real database.

| File | Asserts |
|---|---|
| [`proxy.test.ts`](../../proxy.test.ts) | Deactivated, legal acceptance and onboarding gates, their order, allowed APIs |
| [`lib/observability/with-route.test.ts`](../../lib/observability/with-route.test.ts) | `x-request-id` handling, generic 500, quiet success, 429 as warn, static metric name, immutable redirect headers, user binding |
| [`lib/env.test.ts`](../../lib/env.test.ts) | Required and optional variables, names-only error message |
| [`lib/crypto/field-encryption.test.ts`](../../lib/crypto/field-encryption.test.ts) | Round trip with random IV, plain passthrough, no double encryption, failure without or with a wrong key, key length |
| [`lib/db/encrypt-fields.test.ts`](../../lib/db/encrypt-fields.test.ts), [`encrypt-fields.integration.test.ts`](../../lib/db/encrypt-fields.integration.test.ts) | Backfill of plain rows, idempotence |
| [`lib/db/ssl.test.ts`](../../lib/db/ssl.test.ts), [`baseline.test.ts`](../../lib/db/baseline.test.ts) | TLS resolution, baseline marking |
| [`lib/localization/config.test.ts`](../../lib/localization/config.test.ts), [`completeness.test.ts`](../../lib/localization/completeness.test.ts), [`guard.test.ts`](../../lib/localization/guard.test.ts) | Allowed country/language pairs, German route policy, catalog parity and interpolation, guard behaviour |
| [`lib/features/catalog.test.ts`](../../lib/features/catalog.test.ts) | Catalog integrity and sidebar consistency |
| [`lib/cron/auth.test.ts`](../../lib/cron/auth.test.ts) | Bearer check for crons and metrics |
| [`lib/health/readiness.test.ts`](../../lib/health/readiness.test.ts) | Readiness timeouts and per-dependency status |

## 7. Related

- Sibling architecture docs: [background-jobs.md](background-jobs.md), [investments.md](investments.md), [market-data.md](market-data.md), [taxes.md](taxes.md), [pension.md](pension.md), [debts.md](debts.md), [net-worth.md](net-worth.md), [bank-sync-and-imports.md](bank-sync-and-imports.md), [categorisation.md](categorisation.md), [analytics-and-goals.md](analytics-and-goals.md)
- Documentation index: [`docs/README.md`](../README.md); self-hosting: [`docs/self-hosting.md`](../self-hosting.md); releases: [`docs/rilasci.md`](../rilasci.md)
- Decisions: [`2026-10-12-cifratura-campi.md`](../decisioni/2026-10-12-cifratura-campi.md), [`2026-10-13-paese-prodotto-e-lingua.md`](../decisioni/2026-10-13-paese-prodotto-e-lingua.md), [`2026-10-14-pianificazione-finanziaria-germania.md`](../decisioni/2026-10-14-pianificazione-finanziaria-germania.md), [`2026-10-10-self-hosting-docker.md`](../decisioni/2026-10-10-self-hosting-docker.md), [`2026-10-15-english-as-repo-language.md`](../decisioni/2026-10-15-english-as-repo-language.md); earlier decisions in [`decision-log.md`](../decision-log.md)
- Specs: [`2026-07-03-tech-stack-architecture-design.md`](../superpowers/specs/2026-07-03-tech-stack-architecture-design.md), [`2026-09-27-osservabilita-app-fase-a-design.md`](../superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md)
