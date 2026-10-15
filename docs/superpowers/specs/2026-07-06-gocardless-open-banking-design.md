# Open Banking via GoCardless — design

**Date**: 2026-07-06
**Status**: approved, awaiting implementation plan

## Context

`docs/functional-spec.md` and `CLAUDE.md` marked real banking integration (Open Banking/PSD2) as out of scope for the current phase, deferred until a provider was chosen. Provider chosen now: **GoCardless Bank Account Data API** (formerly Nordigen). This spec covers the first end-to-end integration: account connection, periodic automatic sync, best-effort categorisation of imported transactions.

The existing data model was already prepared: `accounts.source` and `transactions.source` (enum `data_source`: `manuale`/`auto`), UI for Auto accounts (read-only on financial fields, badge, "Scollega" — "Disconnect") already built in `docs/superpowers/specs/2026-07-04-conti-screen-design.md`.

## Relevant GoCardless constraints

- Authentication **at the application level**, not per user: `secret_id`/`secret_key` → `access_token` (valid 24h, refresh up to 30 days). No user token to store/encrypt.
- The user consent (End User Agreement + Requisition) has a configurable expiry, up to 90 days; once expired it must be renewed with a new consent flow.
- The `GET /institutions` endpoint requires a `country` parameter — there is no cross-country search in a single call.
- Rate limit per account/endpoint exposed in the response headers (`remaining`/`reset`), varying by bank — not a single fixed documented number.
- GoCardless credentials do not exist yet: we start in sandbox; switching to production is just an env var change, no impact on the code.

## Data model

New tables (Drizzle, `lib/db/schema/`):

- **`bank_connections`**: `id` (uuid), `userId` (FK `auth_user`), `institutionId` (text, GoCardless id), `institutionName` (text), `requisitionId` (text), `status` (enum: `pending` | `linked` | `expired` | `error`), `consentExpiresAt` (timestamp), `createdAt`, `updatedAt`.
- **`bank_account_links`**: `id` (uuid), `connectionId` (FK `bank_connections`), `accountId` (FK `accounts`, the local account with `source: 'auto'`), `externalAccountId` (text, GoCardless account id), `lastSyncedAt` (timestamp, nullable), `nextSyncEligibleAt` (timestamp, default now).
- **`gocardless_token`**: a single cache row for the application access token — `accessToken` (text), `expiresAt` (timestamp). Automatic refresh via `secret_id`/`secret_key` when expired.

Changes to existing tables:

- **`transactions`**: new column `externalId` (text, nullable, `unique` together with `accountId`) — used for idempotent imports (dedup on later syncs via `ON CONFLICT`).
- **`categories`**: `"Da categorizzare"` ("To categorise", type `variabile`) added to `DEFAULT_CATEGORIES` — fallback when automatic matching finds nothing. No schema change.

## Connection flow

1. In "+ Aggiungi conto" (`add-account-form.tsx`): initial choice "Manuale" (existing form) / "Collega banca" ("Connect bank", new flow).
2. "Collega banca": country selection → search/list of institutions in that country (`GET /institutions?country=`).
3. Institution chosen → the backend creates a GoCardless `requisition` (redirect URL = our callback, `reference` = id of the `bank_connections` row just created with `status: pending`) → browser redirect to the returned consent link.
4. The user authorises on the bank's site/app → the bank redirects to `/api/gocardless/callback?ref=...`.
5. The callback fetches the requisition; if `status: linked`, for each external `accounts` entry returned it fetches the details (name, IBAN, type) and redirects to a client selection page.
6. The page shows a checkbox for each external account found. The user selects which ones to import.
7. On confirmation: for each selected account, create an `accounts` row (`source: auto`) + a `bank_account_links` row; `bank_connections.status = linked`. Right after, launch an initial sync targeted only at these accounts (full available history + current balance).

### Reconnection (expired consent)

Same "Collega banca" flow, but at selection (step 6) the user chooses "connect to existing account" instead of "create new" — it associates the returned external account with a local `accounts.id` that already exists. Updates `connectionId`, `externalAccountId`, resets `consentExpiresAt` on the existing `bank_account_links` row. Already imported transactions and history stay intact (no rewriting).

