# Bank sync and imports

This part turns external financial data into rows of `transactions` and `investment_transactions`. Three channels feed it: Open Banking through GoCardless (balances and booked transactions of linked bank accounts), the personal CSV import (any bank or broker file, read by a parser that an AI model writes and a sandbox runs), and the broker imports (Interactive Brokers, DEGIRO, Trade Republic, Fineco, Yahoo Finance and a generic column mapping). The code lives in [`lib/gocardless`](../../lib/gocardless), [`lib/sync-jobs`](../../lib/sync-jobs), [`lib/personal-import`](../../lib/personal-import), [`lib/imports`](../../lib/imports) and [`lib/investments/import`](../../lib/investments/import), with the routes under [`app/api/gocardless`](../../app/api/gocardless), [`app/api/personal-imports`](../../app/api/personal-imports) and [`app/api/investments/import`](../../app/api/investments/import).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Capacity check | user, institution id | `pending` row in `bank_connections` + row in `bank_connection_attempts`, or a block reason | [`capacity.ts`](../../lib/gocardless/capacity.ts), [`capacity-store.ts`](../../lib/gocardless/capacity-store.ts) |
| Consent | institution, history days | GoCardless agreement + requisition, consent link | [`client.ts`](../../lib/gocardless/client.ts) `createRequisition`, [`connections/route.ts`](../../app/api/gocardless/connections/route.ts) |
| Callback | `?ref=<connection id>` | connection `linked`, `consentExpiresAt` = now + 90 days | [`callback/route.ts`](../../app/api/gocardless/callback/route.ts) (web, cookie) |
| Native return + complete | `?ref=<connection id>[&error=]`, then the app's bearer call | `buddybudget://bank/return?ref&status`; then connection `linked` + accounts to select | [`callback/native/route.ts`](../../app/api/gocardless/callback/native/route.ts), [`complete/route.ts`](../../app/api/gocardless/connections/%5Bid%5D/complete/route.ts), [`complete.ts`](../../lib/gocardless/complete.ts) |
| Finalize | chosen external accounts | `accounts` (`source = auto`) + `bank_account_links`, initial import job | [`finalize/route.ts`](../../app/api/gocardless/connections/%5Bid%5D/finalize/route.ts) |
| Sync | one link | balance update, new `transactions`, categorisation pass | [`sync.ts`](../../lib/gocardless/sync.ts) `syncAccountLink` |
| Sync job | links + Redis store | per-account progress on Redis | [`lib/sync-jobs/run.ts`](../../lib/sync-jobs/run.ts) `runSyncJob` |
| Cron sync | due links | same as Sync, sequential | [`scheduler.ts`](../../lib/gocardless/scheduler.ts) `runDueSyncs` |
| Maintenance cron | all connections, GoCardless lists | expired marks, emails, deletions | [`maintenance.ts`](../../lib/gocardless/maintenance.ts), [`cleanup.ts`](../../lib/gocardless/cleanup.ts) |
| Personal CSV | raw file + consent | encrypted job, parser, preview, then cash and investment rows | [`lib/personal-import`](../../lib/personal-import), [`scripts/personal-csv-worker.ts`](../../scripts/personal-csv-worker.ts) |
| Broker import | parsed operations or statement CSV | `investment_transactions`, broker statements | [`lib/investments/import`](../../lib/investments/import) |

```text
 GoCardless ──consent──> bank_connections ──finalize──> accounts + bank_account_links
      │                                                     │
      └─── balances + booked transactions <── sync (job or cron)
                                                            │
 personal CSV ──> personal_import_jobs ──worker──> preview ──confirm──┐
 broker file  ──> /api/investments/import (dry run, then write) ─────┤
                                                                     v
                         transactions / investment_transactions ──> categorisation pass
```

## 2. Principles

**P1 — Capacity is decided under one lock.** `reserveConnectionSlot` takes `pg_advisory_xact_lock(73519, 1)`, counts usage, decides and inserts the `pending` connection and the attempt row in one transaction. Concurrent requests cannot exceed the cap.

**P2 — Attempts are never forgotten early.** `bank_connection_attempts` keeps one row per consent started, even after the connection is deleted (`user_id` becomes null when the user is deleted). Rows older than 62 days are purged by `purgeOldAttempts`.

**P3 — Sync is idempotent.** Transactions are inserted with `onConflictDoNothing` on the unique `(account_id, external_id)`. GoCardless returns a rolling history window, so re-running a sync only inserts what is new.

**P4 — User-started work runs as a background job.** The manual sync and the initial import create a job on Redis and answer with `{ jobId }`; the work runs in `after()` with `maxDuration = 300`. Validation, ownership, eligibility and the per-account lock stay synchronous (404, 409, 429, 503 come back as HTTP responses).

**P5 — One sync per account at a time.** A Redis lock `sync-lock:<accountId>` (TTL 360 s) is shared by manual sync, initial import and cron. If Redis cannot be read the cron and the initial import proceed anyway, because the import is idempotent.

**P6 — Deleting on GoCardless is cautious.** The maintenance cron defaults to `dry-run`, uses grace periods, caps deletions at 25 per run and never deletes a linked (`LN`) requisition it does not know about unless it was approved one by one.

**P7 — The personal CSV is never parsed in the web request.** The file is encrypted and queued; a separate worker process generates and runs the parser in a sandbox. The model receives only the raw file text and the source name.

**P8 — Imports are all or nothing.** The personal CSV confirmation and the broker imports write accounts, instruments, cash and trades in a single database transaction; any validation error rolls everything back.

