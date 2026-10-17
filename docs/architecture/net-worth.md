# Net worth

The net worth pipeline turns account balances, investment positions, pension fund snapshots and loan plans into one value per day, split by asset class, for the Panoramica (overview) chart, the composition row, the sidebar summary and Analitiche (analytics). Two classes are stored as daily rows in `net_worth_snapshots` (cash and investments); the other two (pension and debts) are rebuilt on every request from their own data. The pure calculations live in [`lib/calc/net-worth.ts`](../../lib/calc/net-worth.ts); the server side (snapshots, reconstruction, cron, history of computed classes) lives in [`lib/net-worth/`](../../lib/net-worth/); the read endpoint is [`app/api/net-worth/snapshots/route.ts`](../../app/api/net-worth/snapshots/route.ts).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Cash backfill (once) | accounts, transactions of `auto` accounts | `liquidita` rows with `source = derivato` | [`snapshots.ts`](../../lib/net-worth/snapshots.ts) `backfillDerivedHistory`, `deriveLiquidityHistory` |
| Cash snapshot (cron) | sum of account balances | today's `liquidita` row, `source = snapshot` | `writeDailySnapshot` |
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
        ├─ backfillDerivedHistory      (liquidita, once)
        ├─ writeDailySnapshot          (liquidita, today)
        ├─ refreshDerivedInvestmentHistory (investimenti, past days, only if inputs changed)
        └─ writeInvestmentSnapshot     (investimenti, today)

GET /api/net-worth/snapshots?from&to[&compact=1]
  ├─ backfillDerivedHistory + refreshDerivedInvestmentHistory   (same as cron, before reading)
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

**P3 — Idempotent writes.** One row per `(user_id, date, asset_class)` (unique constraint). The daily snapshot upserts; the cash backfill uses `ON CONFLICT DO NOTHING`; the investment history upserts only changed days. Running the cron or the endpoint twice gives the same table.

**P4 — Real beats derived.** A `snapshot` row overwrites a `derivato` row of the same day for cash. For investments, recomputation updates the amount of every past day but keeps the row's `source`.

**P5 — Recompute only on change.** The investment history is recomputed only when a fingerprint of its inputs differs from the one saved in Redis; losing Redis costs one extra recomputation, never a wrong value.

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

Constraints: unique `(user_id, date, asset_class)`, index `(user_id, date)`. Asset classes and sources are `text` with constants, so a new class needs no migration.

Inputs read from other areas:

| Class | Source of truth | Today's value |
|---|---|---|
| `liquidita` | `accounts.balance` (all accounts of the user) | `computeAccountsKpi(accounts).totalLiquidity` |
| `investimenti` | `investment_transactions`, `instrument_prices`, `user_instrument_prices`, `fx_rates` | `buildInvestmentsView(...).summary.totalValue` (see [investments.md](investments.md)) |
| `previdenza` | pension fund snapshots (`loadUserPension`) | `pensionTotalOn(funds, today)` (see [pension.md](pension.md)) |
| `debiti` | `debts` + `debt_events` | `-buildDebtsView(...).overview.totalDebt` (see [debts.md](debts.md)) |

Always computed, never stored: today's point, the debt and pension history, the series, its monthly downsampling, the change, the composition shares.

Redis key `net-worth:investments:fingerprint:<userId>` (7-day TTL) holds the fingerprint of the last investment history recomputation ([`redis-history-state.ts`](../../lib/net-worth/redis-history-state.ts)).

## 4. How it works

### 4.1 Cash history reconstruction (one-off)

When a user has no `liquidita` row yet, `backfillDerivedHistory` reconstructs past end-of-day cash from the transactions of `auto` (bank-synced) accounts. It runs from the cron and from the read endpoint; once any `liquidita` row exists (`hasAnySnapshot`) it is a no-op. Investment rows do not count, so they never block it.

`deriveLiquidityHistory(accounts, transactions, today)` walks backwards from yesterday:

```text
currentTotal = sum(balance of all accounts, auto and manual)
sumAfter     = sum(amount of auto transactions dated today or later)
for day = yesterday down to max(first auto transaction, first day of month 24 months ago):
    cash(day) = currentTotal - sumAfter
    sumAfter += sum(amount of auto transactions dated day)
```

Manual accounts contribute their current balance as a constant, because their transactions do not move the balance. The full `amount` is used even for split transactions. No points are produced without auto transactions.

Example (today 2026-09-13, one auto account at 1,000 EUR, a manual one at 200 EUR, auto movements −100 EUR on 09-11 and +50 EUR on 09-12):

| Day | Calculation | Cash |
|---|---|---|
| 2026-09-12 | 1,200 − 0 | 1,200 |
| 2026-09-11 | 1,200 − 50 | 1,150 |

The cap is `MAX_DERIVED_HISTORY_MONTHS = 24`, counted from the first day of the month.

### 4.2 Daily cash snapshot

