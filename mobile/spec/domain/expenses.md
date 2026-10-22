# Expenses, movements and periods (Liquidità)

Sources: `lib/calc/expenses.ts`, `lib/categories/groups.ts`, `lib/liquidity/split.ts`, `lib/liquidity/spend-curve.ts`, `lib/liquidity/day-groups.ts`, `components/domain/accounts/accounts-kpi.utils.ts`.
Vectors: [`vectors/expenses.json`](vectors/expenses.json) and [`vectors/liquidity.json`](vectors/liquidity.json). Both files share the fixture in `expenses.json → fixtures`.

## Where it runs today

**Client-side.** The Liquidità screens (`app/(app)/liquidita/page.tsx`, `liquidita/analisi/page.tsx`, `components/domain/liquidity/liquidity-overview.tsx`) and Panoramica (`app/(app)/panoramica/page.tsx`) download raw transactions (`GET /api/transactions?from&to`, a window from 1 January of last year to 31 December of this year, see `liquidityFetchWindow`), categories, budgets and accounts, then compute every KPI in the browser.

Mobile options (see [README](README.md#recommendation)):
1. **Recommended:** add a server endpoint, for example `GET /api/liquidity/summary?period&ref&accountId`, that returns the outputs below. Mobile only displays them.
2. Until that exists, port the functions 1:1 and run the shared vectors.

## Data model used by the formulas

| Field | Type | Notes |
|---|---|---|
| `transaction.date` | `"YYYY-MM-DD"` | Calendar date with no time zone. Always parse it as a **local** date (`parseDateOnly`); never use `Date("YYYY-MM-DD")`, which is UTC. |
| `transaction.amount` | decimal string, signed | `< 0` is an outflow (expense), `> 0` is an inflow (income). `0` is neither. |
| `transaction.excludedAmount` | decimal string, **same sign as amount** | The share excluded by "Dividi" (split). **Transfers between accounts are stored with `excludedAmount = amount`**, so their effective amount is 0. |
| `category.type` | `dovuta \| voluta \| futuro \| saltuaria \| entrata \| trasferimento` | |
| `category.isFallback` | bool | The "Da categorizzare" category. Use this flag, never the name. |
| `budget.monthlyAmount` | decimal string | One row per budgeted category. |

`effectiveAmount(t) = Number(amount) − Number(excludedAmount)`. The result keeps the sign of `amount`.

`isExpense(t) = amount < 0`. `isIncome(t) = amount > 0`. A positive refund on an expense category counts as **income** (vector `expenses.incomeSummary.oct`).

### Category → group bucket (`categoryGroupKey`)
1. `isFallback` → `"daCategorizzare"`
2. type `entrata` or `trasferimento` → `null` (not an expense bucket)
3. type is one of the 4 expense groups → that group
4. anything else → `"daCategorizzare"`

Group order is always `dovuta, voluta, futuro, saltuaria`, then `daCategorizzare`. Labels are the Italian source strings `Dovute`, `Volute`, `Te futuro`, `Saltuarie`, `Da categorizzare` (translate them through the catalog). Colors are `--group-*` tokens (see `design/tokens.md`).

## Date helpers (all local midnight, no time zone)

| Function | Rule |
|---|---|
| `startOfMonth(d)` | `Y-M-01` |
| `endOfMonth(d)` | last day of the month |
| `addMonths(d, n)` | `Date(y, m+n, day)`, **JS overflow semantics**: 31 Jan + 1 month gives 3 Mar (2 Mar in a leap year). Port this exactly; do not clamp. |
| `addDays(d, n)` | calendar days |
| `startOfISOWeek(d)` | Monday (Sunday belongs to the previous week) |
| `daysBetween(a, b)` | `round((startOfDay(b) − startOfDay(a)) / 86 400 000)`. The rounding absorbs DST hours. |

> **Porting note:** Swift `Calendar.date(byAdding:.month)` and `java.time.plusMonths` **clamp** (31 Jan + 1 month gives 28 Feb). To match the web, implement `addMonths` as `LocalDate.of(y, 1, 1).plusMonths(m + n).plusDays(day − 1)`, i.e. let the day overflow.

## Periods (`ExpensePeriod = settimana | mese | 3mesi | anno`)

`getPeriodRange(period, ref)`:
- `settimana`: ISO Monday to Sunday containing `ref`
- `mese`: calendar month of `ref`
- `3mesi`: `startOfMonth(addMonths(ref, −2))` to `endOfMonth(ref)`
- `anno`: 1 Jan to 31 Dec of `ref`'s year

`getPreviousPeriodRange`: shift `ref` by −7 days, −1 month, −3 months or −1 year (`Date(y−1, m, d)`), then call `getPeriodRange`.
**Known quirk:** because of `addMonths` overflow, the previous "mese" of 31 March is March itself (vector `expenses.previousPeriodRange.mese.2026-03-31`). Port it as-is for parity. A web fix is tracked as a decision for the web team.

`shiftReferenceDate(period, ref, ±1)`: the same shifts, used by the period stepper (‹ ›). Navigating forward past the current period is blocked by the UI, not here.

`formatPeriodLabel(period, range, locale)`:
- `mese`: `Capitalized(monthLong) YYYY`, e.g. "Ottobre 2026"
- `anno`: `YYYY`
- `settimana`, same month: `{day(from)}–{day month(to)}`, e.g. "12–18 ott" (EN DASH U+2013, no spaces)
- `settimana`, same year: `{d MMM} – {d MMM}`
- `settimana`, across years: `{d MMM yyyy} – {d MMM yyyy}`
- `3mesi`: `Cap(MMM) – Cap(MMM yyyy)` for the same year; otherwise both sides with year

Capitalisation only uppercases the first character. Month abbreviations come from ICU, so see [formatting-localization.md](formatting-localization.md#icu-drift) for the drift risk.

## Summaries

`computeSummary(txs, range)` uses **expenses only** with `from ≤ date ≤ to`:
- `uscite = Σ |amount|`
- `escluse = Σ |excludedAmount|`
- `speseEffettive = uscite − escluse`

`computeIncomeSummary(txs, range)` uses **income only**:
- `entrate = Σ amount`
- `escluse = Σ excludedAmount`
- `entrateEffettive = entrate − escluse`

No rounding is applied; values are raw doubles. Round only at display time (currency format, 2 decimals).

## KPIs (`computeKpis(txs, budgets, period, ref, today)`)

```
range        = getPeriodRange(period, ref)
todayStart   = startOfDay(today)
clamped      = max(todayStart, range.from)
elapsed      = { from: range.from, to: min(clamped, range.to) }

speso        = computeSummary(txs, elapsed).speseEffettive
budgetTotale = scaleBudgetForPeriod(Σ budget.monthlyAmount, period)
budgetSpent  = computeSummary(txs where categoryId ∈ budgeted, elapsed).speseEffettive
budgetRimanente = budgets.isEmpty ? null : budgetTotale − budgetSpent
giorniRimasti   = max(0, daysBetween(todayStart, range.to))
elapsedDays     = max(1, daysBetween(range.from, elapsed.to) + 1)
mediaGiornaliera = speso / elapsedDays
prev            = getPreviousPeriodRange(period, ref)
mediaGiornalieraPeriodoPrecedente = computeSummary(txs, prev).speseEffettive / max(1, daysBetween(prev.from, prev.to)+1)
```

`scaleBudgetForPeriod`: week = `monthly/30*7`, month = ×1, 3 months = ×3, year = ×12.

`computeIncomeKpis` uses the same elapsed window and returns `entrate`, `mediaGiornaliera` and the previous-period average. It has no budget.

## Breakdowns

- `computeCategoryBreakdown(txs, categories, period, ref, today)` returns one row **per expense category** (categories whose bucket is `null`, i.e. income and transfer, are dropped), **including zero rows**, in the input order. Each row has `amount = speseEffettive` over the elapsed window. The UI then filters `amount > 0` and sorts descending.
- `computeGroupTotals` sums those rows per bucket. All 5 keys are always present.
- `compute6MonthTrend(txs, ref)` returns 6 calendar months ending in `ref`'s month. Fields are `{year, month (0-based), label, total}`. `label` is the **hard-coded Italian** `MONTH_LABELS` (`Gen…Dic`); see [formatting](formatting-localization.md) for the mobile replacement (localized short month).
- `computeCategoryMonthlyStacks(txs, cats, ref, topCount=6, monthCount=6)`: for each month, take categories with `amount > 0` sorted descending, keep the top `topCount` and sum the rest into `{key:"altro", name:"Altro", color:"altro"}` if it is > 0. Then **re-sort all segments by amount**, so "Altro" can sit anywhere. Ranking is per month, not global.
- `filterTransactions(txs, {categoryId, searchText, accountId})` applies all conditions with AND. The search is `trim().toLocaleLowerCase()` and a substring match on description **or** note. An empty search matches everything.
- `filterByTransactionType`: `tutte | uscita | entrata`.

## Category legend and budget saturation (`components/domain/expenses/category-breakdown-donut.utils.ts`, client)

- `computeBudgetStats(amount, budget, totalSpeso)`:
  - `saturazionePct = budget > 0 ? amount/budget*100 : null`
  - `quotaPct = total > 0 ? amount/total*100 : null`
  - Both are percentages from 0 to 100+.
- `sortCategoryAmounts` (donut slices): sort by group order `dovuta, voluta, futuro, saltuaria, daCategorizzare`, then by amount descending.
- `sortLegendEntries(entries, criterion, direction)`: the criterion is `percentuale` (quotaPct), `budget` (saturazionePct), `valore` (amount) or `nome` (name). The default direction is `desc` for all except `nome` (`asc`).
  - `null` values always sort **last**, whatever the direction.
  - Names are compared with `localeCompare(_, "it")`. Use `Collator(it)` / `String.compare(options: [.caseInsensitive, .diacriticInsensitive], locale: it_IT)` and verify against JSON samples.
- Legacy split slider (`split-slider.utils.ts`):
  - `clampExcluded(x, total)`: NaN → 0, else clamp to `[0, total]`.
  - `computeSplitExcluded(total, n) = clampExcluded(total − total/n, total)`. No rounding; the current UI uses `lib/liquidity/split.ts` below.

## Split ("Dividi") (`lib/liquidity/split.ts`)

All results are rounded with `round2(x) = Math.round(x*100)/100`. JS `Math.round` rounds half **up toward +∞**, so implement `floor(x*100 + 0.5)/100`. Do not use banker's rounding.

| Function | Formula |
|---|---|
| `clampOwnShare(share, total)` | NaN → `total`; else `round2(min(max(share,0), total))` |
| `ownShareForPreset(total, parts)` | `clampOwnShare(total/parts, total)` |
| `excludedFromOwnShare(total, own)` | `round2(total − clampOwnShare(own, total))` (the value saved as `excludedAmount`, sign applied by the API) |
| `matchPreset(total, own)` | the first preset where `|ownShareForPreset − own| < 0.005` |

Presets, in order: `tutta` (1), `meta` (2), `terzo` (3), `quarto` (4). Labels: "Tutta", "Metà", "Un terzo", "Un quarto".

## Cumulative spend curve (`buildCumulativeSpend(txs, range, today)`)

This builds one point per day from `range.from` to `min(range.to, today)`. Each point's value is the running sum of `|amount| − |excludedAmount|` over expenses, **rounded to 2 decimals at each point** (the running total itself is not rounded).

## Day groups (`groupByDay(txs, today, locale)`)

- Transactions are grouped by `date` and sorted descending by date. Order inside a day is kept.
- `total = round2(Σ effectiveAmount)` (signed).
- `label`: `"Oggi"` if today, `"Ieri"` if yesterday. These are Italian source strings, so the UI translates them. Otherwise the label is `Intl.DateTimeFormat(locale, {weekday:"long", day:"numeric", month:"long"})`, adding `year:"numeric"` when the year differs from today's year. Example: "lunedì 5 ottobre".

## Accounts KPI

`totalLiquidity = Σ Number(account.balance)` over all accounts, including manual ones. `linkedAccountsCount = accounts.length`.

## Golden vectors (excerpt; full set in JSON)

Fixture (excerpt): salary +2500 (Aug, Sep), +2600 (1 Oct); food −80, −90.5, −55.25, −12.3; refund +20 on food (14 Oct); fun −120 with −60 excluded; fun −30; fun −100 with −50 excluded; save −300; gift −200; fallback −40; transfer −500 with −500 excluded. Budgets: food 300, fun 150.

| id | input | expected |
|---|---|---|
| expenses.periodRange.settimana.2026-11-01 | settimana, ref 2026-11-01 (Sunday) | 2026-10-26 → 2026-11-01 |
| expenses.previousPeriodRange.mese.2026-03-31 | mese, 2026-03-31 | 2026-03-01 → 2026-03-31 (quirk) |
| expenses.shiftReference.mese.2026-01-31.1 | mese, 2026-01-31, +1 | 2026-03-03 |
| expenses.periodLabel.it-IT.settimana.2026-09-30 | | "28 set – 4 ott" |
| expenses.periodLabel.de-DE.settimana.2026-10-14 | | "12–18. Okt." |
| expenses.summary.sep | Sep 2026 | uscite 830.5, escluse 500, speseEffettive 330.5 |
| expenses.kpis.mese.2026-10-16.2026-10-16 | | speso 147.55, budgetTotale 450, budgetRimanente 302.45, giorniRimasti 15, mediaGiornaliera 9.221875, prev 11.016666… |
| expenses.kpis.settimana.2026-10-14.2026-10-14 | | speso 0, budgetTotale 105, giorniRimasti 4, prev 11.428571… |
| expenses.groupTotals.sep | | dovuta 90.5, voluta 0, futuro 0, saltuaria 200, daCategorizzare 40 |
| split.ownShareForPreset.100.3 | 100, 3 | 33.33 |
| split.clampOwnShare.33.335.100 | 33.335, 100 | 33.34 |
| split.matchPreset.100.33.34 | | null |
| liquidity.dayLabel.de-DE.2026-10-05 | today 2026-10-16 | "Montag, 5. Oktober" |