**P9 — Every import can be traced back.** Personal CSV jobs keep an `importLedger` with the ids they created, so one upload can be deleted without touching others.

## 3. Data model

Tables in [`lib/db/schema/bank-connections.ts`](../../lib/db/schema/bank-connections.ts):

| Table | Stores | Notes |
|---|---|---|
| `bank_connections` | one consent per user and institution: `requisitionId`, `status` (`pending`, `linked`, `expired`, `error`), `consentExpiresAt`, `expiryWarningSentAt`, `expiredNoticeSentAt`, `orphanedAt` | `requisitionId` is null until GoCardless answers |
| `bank_account_links` | link between a GoCardless account and an app account: `externalAccountId`, `lastSyncedAt`, `nextSyncEligibleAt`, `syncTimestamps` (last 4 successful syncs) | cascades with the connection and the account |
| `bank_connection_attempts` | `userId`, `createdAt` per consent started | basis of the 31-day counts |
| `bank_connection_interest` | one row per user who pressed «Tienimi aggiornato» while new connections are closed: `country` (product country), `createdAt`, `notifiedAt` | deleted with the user or with «Non avvisarmi più»; `notifiedAt` is for the single announcement email |
| `gocardless_token` | single row with the encrypted application access token | cache only |

Tables in [`lib/db/schema/personal-imports.ts`](../../lib/db/schema/personal-imports.ts) and [`import-format-profiles.ts`](../../lib/db/schema/import-format-profiles.ts):

| Table | Stores |
|---|---|
| `personal_formats` | a user's named source, its dedicated `accountId` and `portfolioId` |
| `personal_parsers` | immutable parser versions per format, encrypted (`encryptedParser`), with `signature` (`raw-csv-v1`) and `model` |
| `personal_import_jobs` | queue and lifecycle: `status`, `encryptedCsv`, `encryptedPreview`, `importLedger`, `attempts`, `lease`, `leaseUntil`, `failureReport`, `brokerProvider`, `sourceFingerprint`, email and support notification timestamps, `expiresAt` |
| `personal_import_receipts` | dedup receipts: `(formatId, recordKey)` unique, with `outcomeHash` |
| `import_format_profiles` | layout metadata per user, engine (`ai`, `native`, `mapping`) and fingerprint, encrypted; never sample values |

Imported rows land in `transactions` ([`transactions.ts`](../../lib/db/schema/transactions.ts)): `source` is `auto` for GoCardless and `manuale` for personal CSVs; `externalId` is the GoCardless id or `personal:<formatId>:<recordKey>`; `description` holds the cleaned merchant name and `rawDescription` the original bank text.

Always computed, never stored: the connection health shown to the user (`computeConnectionHealth`), sync eligibility (`computeSyncEligibility`), capacity usage, and the sync job status and "interrupted" flag (derived from account phases and heartbeat). Sync job state lives on Redis for 24 hours, not in Postgres.

## 4. How it works

### 4.1 Connection limits

Defaults from `DEFAULT_CAPACITY_LIMITS`, overridable by environment (`GOCARDLESS_MAX_CONNECTIONS_PER_USER`, `GOCARDLESS_MAX_ATTEMPTS_PER_USER`, `GOCARDLESS_MAX_CONNECTIONS`, `GOCARDLESS_PROVIDER_LIMIT`):

| Limit | Default | Meaning |
|---|---|---|
| `perUser` | 1 | distinct institutions with at least one linked account |
| `attemptsPerUser` | 3 | consents started by the user in the last 31 days (new, renewals, unfinished) |
| `global` | 40 | slots for new banks across the app |
| `provider` | 50 | GoCardless free-plan limit; renewals may use the reserve between 40 and 50 |

A request for an institution the user already has linked is a `renewal`; otherwise it is `new`. It is not documented which count GoCardless uses, so the app takes the larger one.

```text
if kind = new and not newConnectionsOpen    -> paused
used = max(live requisitions, attempts in last 31 days)
if used >= provider                         -> provider_limit
if kind = new and used >= global            -> global_limit
if kind = new and linkedInstitutions >= perUser -> user_limit
if userAttempts31d >= attemptsPerUser       -> user_attempts
else allowed
```

Example: 38 live requisitions and 41 attempts in the window give `used = 41`. A new bank is refused (`global_limit`); a renewal of an already linked bank is allowed while the user has fewer than 3 attempts. If GoCardless itself answers 402, the route marks the connection `error` and returns the same "full" message.

`newConnectionsOpen` comes from `BANK_CONNECTIONS_OPEN` (true/false). Unset, it is closed on the hosted version and open on a self-hosted install (`SELF_HOSTED=true`, which brings its own GoCardless keys). While closed (decision of 2026-10-19: GoCardless takes no new sign-ups and the free plan is nearly full), a new bank is refused with `paused` before any count, and renewals of a bank already linked go through the normal rules, so people who have a connection keep it. In the «Nuovo conto» dialog the bank step is one list (`BankPicker`): Trade Republic first, then «Altre banche · In arrivo» as a dashed card with «Tienimi aggiornato» (`BankComingSoon`, `POST`/`DELETE /api/bank-connection-interest`; the button is hidden on self-hosted installs), and a line to keep the account by hand or import a statement. Other block reasons show the same row with their own badge and sentence, without the button. With connections open, Trade Republic is the first row of the searchable GoCardless list instead. `GET /api/gocardless/capacity` returns `interested` so the dialog shows «Ti scriviamo quando è pronto.» on later visits. Counted in `buddybudget_gocardless_capacity{measure="interested"}` (people not written to yet) and `{measure="new_connections_open"}` (1/0); no announcement email is sent yet: when connections open again, a one-off send to the rows with `notifiedAt` null sets it.