`writeDailySnapshot` sums `accounts.balance` of all the user's accounts and upserts today's `liquidita` row with `source = snapshot`. Each of the three daily runs overwrites the same row, so the last run of the day wins.

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
2. Runs `backfillDerivedHistory` and `refreshDerivedInvestmentHistory` for the user, so a new user or a just-edited portfolio sees a complete history without waiting for the cron.
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

`loadSidebarSummary` ([`lib/sidebar/summary.ts`](../../lib/sidebar/summary.ts), `GET /api/sidebar/summary`) computes the same total on the server:

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

Demo accounts (`accounts.is_demo`, see [`lib/start/demo.ts`](../../lib/start/demo.ts)) are not filtered out of net worth: while the demo is active they are the user's only accounts, because `rejectIfDemoActive` blocks creating real data. `startDemo` writes its own `liquidita` history as `derivato` rows, so the backfill then sees an existing row and does nothing. `clearDemo` deletes the demo accounts, their transactions and every `liquidita` row of the user, so the first real account starts with a clean cash history.

## 5. Limits and out of scope

- **Cash history is reconstructed only once.** After the first `liquidita` row exists, `backfillDerivedHistory` never runs again. A manual account added later has no past rows, so it appears as a jump on the day it is first snapshotted; a bank connected after the first snapshot does not get its past reconstructed. (CLAUDE.md "Known technical debt".)
- Manual accounts are assumed to have held their current balance throughout the reconstructed window.
- Cash reconstruction is capped at 24 months, investments at 20 years.
- Values are end-of-day as of the last cron run; there is no intraday history.
- The pension exclusion is a per-device preference, not stored on the account.
- Dates in [`lib/calc/net-worth.ts`](../../lib/calc/net-worth.ts) use local time (`toDateKey`), while debts use UTC (`todayIso`). They agree on servers running in UTC; a non-UTC server or browser can shift "today" by one day around midnight.
- Debts and pension are recomputed on every read; there is no cache.
- Points that contain any `derivato` value are flagged as estimated; since debt and pension rows are always `derivato`, every past point with a loan or a fund is flagged.

## 6. Tests

| File | What it asserts |
|---|---|
| [`lib/calc/net-worth.test.ts`](../../lib/calc/net-worth.test.ts) | local date keys; cash reconstruction (no auto transactions, end-of-day walk, today's movements, manual accounts constant, split transactions at full amount, 24-month cap); period ranges and month clamping; series carry-forward per class, summing classes, monthly downsampling, today's point from current values, estimated flags; exclude/restrict helpers; change with zero and negative starts |
| [`lib/net-worth/compact.test.ts`](../../lib/net-worth/compact.test.ts) | recent rows kept, older rows reduced to month-end per class plus the first, order preserved |
| [`lib/net-worth/debt-history.test.ts`](../../lib/net-worth/debt-history.test.ts) | negative step rows from the first debt to yesterday, `fromKey` respected |
| [`lib/net-worth/pension-history.test.ts`](../../lib/net-worth/pension-history.test.ts) | last snapshot per fund summed, daily step rows, `fromKey` respected |
| [`lib/net-worth/snapshots.test.ts`](../../lib/net-worth/snapshots.test.ts) | backfill writes derived rows, is a no-op with existing rows or without auto accounts; daily snapshot idempotent and overwrites a derived row (real DB) |
| [`lib/net-worth/investments.test.ts`](../../lib/net-worth/investments.test.ts) | history from first operation, past edits rewrite later days but not today, multi-year operations, deletion removes earlier days, recompute on new prices, skip when unchanged, recompute when the store fails (real DB) |
| [`lib/net-worth/scheduler.test.ts`](../../lib/net-worth/scheduler.test.ts) | user selection, backfill before the daily snapshot |
| [`app/api/net-worth/snapshots/route.test.ts`](../../app/api/net-worth/snapshots/route.test.ts) | 401, 400, backfill on first call only, rows scoped to the user |
| [`app/api/cron/net-worth-snapshot/route.test.ts`](../../app/api/cron/net-worth-snapshot/route.test.ts) | 401 without secret, 200 with secret, 500 when snapshots throw |

## 7. Related

- [overview.md](overview.md), [background-jobs.md](background-jobs.md), [investments.md](investments.md), [market-data.md](market-data.md), [pension.md](pension.md), [debts.md](debts.md), [bank-sync-and-imports.md](bank-sync-and-imports.md), [analytics-and-goals.md](analytics-and-goals.md)
- Decisions: [`docs/decision-log.md`](../decision-log.md) (2026-10-01 three runs a day; 2026-09-29 investment history recalculates itself), [`docs/decisioni/2026-10-10-primi-passi-e-dati-d-esempio.md`](../decisioni/2026-10-10-primi-passi-e-dati-d-esempio.md)
- Spec: [`docs/superpowers/specs/2026-09-13-panoramica-patrimonio-netto-design.md`](../superpowers/specs/2026-09-13-panoramica-patrimonio-netto-design.md), decision [`docs/decisioni/2026-10-06-panoramica-bento.md`](../decisioni/2026-10-06-panoramica-bento.md)
