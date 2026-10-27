# Net worth

The net worth pipeline turns account balances, investment positions, pension fund snapshots and loan plans into one value per day, split by asset class, for the Panoramica (overview) chart, the composition row, the sidebar summary and Analitiche (analytics). Two classes are stored as daily rows in `net_worth_snapshots` (cash and investments); the other two (pension and debts) are rebuilt on every request from their own data. The pure calculations live in [`lib/calc/net-worth.ts`](../../lib/calc/net-worth.ts); the server side (snapshots, reconstruction, cron, history of computed classes) lives in [`lib/net-worth/`](../../lib/net-worth/); the read endpoint is [`app/api/net-worth/snapshots/route.ts`](../../app/api/net-worth/snapshots/route.ts).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Cash history (when inputs change) | accounts, transactions of ledger accounts (bank-synced and file-imported) | past `liquidita` rows corrected, missing days added as `derivato` | [`snapshots.ts`](../../lib/net-worth/snapshots.ts) `refreshDerivedCashHistory`, [`cash-history.ts`](../../lib/calc/cash-history.ts) `planCashHistory` |
| Cash snapshot (cron) | sum of account balances | today's `liquidita` row, `source = snapshot`, with its ledger part | `writeDailySnapshot` |
| Investment history | investment transactions, prices, FX | `investimenti` rows for past days | [`investments.ts`](../../lib/net-worth/investments.ts) `refreshDerivedInvestmentHistory` |
| Investment snapshot (cron) | today's portfolio value | today's `investimenti` row | `writeInvestmentSnapshot` |
| Debt history (on read) | `DebtsViewData` | negative `debiti` rows, not stored | [`debt-history.ts`](../../lib/net-worth/debt-history.ts) `buildDebtHistoryRows` |
| Pension history (on read) | pension fund snapshots | `previdenza` rows, not stored | [`pension-history.ts`](../../lib/net-worth/pension-history.ts) `buildPensionHistoryRows` |
| Read | `from`, `to`, `compact` | stored + computed rows | `GET /api/net-worth/snapshots` |
| Compact | rows | daily for ~13 months, monthly before | [`compact.ts`](../../lib/net-worth/compact.ts) `compactSnapshotRows` |
| Series | rows + today's values by class + period | chart points with `byClass` | [`net-worth.ts`](../../lib/calc/net-worth.ts) `buildNetWorthSeries` |
| Change | series | delta and percentage | `computeNetWorthChange` |

```text
cron net-worth-snapshot (06:50, 17:50, 23:50 UTC)
  └─ runDailySnapshots ─> snapshotUser
        ├─ refreshDerivedCashHistory   (liquidita, past days, only if inputs changed)
        ├─ writeDailySnapshot          (liquidita, today)
        ├─ refreshDerivedInvestmentHistory (investimenti, past days, only if inputs changed)
        └─ writeInvestmentSnapshot     (investimenti, today)

GET /api/net-worth/snapshots?from&to[&compact=1]
  ├─ refreshDerivedCashHistory + refreshDerivedInvestmentHistory   (same as cron, before reading)
  ├─ net_worth_snapshots rows in [from, to]
  ├─ + buildDebtHistoryRows(buildDebtsView(...))                 (debiti, computed)
  ├─ + buildPensionHistoryRows(loadUserPension().funds)          (previdenza, computed)
  └─ compactSnapshotRows (if compact=1)
        │
        ▼  client
buildNetWorthSeries(rows, todayByClass, period, today) ─> chart, change, composition
```

## 2. Principles

**P1 — Today is always live.** The last point of every series is built from current values passed by the caller (`todayByClass`), never from a stored row. `buildNetWorthSeries` ignores rows dated today or later.

**P2 — Debts and pension are computed, never stored.** Their history is rebuilt from loan plans and fund snapshots on each read, so any change to an event or a snapshot moves the whole history. `ASSET_CLASSES` lists them, but no code writes them to `net_worth_snapshots`.

**P3 — Idempotent writes.** One row per `(user_id, date, asset_class)` (unique constraint). The daily snapshot upserts; the cash and investment histories upsert only changed days, the cash one under a per-user advisory lock. Running the cron or the endpoint twice gives the same table.

**P4 — Real beats derived, data beats both.** A `snapshot` row overwrites a `derivato` row of the same day for cash. Recomputation updates the amount of past days but keeps the row's `source`; for cash it moves only the part that comes from ledger accounts, so the manual balances a snapshot recorded stay as they were.