### 4.2 Consent, callback and finalize

1. `POST /api/gocardless/connections` reserves the slot (4.1), then `createRequisition` creates an end-user agreement (`access_valid_for_days = 90`, scopes `balances`, `details`, `transactions`, `max_historical_days` from the request) and a requisition whose `reference` is the connection id and whose `redirect` is `<APP_URL>/api/gocardless/callback`. The route stores `requisitionId` and returns the bank link. Demo mode blocks this route.
2. `GET /api/gocardless/callback?ref=` loads the connection for the signed-in user only. If the requisition status is `LN` the connection becomes `linked` and `consentExpiresAt` is reset to now + 90 days (the consent counts from when the user gives it). Any other status sets `error`.
   The web shows a toast on `/liquidita/conti` for the `bankError` code the callback adds on failure.

   **Native apps** (`client: "native"` on step 1, or `ios`/`android`) get `redirect = <APP_URL>/api/gocardless/callback/native`. That route is public (the system browser has no session) and side-effect free: it maps GoCardless' `ref`/`error` to `buddybudget://bank/return?ref=<id>&status=returned|cancelled|failed|invalid_ref[&error=<code>]` and 302s there. The app then calls `POST /api/gocardless/connections/[id]/complete` with its bearer token: ownership check, then `LN` → `linked` (once; a retry keeps the expiry) and the accounts to select; `CR/GC/UA/SA/GA` → 409 `bank_consent_pending`, no change; any other status → 422 `bank_consent_failed`, `error` (never downgrading a `linked` row). `/banca/ritorno` is a public HTTPS page that deep-links to the same app address (future Universal/App Links target). A native connection stays `pending` until `complete`: the cleanup's abandoned-attempt grace and its LN check (4.7) cover an app that never calls it.
3. `POST /api/gocardless/connections/[id]/finalize` checks that every selected external account belongs to the requisition, and that any `existing` target account is the user's own `auto` account. It then creates accounts and links (or moves an existing link to the new connection, which is how a renewal keeps history), creates an `initial-import` job and starts `runSyncJob` in `after()`. Connections left without accounts by a renewal are released in `after()`.

`releaseConnectionIfUnused` deletes the requisition on GoCardless (404 counts as done) and then the row, only if no link exists. It also runs when an account is deleted (`DELETE /api/accounts/[id]`), so disconnecting the last account revokes the consent at once. It never throws; a failure is left to the maintenance cron.

### 4.3 Sync of one account

`syncAccountLink` does, in order:

1. Skip with `gocardless-limited` if the stored per-account rate limit for `balances` or `transactions` is at 0 (Redis keys `gocardless:ratelimit:<endpoint>:<accountId>`, filled from response headers).
2. Read balances, pick `interimAvailable` or the first one, and overwrite `accounts.balance`.
3. Read transactions and keep only `booked` (pending ones are ignored to avoid duplicates at booking).
4. For each transaction: `externalId = internalTransactionId ?? transactionId` (rows without either are skipped); the counterparty is `creditorName` for expenses and `debtorName` for income; `extractMerchantName` produces the stored `description`. Rules are resolved first on the legacy description (counterparty, else raw text) and then on the extracted name, so rules written before name extraction keep working. A matched rule sets `categoryId`, `excludedAmount`, `categorySource = regola`; otherwise the fallback category is used.
5. Insert in chunks of 50 (`SYNC_INSERT_CHUNK_SIZE`) with `onConflictDoNothing`, counting only rows actually inserted, and record rule hits only for those.
6. If some new rows are uncategorised, run `categorizeNewMovementsSafely` (AI suggestions, then auto-apply; see [categorisation.md](categorisation.md)) and recount.
7. Prepend the sync time to `syncTimestamps` (keep 4) and set `nextSyncEligibleAt = now + 4 h`.

A `401` from GoCardless marks the connection `expired` and returns `expired`. Other errors are rethrown; `syncAccountLinkObserved` records the metric and the `gocardless.sync.*` log first.

### 4.4 Sync eligibility

Manual and automatic syncs share one budget per account:

```text
window       = last 24 h (a timestamp exactly 24 h old is outside)
capOk        = syncs in window < 4
minGapOk     = now - lastSync >= 4 h
eligible     = capOk and minGapOk
nextEligible = max(lastSync + 4 h, oldestInWindow + 24 h when cap reached)
```

Example: syncs at 00:00, 04:00, 08:00 and 12:00. At 13:00 four syncs are in the window and the last one is 1 hour old: not eligible. The gap clears at 16:00, the cap at 00:00 the next day, so `nextEligibleAt` is 00:00.

The manual route answers 429 with `nextEligibleAt` and `syncsRemainingToday`.

### 4.5 Sync jobs

[`lib/sync-jobs`](../../lib/sync-jobs) follows the background-job standard (see [background-jobs.md](background-jobs.md)):

| Item | Value |
|---|---|
| Kinds | `initial-import`, `manual-sync` |
| Account phases | `queued`, `balance`, `fetching`, `saving`, then final `done`, `limited`, `expired`, `error` |
| Job status | `running` while any account is not final; `failed` only if all accounts are `error`; else `done` |
| Keys | `sync-job:<userId>:<jobId>`, one key per account, index `sync-jobs:<userId>`; TTL 24 h |
| Heartbeat | each update writes `updatedAt`; a 15 s keep-alive runs during slow GoCardless calls |
| Interrupted | `running` with no update for more than 60 s |

