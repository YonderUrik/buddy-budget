# Panoramica — net worth over time

**Date**: 2026-09-13
**Status**: design approved, implementation plan to be written
**Screen**: Panoramica ("Overview", home), currently a placeholder in `app/(app)/page.tsx`

## Goal

The home page must give **at a glance** a sense of the user's wealth and how it is going, aggregating the existing sections (Conti (Accounts), Transazioni (Transactions), Cash flow) and preparing for the arrival of future ones (Investimenti (Investments), Pensione (Pension), Debiti (Debts)) without having to redesign it. Non-negotiable requirement from the user: **a time chart of the net worth trend**. Everything else must stay minimal.

## Starting technical constraint

The DB has no balance history at all: `accounts.balance` is a single current value. Moreover, manual transactions do **not** update `accounts.balance` (it is written only by `POST`/`PATCH /api/accounts` and by the GoCardless sync in `lib/gocardless/sync.ts`): for manual accounts, balance and transactions are disconnected.

## Decisions made in brainstorming

| Topic | Choice | Discarded alternatives |
|---|---|---|
| History | **Hybrid**: real snapshots from today onwards + initial reconstruction derived from transactions | Reconstruction only (false on manual accounts, impossible for investments); snapshots only (empty chart for months) |
| Snapshot cadence | **Daily**, chart with adaptive granularity | Monthly (1M/3M with 1-3 points, useless) |
| Combination | **One-off reconstruction materialized** in a table + dedicated daily cron | Reconstruction computed on every request (complex merge, unstable past numbers); snapshot written on the first visit of the day (gaps, race conditions) |
| Home content | **Chart + essential context**: composition by asset class + "Questo mese" ("This month") card | Bare chart only; context + latest transactions (duplicates Transazioni) |

## 1. Data

### Table `net_worth_snapshots`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `userId` | text, FK `auth_user.id` | `onDelete: cascade` |
| `date` | date | reference day |
| `assetClass` | text | values validated by TS constant `ASSET_CLASSES`; today only `"liquidita"` |
| `amount` | numeric(14,2) | can be negative (future debts) |
| `source` | text | `"snapshot"` (real) or `"derivato"` (reconstructed) |
| `createdAt` / `updatedAt` | timestamptz | |

- Unique constraint `(userId, date, assetClass)`; index `(userId, date)`.
- `assetClass` and `source` are `text` + TS constants, **not** Postgres enums: adding future classes (`investimenti`, `pensione`, `debiti`) requires no migrations. Same criterion already adopted for `categories.color`/`icon`.
- Rows are **totals per class**, not per account: deleting an account does not rewrite history.
- Precedence: a `snapshot` row always overwrites a `derivato` row for the same day/class; a `derivato` row never overwrites anything.

### Daily snapshot

- New scheduler `startNetWorthScheduler()` (cron at 23:50, server time), registered in `instrumentation.ts` next to `startGoCardlessScheduler()` but independent of it. Same "no-op if already started" guard as the GoCardless module.
- For each user with at least one account: if the user has no snapshots yet, it first runs the reconstruction (see below); then writes `liquidita = Σ accounts.balance` with an idempotent upsert `source = "snapshot"`.
- An error on one user is logged and doesn't block the others (same pattern as `runDueSyncs`).
- Skipped days (server down) are not recovered: the reader repeats the last known value.

### One-off reconstruction

It triggers when the user has **no** rows in `net_worth_snapshots`, from two places: the daily cron and the first call to `GET /api/net-worth/snapshots` (so a new user sees the history immediately). It writes with `onConflictDoNothing`, so two concurrent runs produce neither duplicates nor overwrites.

For each day `G` from the day of the first transaction of an Auto account up to and including **yesterday**, limited to the last **24 months**:

```
liquidità(G) = Σ current balances of Auto accounts
             − Σ amount of Auto account transactions with date > G
             + Σ current balances of manual accounts
```

- The **full** `amount` is used, not `effectiveAmount`: "Dividi" ("Split") changes what counts as an expense, not the cash that left the account.
- Manual accounts stay constant at their current balance across the whole reconstructed history.
- If no Auto transactions exist, no derived row is written.

**Limits knowingly accepted**: flat history for manual accounts; older transactions imported after the reconstruction don't update it (no regeneration, out of scope).

## 2. Computation and API

Pattern unchanged compared with Cash flow: thin APIs returning raw rows, computation in pure client-side functions.

### `lib/calc/net-worth.ts` (pure, tested functions)

