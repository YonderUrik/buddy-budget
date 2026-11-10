# Net worth (Patrimonio) and account balance history

Sources: `lib/calc/net-worth.ts`, `lib/net-worth/*`, `lib/liquidity/account-series.ts`, `lib/gocardless/connection-health.ts`. Vectors: [`vectors/net-worth.json`](vectors/net-worth.json), [`vectors/liquidity.json`](vectors/liquidity.json) (account series and connection health).

## Where it runs today

| Piece | Where |
|---|---|
| Daily snapshots per asset class (`net_worth_snapshots`: `liquidita`, `investimenti`, `previdenza`, `debiti`, …), including the derived (`source = "derivato"`) liquidity history and the investment, pension and debt history | **Server** (cron `/api/cron/*` and `lib/net-worth/*`) |
| `buildNetWorthSeries`, `computeNetWorthChange`, `excludeClassFromSeries`, `restrictSeriesToClasses`, `getNetWorthPeriodRange` | **Client**: `app/(app)/panoramica/page.tsx`, `components/domain/net-worth/*`, `liquidity-overview.tsx`, `lib/queries/investments*.ts` |
| `buildAccountBalanceSeries` | **Client**: `app/(app)/liquidita/conti/page.tsx` |
| `computeConnectionHealth` | **Client and server** (`liquidity-overview.tsx`, `/api/gocardless/connections`) |

Recommendation: add an endpoint that returns the ready series, `GET /api/net-worth/series?period=1mese|3mesi|1anno|max&classes=…`, so the mobile apps only plot. The class toggles (exclude or restrict) are trivial sums and can stay on the client.

## `getNetWorthPeriodRange(period, today, earliestDate)`
- `to = startOfDay(today)`.
- `max`: `from = earliestDate`, or `to` when there is no data.
- Otherwise `from = subtractMonthsClamped(to, n)` with n = 1, 3 or 12. The day is clamped to the target month's length (31 Mar − 1 month gives 28 Feb).

## `buildNetWorthSeries(snapshots, todayByClass, period, today)`
1. Ignore rows with `date ≥ todayKey`; the point for today comes from `todayByClass`, which holds live values.
2. Group by date, then by `assetClass`, summing `Number(amount)`. A class is `isEstimated` when any of its rows has `source == "derivato"`.
3. Carry forward: before `range.from`, apply all earlier dates to `last`. Then for every calendar day `from ≤ day < today`, apply that day's classes over `last`. Each class keeps its last known value. When `last` is non-empty, emit `{date, label: "d MMM", value: round2(Σ last), byClass, isEstimated: any class estimated}`.
4. Append the point for today: `value = round2(Σ todayByClass)`, `isEstimated = false`.
5. For `1mese` and `3mesi`, return the daily points.
6. For `1anno` and `max`, keep **the last point of each calendar month** (a month's point replaces the previous one while scanning), relabelled `MMM yy`.

Labels are formatted with a **hard-coded `it-IT`** formatter in the web ("10 ott", "ago 26"). On mobile, use the user's locale with the same skeletons (`d MMM`, `MMM yy`) and flag it to the web team.

## `computeNetWorthChange(series)`
`start = first.value`, `end = last.value`, `delta = end − start`. `deltaPct = delta/|start|` only if there are at least 2 points and `start ≠ 0`, otherwise null. It is a ratio, so 0.5 means +50%.

## Class filters
- `excludeClassFromSeries(series, key)`: `value −= byClass[key] ?? 0`. `byClass` is left untouched.
- `restrictSeriesToClasses(series, keys)`: `value = Σ byClass[k] ?? 0` over the given keys.

## Derived liquidity history (server, for reference)
`deriveLiquidityHistory(accounts, txs, today)` reconstructs the end-of-day balance from yesterday back to the first transaction on an **auto** (bank-linked) account, at most `MAX_DERIVED_HISTORY_MONTHS = 24` months (cutoff = 1st day of month − 24 months). The value for day d is `Σ all balances − Σ amounts of auto-account transactions dated after d`, rounded with round2. Manual accounts stay constant. Full `amount` is used, not the split share.

## Single-account balance series (`buildAccountBalanceSeries(account, txs, from, today)`)
Points run from `from` to **today inclusive**. The point for today equals the current balance. For an auto account, walking backwards: `value(d) = round2(balance − Σ amounts dated after d)`. Transactions dated in the future count in "after". Manual accounts produce a flat line.

## Bank connection health (`computeConnectionHealth`)
Constants: `CONSENT_VALID_DAYS = 90`, `CONSENT_EXPIRY_WARNING_DAYS = 7`.

Rules, applied in order:
1. Stored status `error`, `pending` or `expired` → that state.
2. No expiry date → `ok`.
3. Otherwise compute `remainingMs`:
   - `≤ 0` → `expired`.
   - Else `daysLeft = ceil(remainingMs/86 400 000)`, and the state is `expiring` when `daysLeft ≤ 7`, otherwise `ok`.

`needsRenewal` is true for `expiring`, `expired` and `error`.

## Golden vectors (excerpt)

| id | expected |
|---|---|
| netWorth.periodRange.1mese.2026-03-31.none | 2026-02-28 → 2026-03-31 |
| netWorth.periodRange.1anno.2024-02-29.none | 2023-02-28 → 2024-02-29 |
| netWorth.series.1mese | 10 Oct 6000 (liq 1000 + inv 5000) · 12 Oct 6100, isEstimated true · 14 Oct 6300.5 · today (16 Oct) 6500.25 from todayByClass; row dated today (9999) ignored |
| netWorth.series.max.monthly | 2026-08-31 "ago 26" 100 · 2026-09-30 "set 26" 200 · 2026-10-02 "ott 26" 300 |
| netWorth.change | start 6000, end 6500.25, delta 500.25, deltaPct 0.083375 |
| netWorth.change.negStart | −200 → 100: delta 300, deltaPct 1.5 |
| netWorth.deriveLiquidity | 2026-10-14: 1970 · 2026-10-15: 2020 |
| liquidity.accountSeries.auto | 12 Oct 1570, 13 Oct 1570, 14 Oct 1470, 15 Oct 1520, 16 Oct 1500 |
| connectionHealth.linked.2026-10-20T10:00:00Z | expiring, daysLeft 4 |
| connectionHealth.linked.2026-10-23T10:00:01Z | ok, daysLeft 8 |