`runSyncJob` runs all accounts of a job in parallel, isolates their errors, always releases the account locks and marks the job in the ops store for the "running jobs" metric. Counters (`total`, `processed`, `inserted`, `categorized`, `uncategorized`) come from the real insert loop.

### 4.6 Cron sync

`GET /api/cron/gocardless-sync` (bearer `CRON_SECRET`) calls `runDueSyncs`: it selects links with `nextSyncEligibleAt <= now`, connection `linked` and user not scheduled for deletion, re-checks eligibility, takes the account lock, and syncs accounts one after another inside the request. Errors on one account do not stop the others. The run is recorded with `recordCronRun("gocardless_sync", ...)`. The cron does not use a job: no user waits for it.

### 4.7 Expiry warnings and maintenance

`GET /api/cron/gocardless-maintenance` runs `runGoCardlessMaintenance` once a day:

1. `markExpiredConnections`: `linked` connections with `consentExpiresAt <= now` become `expired`, so the cron sync skips them before a 401.
2. `sendConsentNotices`: one email per connection and phase, at most 50 per phase per run, only for connections that still have accounts and users not scheduled for deletion. `expiring` goes out when expiry is within 7 days; `expired` goes out for connections expired less than 30 days ago (or with no date). The timestamp is written only if the email was sent.
3. `purgeOldAttempts`: removes attempts older than 62 days.
4. `runGoCardlessCleanup`, unless `GOCARDLESS_CLEANUP_MODE=off`. Mode defaults to `dry-run`; only `execute` deletes.

Cleanup of known connections (`planConnectionCleanup`, pure):

| Case | Condition | Action |
|---|---|---|
| Abandoned attempt | `pending` or `error`, no accounts, created more than 3 days ago | delete requisition and row; if GoCardless reports `LN`, treat as orphan instead |
| Orphan | `linked`/`expired`, no accounts | first run sets `orphanedAt`; after 7 more days delete requisition and row |
| Expired | `expired` with accounts, expired more than 30 days ago | delete requisition, keep the row and accounts (`requisitionId = null`) |
| User scheduled for deletion | any | untouched |

Cleanup of what GoCardless has and the database does not (`planRemoteSweep`, skipped entirely when the database knows no requisition):

| Origin | Status | Action |
|---|---|---|
| ours (reference is one of our connection ids, or redirect is our callback: same origin, web or native path) | not `LN`, older than 3 days | delete (`stale_requisition`) |
| foreign | not `LN`, older than 30 days | delete only with `GOCARDLESS_CLEANUP_DELETE_UNKNOWN=true` |
| any | `LN` | logged as `linked_unknown`; deleted only if listed in `GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS` |
| agreements | not referenced by any requisition, older than 30 days | delete only with `DELETE_UNKNOWN` |

Any failed email or deletion makes the cron run count as an error, so the "cron failed" alert fires.

The user-facing state comes from `computeConnectionHealth`: `expiring` when 7 days or fewer remain (rounded up), `expired` when past the date even if the stored status is still `linked`.

### 4.8 Personal CSV import

**Enqueue.** `POST /api/personal-imports` requires a same-origin request, `PERSONAL_CSV_ENCRYPTION_KEY`, `consent: true` and `consentVersion: "openrouter-raw-zdr-v3"`. `enqueue` takes a per-user advisory lock and enforces at most 30 uploads per 24 hours and 10 jobs `queued` or `processing` (a batch of exports of one bank). A file whose fingerprint matches a job still `queued`, `processing` or `ready` returns that job. The answer carries the job's `formatId`, so the upload form sends the next files of a batch to the source the first one created. Every upload stores `sourceFingerprint = sha256` of the file text (BOM, line endings and trailing blank lines removed). Unless `regenerate` is set, a file whose fingerprint matches an `imported` job of the same user is refused before any analysis, whatever source was picked (`409`, code `already_imported`, «Questo file è già stato importato: i suoi movimenti ci sono già tutti.»), so the same file never reaches the model twice. It reuses or creates the `personal_formats` row and, unless `regenerate` is set, attaches the latest parser of that format. The file (at most 25 MB and 50,000 lines) is sealed with AES-256-GCM, with the user id as additional data. The job expires after 7 days.

**Worker.** [`scripts/personal-csv-worker.ts`](../../scripts/personal-csv-worker.ts) loops: `maintainJobs`, then `processOne`, sleeping 5 s when idle. `processOne` claims the oldest job with `FOR UPDATE SKIP LOCKED` (also `processing` jobs whose lease expired), never one whose source already has a job `processing` under a live lease, sets a 5-minute lease and increments `attempts`. When a job saves a new parser version, the `queued` jobs of the same source switch to it: in a batch of a new bank only the first file calls the model. All later writes are fenced by the lease id.

**Parser: the recovery ladder.** `runLadder` ([`analysis.ts`](../../lib/personal-import/analysis.ts)) reads the file with the source's saved parser (step 0) or, failing that, asks the model again with more each time (decision of 2026-10-31):

| Step | Model call | Context added | `max_tokens` | Reasoning | Timeout |
|---|---|---|---|---|---|
| 0 | none: latest saved parser of the source | | | | |
| 1 | `OPENROUTER_MODEL` (Flash) | the source's old parser when step 0 failed | 32,768 | off | 240 s |
| 2 | Flash | the last rejection: its parser as the model's own answer, the reason, up to 50 failing lines with their raw text, the undeclared columns | 32,768 | off | 240 s |
| 3 | Flash | every rejection, up to 200 failing lines each | 131,072 | on (`effort: high`, excluded from the answer) | 900 s |