**P5 — Recompute only on change.** The cash and investment histories are recomputed only when a fingerprint of their inputs differs from the one saved in Redis; losing Redis costs one extra recomputation, never a wrong value.

**P6 — Each class carries its own last value.** In the series, a class missing on a day repeats its last known value, so a day with only a cash row does not drop investments to zero.

**P7 — Errors are per user.** `runDailySnapshots` catches the error of one user, logs `net_worth.snapshot.failed` with the hashed user id, and continues with the next.

## 3. Data model

**`net_worth_snapshots`** ([`lib/db/schema/net-worth-snapshots.ts`](../../lib/db/schema/net-worth-snapshots.ts)):

| Column | Meaning |
|---|---|
| `user_id` | owner, cascade on user deletion |
| `date` | day (`date`) |
| `asset_class` | `liquidita` (cash) or `investimenti` (investments) in practice; the type also allows `previdenza` (pension) and `debiti` (debts) |
| `amount` | `numeric(14,2)` value at end of day |
| `source` | `snapshot` (written by the cron for that day) or `derivato` (reconstructed) |
| `ledger_amount` | cash rows only: the part of `amount` that comes from ledger accounts (see 4.1); null on rows written before migration 0043 |

Constraints: unique `(user_id, date, asset_class)`, index `(user_id, date)`. Asset classes and sources are `text` with constants, so a new class needs no migration.

Inputs read from other areas:

| Class | Source of truth | Today's value |
|---|---|---|
| `liquidita` | `accounts.balance` (all accounts of the user) | `computeAccountsKpi(accounts).totalLiquidity` |
| `investimenti` | `investment_transactions`, `instrument_prices`, `user_instrument_prices`, `fx_rates` | `buildInvestmentsView(...).summary.totalValue` (see [investments.md](investments.md)) |
| `previdenza` | pension fund snapshots (`loadUserPension`) | `pensionTotalOn(funds, today)` (see [pension.md](pension.md)) |
| `debiti` | `debts` + `debt_events` | `-buildDebtsView(...).overview.totalDebt` (see [debts.md](debts.md)) |

Always computed, never stored: today's point, the debt and pension history, the series, its monthly downsampling, the change, the composition shares.

Redis keys `net-worth:investments:fingerprint:<userId>` and `net-worth:cash:fingerprint:<userId>` (7-day TTL) hold the fingerprints of the last investment and cash history recomputations ([`redis-history-state.ts`](../../lib/net-worth/redis-history-state.ts)).

## 4. How it works

### 4.1 Cash history

A **ledger account** is one whose balance follows its transactions: a bank-synced account (`source = auto`) or the account a personal file import writes to (linked from `personal_formats.account_id`; the import adds every imported amount to its balance). For those the end-of-day balance of any past day is known exactly:

```text
ledger(day) = sum over ledger accounts of (balance - sum of its transactions dated after day)
```

Before an account's first transaction this is its opening balance (zero for an import account). Every other account is **manual**: since 2026-10-27 a transaction typed by hand moves its balance (`moveAccountBalance` in [`account-balance.ts`](../../lib/transactions/account-balance.ts), called by `POST /api/transactions` and by `PATCH`/`DELETE /api/transactions/[id]` in the same database transaction; the same call keeps import accounts right when one of their rows is edited or deleted by hand), but its transactions from before that date never did (migration 0051 added once those created after the account's last edit), so the balance minus later transactions is not its past and only the daily snapshots know what it was. A back-dated transaction on a manual account shows in the history on the day it is added, not on its date.

Each `liquidita` row stores `ledger_amount`, the ledger part of its `amount` when written. `refreshDerivedCashHistory(userId, today, state)` ([`snapshots.ts`](../../lib/net-worth/snapshots.ts), pure plan in [`cash-history.ts`](../../lib/calc/cash-history.ts) `planCashHistory`):

1. Builds a fingerprint from the user's accounts (count, sum of balances, latest change), transactions (count, latest change, sum), import-linked accounts, rows still without `ledger_amount`, and yesterday's date. If it equals the stored one, returns 0.
2. Under a per-user advisory lock, loads ledger accounts and their transactions and every past `liquidita` row.
3. For each past row: `amount = amount - old ledger part + ledger(day)`, `ledger_amount = ledger(day)`. Today's row is never touched.
4. Inserts a `derivato` row for each missing day from the first ledger transaction (at most `MAX_DERIVED_HISTORY_MONTHS = 24` months back, from the first day of the month) to yesterday. Its manual part is that of the previous stored row, else the next one, else the current manual balances.
5. Logs `net_worth.cash_history.refreshed` with `inserted`, `updated` and `durationMs`, and saves the fingerprint.