- `type NetWorthPeriod = "1mese" | "3mesi" | "1anno" | "max"`.
- `deriveLiquidityHistory(accounts, transactions, today)` → derived daily rows according to the formula in section 1 (only Auto accounts in the subtraction, at most 24 months, up to yesterday).
- `getNetWorthPeriodRange(period, today)` → date range; `max` starts from the first date available in the snapshots.
- `buildNetWorthSeries(snapshots, todayTotal, period, today)`:
  - sums the asset classes per day;
  - fills missing days by repeating the last known value (no point before the first available value);
  - the last point is `todayTotal`, computed from current balances;
  - granularity: one point per day for `1mese`/`3mesi`; for `1anno`/`max` the value of the last day of each month (the current month uses today's value);
  - each point reports whether it is derived (`isEstimated`), for the tooltip.
- `computeNetWorthChange(series)` → `{ start, end, delta, deltaPct }`, `deltaPct = null` when `start === 0` or the series has fewer than 2 points.

The DB write module (reconstruction + snapshot) lives in a separate server file, `lib/net-worth/snapshots.ts` (scheduler in `lib/net-worth/scheduler.ts`), and uses `deriveLiquidityHistory`; it contains no computation logic of its own.

### `GET /api/net-worth/snapshots?from&to`

- Authentication like the other routes (`auth.api.getSession`), 401 without a session; `from`/`to` in `YYYY-MM-DD` format mandatory, 400 otherwise.
- If the user has no rows, it runs the one-off reconstruction before reading.
- Returns only the authenticated user's rows within the range.
- Client hook `useNetWorthSnapshotsQuery(from, to)` in `lib/queries/net-worth.ts`.

### Existing reuse

- Today's total: `computeAccountsKpi(accounts).totalLiquidity` on the accounts from `useAccountsQuery` → the chart updates as soon as a balance changes, without dedicated invalidations.
- "Questo mese": `computeMonthlySeries` from `lib/calc/cashflow.ts` on the current month's transactions (`type = "tutte"`); "Messo da parte" ("Set aside") = effective income − expenses.

## 3. UI

### Route

- Page in `app/(app)/panoramica/page.tsx` (the "Panoramica" sidebar entry already points to `/panoramica`).
- `app/(app)/page.tsx` becomes a `redirect("/panoramica")`; the current placeholder is removed.
- The page only orchestrates: no inline computation.

### Composition (top to bottom, `max-w-4xl` like Cash flow)

1. **Header**: title "Panoramica" + today's date written out in Italian.
2. **`NetWorthChartCard`**:
   - current total in `font-heading`, large;
   - absolute and percentage change colored `text-pos`/`text-neg`, with the period label ("negli ultimi 3 mesi" — "over the last 3 months");
   - period selector 1M / 3M / 1A / Max, **default 3M**;
   - Recharts area chart via `components/ui/chart.tsx`, essential (no heavy grid), colors only from theme tokens;
   - tooltip with date and value; for derived points it adds the label "stimato" ("estimated").
3. **`NetWorthCompositionRow`**: one mini-card per asset class actually present — no "presto" ("soon") placeholder. Today a single "Liquidità · N conti" ("Cash · N accounts") card linking to `/conti`; future classes will appear automatically. Choice confirmed by the user even though today the value matches the total.
4. **`MonthSummaryCard`**: "Questo mese" with Entrate (Income), Uscite (Expenses), Messo da parte; links to `/cash-flow`.

Components in `components/domain/net-worth/` with an `index.ts` barrel; prop types exported; one-line JSDoc on each public component/function.

### States

- **No account**: instead of the chart, an invitation to add or link an account, with a link to `/conti`; no empty composition or "Questo mese".
- **Single point** (no history, no Auto transactions): large total + note "L'andamento comparirà nei prossimi giorni" ("The trend will appear in the next few days"), no chart and no change.
- **Loading**: skeleton with the same structure as the content (avoids layout shift).
- **Error**: message + "Riprova" ("Retry"), same pattern as Cash flow.

## Tests

- **Pure functions** (`lib/calc/net-worth.test.ts`): reconstruction (subtraction only for Auto, manual constant, full `amount` even with `excludedAmount` ≠ 0, 24-month cut-off, no rows without Auto transactions); filling of missing days; adaptive granularity and current month; last point = today's total; null `deltaPct`.
- **Route** (`app/api/net-worth/snapshots/route.test.ts`): 401 without session; 400 on invalid dates; reconstruction run only once even with repeated calls; isolation between users.
- **Snapshot writing**: idempotent upsert on the same day; `snapshot` overwrites `derivato`, `derivato` doesn't overwrite `snapshot`.
- **Manual verification by the user** (no real browser/Postgres in the agent sandbox): chart with estimated history on a user with Auto accounts, period change, "stimato" tooltip, total update after editing a balance, "no account" state, redirect from `/`.

## Out of scope (knowingly postponed)

- Asset classes `investimenti`, `pensione`, `debiti`: they will arrive with their respective screens; the schema is already ready to take them without migrations.
- "Ultimi movimenti" ("Latest transactions") list: it would duplicate Transazioni.
- "Allocazione patrimonio" ("Wealth allocation") donut: only makes sense with at least 2 classes; to be reconsidered when Investimenti arrives.
- Manual regeneration of the derived history and per-account history.
- Snapshots triggered by the GoCardless sync (in addition to the daily cron).