A step **passes** (`judgeParser`) when `runCheckedParser` passes, no outcome is `error`, and `undeclaredColumns` ([`declared-columns.ts`](../../lib/personal-import/declared-columns.ts)) finds nothing: the header line of each declared section (the line holding most of its declared column names, at least two) must have every non-empty cell declared in the metadata, mapped or with `mapsTo=[]`. The first passing step wins and its parser becomes a new version of the format; a bank that changes its layout simply gets a new version. Only a wrong parser climbs: `TransientError` (provider 5xx/429, network, timeout, unreadable provider body, sandbox unavailable) propagates and the job is retried later from the same step; `ModelInputError` (input refused with 400/413/422, missing configuration, a job under an older consent) ends the job; `ModelOutputError` (answer not JSON, not a parser) climbs, and an answer cut at the budget (`finish_reason: length`) jumps straight to step 3. Every rejection is persisted in `failureReport.attempts` (step, model, reason, detail, row count and one-based rows; never text or code) before the next call, so a restarted worker resumes after the last recorded step. A keep-alive pushes the 5-minute lease forward every minute while the ladder runs. After step 3 the job is `failed` with one message (`importFailedMessage`: the team has been told, write to support; on self-hosted installs, see the worker log) and the support report lists every attempt.

The request ([`generate.ts`](../../lib/personal-import/generate.ts)) is a static system prompt (parser contract, settlement rules, metadata, hints, acceptance checks), then `{ sourceName, hints, rawCsv }` with the whole file, then the reference and the rejections. `hints` ([`hints.ts`](../../lib/personal-import/hints.ts)) carries no personal data: `defaultCurrency` (the user's currency, for files that state none), `today`, `dateOrderHint` (`dmy` for Italy and Germany, only to break ties) and `fileKind` (`bank`, `broker` or `unknown` from keywords in the first 60 lines). Every request sends `temperature: 0`, JSON mode and `provider: { ...OPENROUTER_PRIVACY, require_parameters: true }` (zero data retention, `lib/llm/openrouter.ts`). The answer must be a JavaScript `function(table)` plus layout metadata. Cash outcomes may carry `bankCategory`, the bank's own category of the row copied verbatim (a malformed one is dropped, never a reason to reject the row). When the parser gives none, `fillBankCategories` ([`bank-category-column.ts`](../../lib/personal-import/bank-category-column.ts)) reads it from the raw file without AI: it looks in the first 200 lines for a header with a category column («Categoria», «Category», «Kategorie», «Moneymap», plus an optional subcategory joined as «Categoria > Sottocategoria»), and reads that cell on each cash row below it with the same number of cells. This covers parsers saved before the field existed. `executeParser` runs the parser in a child Node process ([`scripts/personal-csv-sandbox.mjs`](../../scripts/personal-csv-sandbox.mjs)) with no environment secrets, a 512 MB heap, a 6 s kill timer and a 64 MB output cap. `runCheckedParser` runs it twice and rejects non-deterministic output, then applies `validateSourceAmounts` (a mapped `Amount`/`Importo` column must match the cash amount) and `validateBitpandaSettlements`.

**Outcomes.** Every physical line must get exactly one outcome (`validateOutcomes`):

| Kind | Fields | Effect at confirm |
|---|---|---|
| `cash` | date, currency, description, signed `amount`, `transfer` | one `transactions` row; `transfer = true` is fully excluded |
| `investment` | `acquisto`, `vendita`, `dividendo`, `cedola`, instrument, quantity, price, gross, fees, taxes | one `investment_transactions` row and one fully excluded cash row |
| `ignore` | reason | nothing |
| `error` | reason | rejects the parser: the ladder climbs, nothing is imported |

Dates must be real and not in the future; bonds (`obbligazione`) are refused. Cash effect of a trade:

```text
buy:      cash = -(quantity * price) - fees - taxes
sell:     cash =  (quantity * price) - fees - taxes
dividend: cash =  grossAmount - fees - taxes
stored  = round(cash * fxRate * 100) / 100   (fxRate to the user currency, per date)
```

Example (Bitpanda style, fee included in the fiat amount): fiat debit 200.00, quantity 0.005, fee 1.99. The parser must output `price = (200 - 1.99) / 0.005 = 39602`, so `-(0.005 * 39602) - 1.99 = -200.00`.

After the parser, the worker resolves historical exchange rates (retried, then the job fails if any is missing) and writes an encrypted preview; the job becomes `ready` and the parser is saved as a new version. There is no partial import and no screen to fix rows: a file is imported whole or not at all.

**Confirm.** `maintainJobs` confirms the oldest `ready` job automatically; the user can also confirm it with `POST /api/personal-imports/[id]`. A validation error at this stage (oversold history, profile currency changed, overlap with native broker imports) makes the job `failed` with that message and a support report. `confirmImport` runs under a second advisory lock and in one transaction: it checks the profile currency, recomputes dedup (4.9), adopts the account and portfolio of the source that holds the duplicates when the format has none yet and they all come from one other source, refuses broker fallbacks whose history overlaps native broker imports, creates the format's account `<name> · CSV` and portfolio `<name> · CSV` (tax regime `dichiarativo`, private instruments with `priceMode = manuale`) on first use, refuses oversold histories (`findOversoldTransaction`), inserts in chunks of 500, updates the account balance by the sum of the new cash rows, writes receipts and the `importLedger` (with `rows`, the movements of the file, and `alreadyPresent`, those already imported), and sets `imported`. The receipt, the list, the island and the result email read those two counts: all present gives «Niente di nuovo da importare» («Tutti i 40 movimenti del file c'erano già…»), some present gives «12 su 40 movimenti importati: gli altri c'erano già.» Ledgers written before the counts keep the generic line. New cash rows start in the fallback category, or in the user's transfer category when they are excluded, or in the category their `bankCategory` maps to when no user rule takes them (`categorySource = banca`, see [categorisation.md](categorisation.md) §4.6); the label is stored on the row either way and the ledger counts the mapped rows (`bankCategorized`, shown on the receipt). Rules and AI run afterwards through `categorizeNewMovementsSafely`.

