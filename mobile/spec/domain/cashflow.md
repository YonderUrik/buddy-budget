# Cash flow and Analisi (Liquidità → Analisi)

Sources: `lib/calc/cashflow.ts`, `lib/calc/movements.ts`. Vectors: [`vectors/cashflow.json`](vectors/cashflow.json), using the fixture from `vectors/expenses.json`.

## Where it runs today

**Client-side.** `app/(app)/liquidita/analisi/page.tsx` calls `computeIncomeSources`, `computeAccumulatedSavings`, `getTrendRange` and `computeSummary`. The chart components `components/domain/cashflow/*.tsx` (`cashflow-trend-chart`, `accumulated-savings-chart`, `income-sources-list`) call `computeMonthlySeries` and the other functions on raw transactions in the browser. `lib/analitiche/base.ts` also uses this module server-side to compute monthly savings for Analitiche.

Recommendation: serve `GET /api/liquidity/analysis?period&ref&accountId` that returns `monthlySeries`, `incomeSources`, `whereItGoes`, `accumulated` and `kpis`. Until then, port the module 1:1.

All amounts use `effectiveAmount` (after "Dividi"). Transfers net to 0 (see [expenses.md](expenses.md#data-model-used-by-the-formulas)). The range filter is inclusive: `from ≤ date ≤ to`.

## Periods

### Analisi window (`getTrendRange(period, ref)`, used by the current UI)
The window ends in `ref`'s month and covers **6 months**, or **12** when `period == "anno"`:
`from = startOfMonth(addMonths(startOfMonth(ref), −(n−1)))`, `to = endOfMonth(ref)`.

### Legacy cash-flow periods (`CashflowPeriod = 3mesi | 6mesi | 12mesi | 24mesi`)
- `getCashflowPeriodRange(p, ref)`: `from = startOfMonth(addWholeMonths(ref, −(n−1)))`, `to = endOfMonth(ref)`.
- `addWholeMonths` **clamps** the day (31 May − 3 months gives 28 Feb). This differs from `addMonths` in expenses.md, which overflows. Both behaviours exist on purpose, so port both.
- `getPreviousCashflowPeriodRange` = range of `addWholeMonths(ref, −n)`.
- `shiftCashflowReferenceDate(p, ref, dir)` = `addWholeMonths(ref, n*dir)`.
- `formatCashflowPeriodLabel(range)` is **hard-coded `it-IT`** in the web: "Ago – Ott 2026" or "Nov 2025 – Ott 2026". On mobile, use the user locale with the same pattern as `formatPeriodLabel("3mesi")` and flag it to the web team.

## KPIs (`computeCashflowKpis(txs, range, today)`)

```
entrate = Σ effectiveAmount(income in range)
uscite  = Σ |effectiveAmount(expense in range)|
elapsedMonths = Σ over each calendar month m in range of:
                1                         if startOfDay(today) ≥ endOfMonth(m)
                0                         if today < startOfMonth(m)
                today.day / daysInMonth(m) otherwise
monthCount = elapsedMonths > 0 ? elapsedMonths : number of months in range
entrateMedie = entrate / monthCount
usciteMedie  = uscite / monthCount
flussoNettoTotale = entrate − uscite          (a total, not an average)
tassoRisparmio    = entrate > 0 ? flussoNettoTotale / entrate : null   (ratio 0..1, may be negative)
```
Edge case: on the last day of a month, `today ≥ endOfMonth`, so that month counts as 1.

## Series

- `computeMonthlySeries(txs, range)` returns one entry per calendar month in the range, including empty months at 0. Fields are `{year, month (0-based), label, entrate, uscite}`. `label` is `MONTH_LABELS[month]` (Italian "Gen"…"Dic"). When `range.from.year ≠ range.to.year` it becomes `"Dic '25"` (apostrophe U+0027 and a 2-digit year). Mobile should use the localized short month (see formatting) with the same `'YY` suffix rule.
- `computeAccumulatedSavings(txs, range)` is the running sum of `entrate − uscite` of the monthly series.
- `computeIncomeSources(txs, categories, range)` groups income by its **actual** `categoryId`, whatever the category type, so percentages add up to 100. Fields are `amount` and `quotaPct = amount/total*100` (**a percentage 0–100**, null if total is 0). Rows with `amount ≤ 0` are dropped and the rest are sorted descending. An unknown category falls back to `name "Non categorizzato"`, `color "slate"`, `icon "help-circle"`.
- `computeWhereItGoes(txs, categories, ref)` covers `ref`'s calendar month. It returns 6 rows in a fixed order: `dovuta, voluta, futuro, saltuaria, nonClassificato, avanzo`.
  - Expenses whose category is missing, is the fallback, or is not an expense group go to `nonClassificato`.
  - `avanzo = entrate − all expenses`. It may be negative and has no floor.
  - `quotaPct = amount/entrate*100`, or null when `entrate ≤ 0`.
  - Labels are the Italian source strings "Dovute", "Volute", "Te futuro", "Saltuarie", "Non classificato" and "Avanzo".

## Savings rate (`computeSavingsRate(income, expenses)`)
`income ≤ 0 → null`, else `(income − expenses)/income`.

## Golden vectors (excerpt)

| id | input | expected |
|---|---|---|
| cashflow.periodRange.12mesi.2026-02-28 | 12mesi, 2026-02-28 | 2025-03-01 → 2026-02-28 |
| cashflow.shift.31jan.back | 3mesi, 2026-05-31, −1 | 2026-02-28 (clamped) |
| cashflow.kpis.3m.partial | Aug–Oct 2026, today 2026-10-16 | entrateMedie 3028.4615384615386, usciteMedie 364.8660256410256, flussoNettoTotale 6701.95, tassoRisparmio 0.8795209973753281 |
| cashflow.kpis.future | Nov–Dec 2026 | 0, 0, 0, null |
| cashflow.monthlySeries.crossYear | Dec 2025–Feb 2026 | labels "Dic '25", "Gen '26", "Feb '26" |
| cashflow.incomeSources.oct | Oct 2026 | salary 2600 (99.2366…%), food refund 20 (0.7633…%) |
| cashflow.whereItGoes.sep | Sep 2026 | dovuta 90.5 (3.62%), saltuaria 200 (8%), nonClassificato 40 (1.6%), avanzo 2169.5 |
| cashflow.accumulated | Aug–Oct | 2060, 4229.5, 6701.95 |
| movements.savingsRate.1000.1300 | | −0.3 |
| movements.trendRange.anno | anno, 2026-10-16 | 2025-11-01 → 2026-10-31 |