The old ledger part of a row written before `ledger_amount` existed is estimated from its `updated_at` (when it was last written): a bank account created by then counts with `ledger(day)` (the bank reported that balance), one created later counts zero; an import account counts the transactions created by then, whatever their date (that was its balance). From the first run on every row carries the exact value.

So a bank connected later, an imported file, an edited or deleted transaction and a deleted import all move every past day they touch, right at the next read. It runs from the cron, from `GET /api/net-worth/snapshots`, from the sidebar summary and from the Analitiche snapshot, so whichever is read first after an import sees the corrected history.

Example (today 2026-09-13; a manual account of 500 EUR has daily snapshots of 500 since 09-11; a file imported today brings +1,000 EUR on 09-09 and −200 EUR on 09-12, so the new account's balance is 800 EUR):

| Day | Before | Manual part | ledger(day) | After |
|---|---|---|---|---|
| 2026-09-09 | no row | 500 (next row) | 800 − (−200) = 1,000 | 1,500 (`derivato`, new) |
| 2026-09-10 | no row | 500 | 1,000 | 1,500 (`derivato`, new) |
| 2026-09-11 | 500 | 500 | 1,000 | 1,500 (`snapshot`) |
| 2026-09-12 | 500 | 500 | 800 | 1,300 (`snapshot`) |
| today | live | | | 500 + 800 = 1,300 |

Without the correction the chart stayed flat at 500 and jumped to 1,300 on the last point.

### 4.2 Daily cash snapshot

`writeDailySnapshot` sums `accounts.balance` of all the user's accounts and upserts today's `liquidita` row with `source = snapshot` and `ledger_amount` = ledger balances minus ledger transactions dated after today (`ledgerAmountToday`). Each of the three daily runs overwrites the same row, so the last run of the day wins.

### 4.3 Investment history

`refreshDerivedInvestmentHistory(userId, today, state)`:

1. Builds a fingerprint from count and latest change of the user's investment transactions, manual prices, prices of held instruments, FX rates of the held currencies and the user's currency, and the user's currency itself, plus yesterday's date (so every new day extends the history once).
2. If it equals the stored fingerprint, returns 0. If Redis is unreachable it logs `net_worth.history_state.unavailable` and recomputes.
3. Range: from the first investment transaction (at most `MAX_INVESTMENT_HISTORY_YEARS = 20` years back, matching the price backfill) to yesterday. With no past transaction it deletes all past `investimenti` rows.
4. Computes `computeDailyPortfolioValues` for the range, compares each day with the stored amount and upserts only the changed days in batches of 500.
5. Deletes `investimenti` rows dated before the first transaction (for example after the first operation was deleted).
6. Saves the fingerprint.

Today's row is never touched here; `writeInvestmentSnapshot` writes it from `computePortfolioSummary(...).totalValue` and skips users with no investment transaction. An operation inserted, edited or deleted with a past date therefore rewrites every day from that date onward, real rows included.

### 4.4 Debt history

`buildDebtHistoryRows(view, todayKey, fromKey)` turns each loan's `plan.residualSeries` (principal one month before the first instalment, then the residual after each due date and each early repayment) into a step function and sums them per day, from `max(fromKey, first point)` to yesterday:

```text
debiti(day) = -sum over loans of (last residual point with date <= day, else 0)
```

Example: a 12,000 EUR loan whose first instalment is due on 2026-03-15 and leaves a residual of 11,000 EUR gives `-12,000.00` every day from 2026-02-15 and `-11,000.00` from 2026-03-15, and so on. The residual follows the theoretical plan, so an unpaid overdue instalment still lowers it (see [debts.md](debts.md) 4.5).

### 4.5 Pension history

`buildPensionHistoryRows(funds, todayKey, fromKey)` emits one row per day from the first fund snapshot to yesterday, each the sum over funds of the last snapshot value dated on or before that day (`fundValueOn`). `pensionTotalOn(funds, date)` gives the same sum for a single date and is used for today's value.

Example: fund A snapshot 5,000 EUR on 2026-01-31 and 5,400 EUR on 2026-04-30 → 5,000 EUR every day from 2026-01-31 to 2026-04-29, then 5,400 EUR.

### 4.6 Read endpoint and compaction

`GET /api/net-worth/snapshots?from=YYYY-MM-DD&to=YYYY-MM-DD[&compact=1]` (`withRoute("net_worth.snapshots")`):

1. 401 without session, 400 if `from` or `to` is missing or malformed.
2. Runs `refreshDerivedCashHistory` and `refreshDerivedInvestmentHistory` for the user, so a new user, a just-imported file or a just-edited portfolio sees a complete history without waiting for the cron.
3. Reads stored rows in `[from, to]`, appends computed `debiti` and `previdenza` rows in the same window.
4. With `compact=1`, `compactSnapshotRows(rows, today)` keeps every row from the last `COMPACT_KEEP_DAYS = 400` days and, before that, only the last row of each month per class plus the first row of each class.

The Panoramica requests everything from `2000-01-01` to today with `compact=1` (`NET_WORTH_FETCH_FROM`), cached client side for 2 minutes (`SNAPSHOTS_STALE_TIME_MS` in [`lib/queries/net-worth.ts`](../../lib/queries/net-worth.ts)), so changing the period needs no new request.

### 4.7 Series by asset class

`buildNetWorthSeries(snapshots, todayByClass, period, today)`:

1. Groups rows by date and class, summing amounts; a class on a date is "estimated" if any of its rows is `derivato`.
2. Range from `getNetWorthPeriodRange`: `1mese`, `3mesi`, `1anno` go back 1, 3 or 12 months with the day clamped to the target month; `max` starts at the earliest row (or today).
3. Carries into the range the last value of each class before the start.
4. For each day from the start to yesterday, updates the classes present that day and emits a point with `byClass` (last value of each class seen so far), `value` = sum of `byClass`, `isEstimated` = any class estimated. Days before any class has a value are skipped.
5. Appends today's point from `todayByClass`, never estimated.
6. For `1anno` and `max`, keeps one point per month: the last day of each month, or today in the current month.

```text
value(day) = sum over classes c of lastKnown_c(day)
```

Example (`3mesi`):

| Day | Rows that day | `byClass` | `value` |
|---|---|---|---|
| 07-01 | liquidita 3,000; investimenti 10,000 | 3,000 / 10,000 | 13,000 |
| 07-02 | liquidita 2,900 | 2,900 / 10,000 | 12,900 |
| 07-03 | none | 2,900 / 10,000 | 12,900 |
| today | `todayByClass` = 2,950 / 10,200 / debiti −1,000 | 2,950 / 10,200 / −1,000 | 12,150 |

Helpers on the series leave `byClass` intact so hidden classes can still be drawn:

- `excludeClassFromSeries(series, "previdenza")` subtracts one class from `value`. The Panoramica applies it when the user turns pension off (`usePensionInNetWorth`, a per-device localStorage flag `bb:net-worth-include-pension`, on by default).
- `restrictSeriesToClasses(series, ["liquidita", "investimenti"])` recomputes `value` on the listed classes only (used by Analitiche, [`lib/analitiche/base.ts`](../../lib/analitiche/base.ts)).

### 4.8 Change over the period

```text
delta    = last.value - first.value
deltaPct = delta / |first.value|     (null if fewer than 2 points or first.value = 0)
```

Example: from 12,000 EUR to 12,600 EUR → delta 600 EUR, deltaPct 0.05 (5%). From −2,000 EUR to −1,000 EUR → delta 1,000 EUR, deltaPct 0.5.

### 4.9 Panoramica data and composition

The Panoramica page ([`app/(app)/panoramica/page.tsx`](../../app/(app)/panoramica/page.tsx)) assembles `todayByClass` on the client from separate queries:

| Class | Query | Present when |
|---|---|---|
| `liquidita` | `useAccountsQuery` (`/api/accounts`) | always (0 without accounts) |
| `investimenti` | `useInvestmentsOverviewQuery("1mese")` | the user has investment transactions |
| `previdenza` | `usePensionQuery` | value today > 0 |
| `debiti` | `useDebtsQuery` (`/api/debts`) | `overview.totalDebt > 0`, stored as a negative number |

Accounts, snapshots and month transactions are blocking: their errors show the load error. Investments, debts and pension are optional: on error the class is simply missing.

`buildCompositionItems` ([`net-worth-composition-row.utils.ts`](../../components/domain/net-worth/net-worth-composition-row.utils.ts)) builds one row per present class. Shares are computed on positive classes only; debts are a liability row with no share; an excluded pension stays listed with «fuori dal totale» ("outside the total") and no share.

Example: cash 5,000, investments 15,000, pension 5,000, debts 8,000 → shares 20% / 60% / 20%, debts shown as −8,000, net worth 17,000 EUR.

### 4.10 Sidebar summary

`loadSidebarSummary` ([`lib/sidebar/summary.ts`](../../lib/sidebar/summary.ts), `GET /api/sidebar/summary`) first runs `refreshDerivedCashHistory`, then computes the same total on the server:

```text
total       = sum(account balances) + portfolio value + pension today - totalDebt
monthChange = total - (stored rows of the latest day <= today-30 + pension(today-30) - debt(today-30))
```

The past stored value sums all rows of that single date; it does not carry each class forward like `buildNetWorthSeries`.

### 4.11 Cron schedule

`GET /api/cron/net-worth-snapshot` (`maxDuration = 300`, bearer `CRON_SECRET`) calls `runDailySnapshots` and records `recordCronRun("net_worth_snapshot", ...)`. It runs three times a day, 20 minutes after the market prices cron so investment values use fresh closes:

| Job | Schedule (UTC) | Where |
|---|---|---|
| `market-prices` | `30 6,17,22 * * *` | infra `argocd/manifests/app/cronjob-market-prices.yaml` |
| `net-worth-snapshot` | `50 6,17,23 * * *` | infra `argocd/manifests/app/cronjob-net-worth-snapshot.yaml`; same line in [`docker-compose.yml`](../../docker-compose.yml) for self-hosting |

`findUsersWithAccounts` selects users not scheduled for deletion (`deletion_scheduled_at IS NULL`) with at least one account or one investment transaction. Users with only debts or pension get no stored rows, which is fine because those classes are computed.

### 4.12 Sample data

Demo accounts (`accounts.is_demo`, see [`lib/start/demo.ts`](../../lib/start/demo.ts)) are not filtered out of net worth: while the demo is active they are the user's only accounts, because `rejectIfDemoActive` blocks creating real data. `startDemo` writes its own `liquidita` history as `derivato` rows; its accounts are manual, so the cash refresh only records a zero ledger part on them and leaves the amounts alone. `clearDemo` deletes the demo accounts, their transactions and every `liquidita` row of the user, so the first real account starts with a clean cash history.

### 4.13 Charts while data is imported

A file import runs on the CSV worker and a bank sync in `after()` (see [background-jobs.md](background-jobs.md)); when either ends, the client invalidates the history queries and calls `markHistoryRefreshPending()` ([`lib/queries/history-refresh-signal.ts`](../../lib/queries/history-refresh-signal.ts)), a tab-wide timestamp. `useChartRefreshState(query)` ([`lib/queries/chart-refresh.ts`](../../lib/queries/chart-refresh.ts), pure rule `chartRefreshState` in [`lib/net-worth/refresh-status.ts`](../../lib/net-worth/refresh-status.ts)) gives each chart one of three states:

| State | When | What the chart shows |
|---|---|---|
| `importing` | a personal import is `queued`/`processing`/`ready` or a sync job is running | «Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco.», old curve dimmed |
| `updating` | an import or sync ended and the chart's query has not received data newer than that end (or is fetching) | «Aggiorno il grafico con i nuovi movimenti…», old curve dimmed |
| none | otherwise; the mark is cleared once fresh data (or an error) arrives, and ignored if older than 2 minutes when the chart mounts | the chart |

`ChartRefreshNote` ([`chart-refresh-note.tsx`](../../components/domain/net-worth/chart-refresh-note.tsx)) floats over the chart, so it never moves the layout, and is a polite live region. It is used by the Panoramica net worth chart and the Liquidità hero (for one selected account it waits for the transactions query, for the total for the stored history). Before the first history exists, the Panoramica shows the same sentence in place of «L'andamento comparirà nei prossimi giorni.». Both polls it reads are already running in the layout, so it adds no requests.

## 5. Limits and out of scope

- **Manual accounts have no past.** A manual account added later appears as a jump on the day it is first snapshotted; on days with no row, manual accounts are assumed to hold the balance of the nearest row (or today's balance). Their single-account chart in Liquidità is a flat line at today's balance, and a back-dated transaction moves the balance from the day it is added.
- Broker cash accounts created by broker statement imports (IBKR, DEGIRO, Trade Republic) count as manual: their balance comes from the statement, not from their transactions.
- Deleting a ledger account takes it out of the whole history, like deleting its transactions. Days that were added for a deleted import stay, with only their manual part.
- The ledger part of rows written before migration 0043 is an estimate (see 4.1); a transaction deleted before that migration ran is not subtracted from rows that counted it.
- Cash reconstruction is capped at 24 months, investments at 20 years.
- Values are end-of-day as of the last cron run; there is no intraday history.
- The pension exclusion is a per-device preference, not stored on the account.
- Dates in [`lib/calc/net-worth.ts`](../../lib/calc/net-worth.ts) use local time (`toDateKey`), while debts use UTC (`todayIso`). They agree on servers running in UTC; a non-UTC server or browser can shift "today" by one day around midnight.
- Debts and pension are recomputed on every read; there is no cache.
- Points that contain any `derivato` value are flagged as estimated; since debt and pension rows are always `derivato`, every past point with a loan or a fund is flagged.

## 6. Tests

| File | What it asserts |
|---|---|
| [`lib/calc/net-worth.test.ts`](../../lib/calc/net-worth.test.ts) | local date keys; period ranges and month clamping; series carry-forward per class, summing classes, monthly downsampling, today's point from current values, estimated flags; exclude/restrict helpers; change with zero and negative starts |
| [`lib/calc/cash-history.test.ts`](../../lib/calc/cash-history.test.ts) | new user's history from bank transactions; no ledger accounts; a file imported after the snapshots moves past days and fills the days before; manual part kept; a deleted import leaves the history; estimate for rows without a ledger part; a bank connected later; today's movements; today's row untouched and 24-month cap; gaps filled; cents without float drift; today's ledger part |
| [`lib/net-worth/refresh-status.test.ts`](../../lib/net-worth/refresh-status.test.ts) | importing, updating until fresh data, quiet on ordinary refetches, settling |
| [`lib/personal-import/island.test.ts`](../../lib/personal-import/island.test.ts) | island states and ordering; an import that ended, also from «Righe da controllare» |
| [`lib/net-worth/compact.test.ts`](../../lib/net-worth/compact.test.ts) | recent rows kept, older rows reduced to month-end per class plus the first, order preserved |
| [`lib/net-worth/debt-history.test.ts`](../../lib/net-worth/debt-history.test.ts) | negative step rows from the first debt to yesterday, `fromKey` respected |
| [`lib/net-worth/pension-history.test.ts`](../../lib/net-worth/pension-history.test.ts) | last snapshot per fund summed, daily step rows, `fromKey` respected |
| [`lib/net-worth/snapshots.test.ts`](../../lib/net-worth/snapshots.test.ts) | cash history from bank transactions, skip when unchanged, a file imported after the snapshots, manual transactions ignored; daily snapshot with its ledger part, idempotent, overwrites a derived row (real DB) |
| [`lib/net-worth/investments.test.ts`](../../lib/net-worth/investments.test.ts) | history from first operation, past edits rewrite later days but not today, multi-year operations, deletion removes earlier days, recompute on new prices, skip when unchanged, recompute when the store fails (real DB) |
| [`lib/net-worth/scheduler.test.ts`](../../lib/net-worth/scheduler.test.ts) | user selection, cash history before the daily snapshot |
| [`app/api/net-worth/snapshots/route.test.ts`](../../app/api/net-worth/snapshots/route.test.ts) | 401, 400, history rebuilt before reading, rows scoped to the user |
| [`app/api/cron/net-worth-snapshot/route.test.ts`](../../app/api/cron/net-worth-snapshot/route.test.ts) | 401 without secret, 200 with secret, 500 when snapshots throw |

## 7. Related

- [overview.md](overview.md), [background-jobs.md](background-jobs.md), [investments.md](investments.md), [market-data.md](market-data.md), [pension.md](pension.md), [debts.md](debts.md), [bank-sync-and-imports.md](bank-sync-and-imports.md), [analytics-and-goals.md](analytics-and-goals.md)
- Decisions: [`docs/decision-log.md`](../decision-log.md) (2026-10-01 three runs a day; 2026-09-29 investment history recalculates itself), [`docs/decisioni/2026-10-10-primi-passi-e-dati-d-esempio.md`](../decisioni/2026-10-10-primi-passi-e-dati-d-esempio.md), [`docs/decisioni/2026-10-19-storico-liquidita-segue-i-movimenti.md`](../decisioni/2026-10-19-storico-liquidita-segue-i-movimenti.md)
- Spec: [`docs/superpowers/specs/2026-09-13-panoramica-patrimonio-netto-design.md`](../superpowers/specs/2026-09-13-panoramica-patrimonio-netto-design.md), decision [`docs/decisioni/2026-10-06-panoramica-bento.md`](../decisioni/2026-10-06-panoramica-bento.md)