**Other jobs of the worker.** It expires jobs past `expiresAt` (payloads erased), moves the last `review_failed` jobs (a state no longer reached) to `expired`, sends one result email per job (Resend idempotency key `personal-csv-<id>`, retry every 15 minutes) and one support report to `SUPPORT_EMAIL_TO` per job with a `failureReport` (every failed job, and every job that needed more than its first attempt), without file contents. Transient failures retry with backoff `attempts * 60 s`, at most 3 claims.

**Broker fallback.** When a native broker reader fails, the broker wizard can start a personal job with `brokerFallback`. `brokerFallbackSource` re-runs the native reader on the server; only structural failures qualify, and a file that reads correctly is refused. A request for a file still on its way returns that job (`sourceFingerprint`, which for older jobs is the SHA-256 of the raw text); an imported one is refused like any other upload.

This queue lives in Postgres with a dedicated worker, not on Redis with `after()`: the work exceeds `maxDuration`, the payload must survive restarts encrypted, and the `ready` state must be durable.

### 4.9 Deduplication

| Channel | Key | Behaviour |
|---|---|---|
| GoCardless | unique `(account_id, external_id)` | conflicts ignored |
| Personal CSV file | `sourceFingerprint` of the whole file, per user | the same file already imported is refused at upload |
| Personal CSV row | `recordKey = sha256(JSON(line)) + ":" + occurrence`; `outcomeHash = sha256(outcome without row and bankCategory)` | a key with a receipt in this format or in any other format of the user is skipped and counted in `alreadyPresent`, also when a newer parser reads the line differently |
| Personal CSV content | rows with a new line key, compared with the source's own account and portfolio between the file's first and last date: cash `date | cents in the user currency | description` (trimmed, lowercase, single spaces; against `rawDescription`, else `description`), trades `date | type | ISIN or name | quantity(8) | price(6) | gross(2)` | exact match only, counted as a multiset (`presentByContent`, [`content-match.ts`](../../lib/personal-import/content-match.ts)); skipped rows get no receipt and count in `alreadyPresent` |
| Broker mapping import | fingerprint `instrument | type | date | quantity(8) | price(6) | gross(2)` | counted: two identical file rows against one stored row give one new row |
| Broker statements | per-user lock and document fingerprint | see the broker guides |

Example (personal CSV): a file has the same line twice and the first upload stored both (`h:1`, `h:2`). A second upload with three copies imports only `h:3`.

Example (overlap): January to March is imported as «Intesa» (40 movements). The user exports February to April and picks «Nuova banca o broker», typing «Intesa» again. The 28 February and March rows already have receipts under the first format and are skipped; the 12 April rows go into the first format's account, and the receipt says «12 su 40 movimenti importati: gli altri c'erano già.» A row skipped because another format holds it gets no receipt of its own, so deleting the first import makes it new again. Uploading the January to March file again is refused at once.

Example (layout change): «Intesa» adds a Balance column. Every raw line changes, the saved parser leaves the new column undeclared and step 1 writes a new version. The 30 overlapping movements have new line keys but the same date, amount and description as rows already in the Intesa account, so they are skipped; two identical €1.50 coffees on one day with one stored import one. If the new parser builds the description differently (for example joining two columns), the exact match misses and those rows enter again: an accepted limit.

### 4.10 Broker imports

`POST /api/investments/import` takes either a column-mapped `operations` list (generic CSV, Fineco Excel, Yahoo Finance export: `runImport`, all into the default portfolio) or a `statementCsv` (Interactive Brokers, DEGIRO, Trade Republic: `runStatementImport`, re-parsed on the server and reconciled). It runs synchronously: `dryRun: true` returns the preview with `new`, `duplicate` and `error` per row; otherwise any error row blocks the whole write. Price history for new instruments starts in `after()`. Cash movements of statements go through the same categorisation pass as bank sync. Layout metadata of mapped files is stored in `import_format_profiles` with engine `mapping`. Provider-specific rules are in [`docs/ibkr-import.md`](../ibkr-import.md), [`docs/interactive-brokers-import.md`](../interactive-brokers-import.md), [`docs/degiro-import.md`](../degiro-import.md) and [`docs/trade-republic-import.md`](../trade-republic-import.md); the personal CSV runbook is [`docs/personal-csv-import.md`](../personal-csv-import.md).

### 4.11 Import management and undo

Investimenti, then Operazioni (Transactions), then «Gestisci importazioni» (Manage imports) lists broker statements and personal CSVs together. Deleting a personal upload is two-step: `previewPersonalImportDeletion` returns counts and a token (hash of the job, its ledger and the current rows); `deletePersonalImport` recomputes the token under both advisory locks with `serializable` isolation and refuses if it changed. It refuses when remaining sales would become oversold, subtracts the current amounts of the deleted cash rows from their accounts (edits after import are respected), deletes the ledger's rows and receipts and the job, and keeps formats, parsers, accounts and instruments. An upload made only of duplicates owns no rows and deletes nothing else. Broker statement deletion follows the broker guides.