### Errors in the flow

- The user abandons the consent without returning to the callback: no rows created other than the initial `bank_connections` one (stays `pending`), no cleanup needed — stateless, freely retryable.
- Requisition rejected/suspended by the bank: `bank_connections.status = 'error'`, error toast, no account created.
- The bank shares zero accounts: the selection page shows an empty state.

## Sync engine, rate limiting, scheduler

- **Scheduler**: `node-cron`, started in `instrumentation.ts` (Next.js boot hook), 12h interval. Runs in-process in the Next.js container (no extra k8s resource) — a conscious choice despite the risk of duplication/interruption if scaled to multiple replicas, acceptable for now (single-instance `production` namespace).
- **Redis**: first real introduction in the project (so far only planned in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`, never implemented). Requires `REDIS_URL` + the `ioredis` client. Used to track the rate limit `remaining`/`reset` per `externalAccountId` after each GoCardless call.
- **Each tick**:
  1. Select `bank_account_links` with `nextSyncEligibleAt <= now()` and a connection that is not `expired`/`error`.
  2. For each: ensure a valid GoCardless `access_token` (cache `gocardless_token`, refresh if expired).
  3. Check the Redis counter for that account; if `remaining = 0` skip until the saved `reset`.
  4. `GET /accounts/{id}/balances` → update `accounts.balance`.
  5. `GET /accounts/{id}/transactions` → upsert into `transactions` via `externalId` (idempotent).
  6. Best-effort categorisation: look for the user's latest transaction with the same `description` (case-insensitive) that already has a category other than `"Da categorizzare"` → reuse that category; otherwise assign `"Da categorizzare"`.
  7. Update `lastSyncedAt = now()`, `nextSyncEligibleAt = now() + 12h`.
- **401 error / expired consent**: `bank_connections.status = 'expired'`, "Riconnetti" ("Reconnect") badge in the UI (see below), no automatic retry until the user reconnects.
- **GoCardless 5xx/network error**: log, no immediate retry — retried at the next tick (12h).
- **Out of scope, consciously decided**: no manual "Aggiorna ora" ("Update now") button in phase 1 (it opens a second rate-limit path to manage, not requested) — can be enabled in a future phase.

## UI

- `add-account-form.tsx`: initial step "Manuale" / "Collega banca".
- New "Collega banca" flow: country selection → institution search → consent redirect → (after the callback) selection of external accounts via checkboxes, or a "connect to existing account" dropdown in case of reconnection.
- `account-row.tsx`: "Riconnetti" badge when the associated connection has `status: expired`; a button that reopens the consent flow scoped to that account.
- Icon/colour of Auto accounts created by GoCardless: no fetching/use of institution logos (extra scope not requested) — generic default icon (`landmark`), customisable by the user as already planned for Auto accounts (`account-icon-color-picker.tsx`, unchanged).

## Testing

- **Unit**: category matching (match found / `"Da categorizzare"` fallback), `nextSyncEligibleAt` calculation, Redis rate-limit key logic (key format, TTL, reading `remaining`/`reset`).
- **Integration**: CRUD and per-user scoping of `bank_connections`/`bank_account_links` (same pattern as `lib/db/integration.test.ts`, already used for `accounts`), callback route with a mocked GoCardless client, idempotency of the transaction upsert (a repeated sync on the same `externalId` does not duplicate rows).
- No real calls to GoCardless in the automated tests — mocked at the HTTP level. The sandbox credentials (to be created) are only for manual end-to-end verification.

## Scope explicitly excluded (for now)

- Manual "Aggiorna ora" sync button (see above).
- Email notifications of consent expiry (UI badge only for now; Resend is already configured for auth, reusable in the future).
- Institution logos in the UI.
- Automatic retry/sophisticated backoff on 5xx errors (retried at the next tick, full stop).
- Multiple replicas of the Next.js process: the in-process scheduler assumes a single instance; if we scale horizontally in the future, scheduling will have to move to an external k8s CronJob (option evaluated and rejected for now in favour of deployment simplicity).

## Open questions

None: all the decisions for this phase were made during brainstorming (see the sections above). GoCardless credentials (sandbox) to be created outside this repo before manual end-to-end testing is possible.