## 5. Limits and out of scope

- One bank per person, 40 new banks in total; no waiting list and no visible remaining slots.
- Pending bank transactions are never imported.
- The cron sync has no time budget inside its `maxDuration` (known technical debt).
- Personal CSV: a file is imported whole or not at all, with no screen to fix rows (2026-10-31); the opening balance is zero; corporate actions and bonds are refused; the undeclared-column check needs at least two declared names on the header line; Bitpanda is the only source with an independent settlement check; structural checks cannot prove semantic correctness, and a `ready` job is saved without human review.
- The `mapping` parser kind is accepted by `parserSchema` and `executeParser`, but the generator only returns `javascript` parsers for raw files.
- Personal CSV jobs created under an older consent version are never sent to the AI again.
- Personal CSV dedup compares raw lines and, for new lines, the exact content within the source's own account: the same movement with a differently built description, in another account, or from GoCardless is not recognised as a duplicate.
- Broker statements (Interactive Brokers, DEGIRO, Trade Republic) are reconciled by period: the same statement is «niente di nuovo», a later or wider one extends or replaces the history, and a partly overlapping one is refused with «Sovrapposizione parziale».
- Rotating `PERSONAL_CSV_ENCRYPTION_KEY` makes stored parsers and payloads unreadable unless they are re-encrypted.

## 6. Tests

- [`lib/gocardless/capacity.test.ts`](../../lib/gocardless/capacity.test.ts), [`capacity-store.integration.test.ts`](../../lib/gocardless/capacity-store.integration.test.ts): limit parsing, decisions, the cap under concurrent requests, deleted connections still counting, closed new connections with renewals still allowed, «Tienimi aggiornato» counted once per person.
- [`sync-eligibility.test.ts`](../../lib/gocardless/sync-eligibility.test.ts): the 4-hour gap and the 24-hour window, with boundary cases.
- [`sync.test.ts`](../../lib/gocardless/sync.test.ts), [`scheduler.test.ts`](../../lib/gocardless/scheduler.test.ts), [`rate-limit.test.ts`](../../lib/gocardless/rate-limit.test.ts), [`client.test.ts`](../../lib/gocardless/client.test.ts): names, rules, dedup, due links, token cache.
- [`connection-health.test.ts`](../../lib/gocardless/connection-health.test.ts), [`consent-notices.test.ts`](../../lib/gocardless/consent-notices.test.ts), [`consent-emails.test.ts`](../../lib/gocardless/consent-emails.test.ts): expiry states and one-time emails.
- [`cleanup-plan.test.ts`](../../lib/gocardless/cleanup-plan.test.ts), [`cleanup.test.ts`](../../lib/gocardless/cleanup.test.ts), [`release.integration.test.ts`](../../lib/gocardless/release.integration.test.ts): grace periods, dry-run versus execute, unknown requisitions, release on account removal.
- [`lib/sync-jobs/*.test.ts`](../../lib/sync-jobs): store isolation between users, concurrent account updates, heartbeat, derived status.
- [`lib/personal-import/import.integration.test.ts`](../../lib/personal-import/import.integration.test.ts): the durable flow end to end (encryption, user isolation, lease recovery, retries, emails, dedup with shifted rows, the ladder with failing lines, layout change matched by content, reinterpreted lines, rollback on oversold history, deletion and reimport). Unit tests cover the contract, prompt and sandbox ([`contract.test.ts`](../../lib/personal-import/contract.test.ts)), the ladder ([`analysis.test.ts`](../../lib/personal-import/analysis.test.ts)), the exact match and hints ([`content-match.test.ts`](../../lib/personal-import/content-match.test.ts)) and broker fallback eligibility.
- [`lib/imports/metadata.test.ts`](../../lib/imports/metadata.test.ts): metadata never carries values; layout identity.
- [`lib/investments/import/*.test.ts`](../../lib/investments/import): parsers per broker, plan and execution.

## 7. Related

- [overview.md](overview.md), [background-jobs.md](background-jobs.md), [categorisation.md](categorisation.md), [investments.md](investments.md), [market-data.md](market-data.md), [net-worth.md](net-worth.md)
- Decisions: [`2026-10-19-collegamento-banca-in-arrivo.md`](../decisioni/2026-10-19-collegamento-banca-in-arrivo.md), [`2026-10-11-limite-collegamenti-bancari.md`](../decisioni/2026-10-11-limite-collegamenti-bancari.md), [`2026-10-12-pulizia-requisition-gocardless.md`](../decisioni/2026-10-12-pulizia-requisition-gocardless.md), [`2026-10-15-import-csv-righe-da-controllare.md`](../decisioni/2026-10-15-import-csv-righe-da-controllare.md), [`2026-10-15-metadati-formati-fallback-import.md`](../decisioni/2026-10-15-metadati-formati-fallback-import.md), [`2026-10-06-importazioni-in-operazioni.md`](../decisioni/2026-10-06-importazioni-in-operazioni.md), [`2026-10-08-csv-personali.md`](../decisioni/2026-10-08-csv-personali.md), [`2026-10-31-import-csv-tentativi-automatici.md`](../decisioni/2026-10-31-import-csv-tentativi-automatici.md); archive [`decision-log.md`](../decision-log.md) (2026-10-01 for expiry warnings and cleanup)
- Specs: [`2026-07-06-gocardless-open-banking-design.md`](../superpowers/specs/2026-07-06-gocardless-open-banking-design.md), [`2026-09-22-gocardless-sync-job-progress-design.md`](../superpowers/specs/2026-09-22-gocardless-sync-job-progress-design.md)

## Direct Trade Republic cash connection

New account → Connect your bank also offers Trade Republic independently of GoCardless's new-connection capacity. Choosing it opens the sign-in inside the dialog (`ConnectTradeRepublic`, three steps: phone and PIN, approval in the TR app or authenticator code, import started; Umami `bank_provider_chosen`); `/conti/trade-republic` shows the same form for reconnecting an existing account. Authentication requests are session-owned, same-origin checked against `APP_URL`, serialized and rate limited. Pending sessions expire in Redis after three minutes. `DATA_ENCRYPTION_KEY` is mandatory: TR cookies are never stored in plaintext, returned to the browser or written to logs.

After approval, the account endpoint verifies identity and the server stores an encrypted session in `trade_republic_connections`. A single authenticated WebSocket reads `cash` and the complete paginated `timelineTransactions` history. No CSV export endpoint is called. The initial import and subsequent manual syncs use the global sync panel and account locks. Each refresh writes cash movements and the official balance in one transaction, deduplicating by provider movement ID while preserving user notes and categories. Reconnecting reuses the verified account; disconnecting cascades the stored connection/session away. Cookie expiry prompts a new sign-in.

Supported scope is EUR cash and EUR securities, with an EUR main currency. Security trades/savings-plan executions stay out of spending, and dividend cash is included as cash only (never also as a `dividendo` operation, which would count it twice). Scheduled refresh is not implemented.

Investments follow the rules of [pytr](https://github.com/pytr-org/pytr) (`event.py`, `timeline.py`), the maintained open-source client, reimplemented in `lib/trade-republic/investments.ts`. After the cash import, a second WebSocket connection in the German locale (the layout pytr maps) reads both `timelineTransactions` and `timelineActivityLog`, merged by id. An item is a securities operation by its `eventType` (trade, Saveback/reward, incoming transfer) or, for `TIMELINE_LEGACY_MIGRATED_EVENTS`, its subtitle; cancelled items (item status, a cancelled/rejected/expired subtitle such as `Kauf-Abrechnung storniert`, or the detail header's `data.status`) are ignored, and a legacy order listed twice within 500 ms is kept once. A detail (`timelineDetailV2`) is read only when the item's `action` points at its own id; a reward without one granted no share. From the detail: ISIN from the instrument action or header icon, shares (`Aktien`/`Anteile`), fee (`Gebühr`) and tax (`Steuer`); buy or sell from the sign of the booked amount and the price from that amount net of costs. Free shares and incoming transfers become `rettifica` (quantity, value at booking, no money of the user). Positions come from `compactPortfolioByType` with the `securitiesAccountNumber` of `/api/v2/auth/account`, and every ISIN must end at that quantity; a refused subscription only disables this check. Instruments are resolved by ISIN in EUR like a statement import (verified Yahoo listing, else manual). The operations of the direct source (`brokerImportAccounts.provider = trade-republic-api`, its own `statementAccountKey`, a «Trade Republic» portfolio) are replaced as a whole on every sync, under the same advisory lock as broker statements, so resyncs never duplicate them. Any problem (unsupported securities event such as a corporate action or outgoing transfer, a detail without ISIN or shares, a position mismatch, an oversell) writes no operation, logs `trade_republic.investments.failed` with its diagnostic trail (an oversell includes that instrument's sequence of date, type, subtitle and side) and emails support; the cash import is committed regardless. The sync panel shows the steps after the cash movements («Importo gli investimenti…», «Categorizzo i nuovi movimenti…») and the outcome for investments, and the account window shows the latest sync's progress or result. A Trade Republic file statement is refused while a direct connection exists.

To debug the adapter against a real account without a server round trip: `pnpm exec tsx scripts/trade-republic-capture.ts <file>` signs in from a terminal (phone, PIN and codes typed there, never stored) and saves the raw cash, both timelines in English and German, every detail and the positions; `pnpm exec tsx scripts/trade-republic-replay.ts <file>` feeds that capture through the real cash and investment readers offline and prints, per instrument, the imported quantity against Trade Republic's, plus the oversell check. The capture holds personal financial data: keep it outside the repository and delete it afterwards. Failures happen before any writes and come in two kinds. Structural problems (page shape, repeated cursors, a balance that is not a single EUR amount) stop immediately. Item problems (an item that does not match the schema, a duplicate ID with changed data, a foreign currency, a future date) are collected over the whole timeline and then fail the refresh together, so one failure reports every one of them. Unknown event types and statuses are never guessed from their names: those events are skipped, counted, and reported in the sync panel («N movimenti non ancora riconosciuti»). Because every refresh rereads the full timeline and deduplicates by provider ID, adding a type in `lib/trade-republic/data.ts` back-fills its events on the next sync. Every refresh also checks whether all booked amounts add up to the reported balance (`reconciled`); a mismatch is logged, never shown to the user, because the balance always comes from Trade Republic directly. Histories are capped at 200 pages/20,000 events and four minutes of fetching. Existing TR file-import sources cannot be connected directly until removed: cross-source IDs have not been verified, so silently merging them would risk double counting. Protocol details and verification are recorded in [the decision entry](../decisioni/2026-10-25-trade-republic-connection.md).
