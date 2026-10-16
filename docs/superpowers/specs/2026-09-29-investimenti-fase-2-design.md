# Investimenti, Phase 2: returns and comparison

**Date**: 2026-09-29
**Status**: implemented on 2026-09-29; design written the same day at the user's request ("avevamo detto che c'erano altre fasi, possiamo occuparcene?" — "we said there were other phases, can we take care of them?"; Phase 2 chosen among 2/3/4/6). Executed inline in the same session, on branch `claude/investimenti-fase-2`.
**Parent spec**: `2026-09-27-investimenti-design.md`, section 1 (roadmap).

## Goal

Answer three questions that Phase 1 leaves open:

1. **How much is the portfolio really returning?** Phase 1's "gain %" is total gain / total bought: with a PAC (piano di accumulo, recurring investment plan) it is distorted (money added yesterday weighs as much as money added three years ago) and it is not comparable with an index.
2. **Would I have done better with an index?** Same contributions, same dates, into a reference ETF chosen by the user.
3. **Am I beating inflation?**

Plus two side pieces planned in the roadmap: **splits** (today handled by hand with a sale + purchase) and the **history of dividends and coupons**.

## Decisions

### 1. Two returns, over the same period as the chart

The period is the one already chosen in the main card (1M/3M/1A/Max): changing the period also updates the returns.

- **Portfolio return (TWR, time-weighted)**: how much the chosen instruments returned, regardless of when and how much you contributed. It is the number to compare with an index or a fund.
  It is chained day by day: `r_t = (V_t + Uscite_t + Proventi_t) / (V_{t-1} + Entrate_t) − 1`, with inflows (purchases, commissions included) at the start of the day and outflows (net proceeds from sales and redemptions) and net income at the end. Reasoned choice: with the "all flows at the start of the day" convention a full sale at a gain would give a negative denominator. A day with denominator ≤ 0 (nothing in the portfolio and no purchase) doesn't count.
- **Your return (money-weighted, XIRR)**: how much *your money* returned, taking into account when you put it in. Flows from the user's point of view: value at the start of the period as initial contribution, purchases negative, sales/redemptions/income positive, today's value positive. Newton with bisection fallback; null if it doesn't converge or if the flows don't change sign.
- **Annualization**: the main number is always "over the period". Only if the period covers at least one year is the annual version also shown (annual TWR and XIRR). Reason: "+80% a year" after two months is misleading.
- The daily value is Phase 1's (`computeDailyPortfolioValues`), which now also exposes total bought and cumulative income. Same limits: an instrument without a price or exchange rate on a day doesn't count in that day's value.

### 2. Comparison with an index ("benchmark")

- The benchmark is **an instrument from the catalog** (typically a global equity ETF), chosen by the user with the same selector as Phase 1; only instruments with automatic prices. It is saved on the portfolio: new column `investment_portfolios.benchmark_instrument_id` (nullable, `on delete set null`). No default: until the user chooses one, the card suggests doing so.
- Once the benchmark is chosen its history is downloaded from the first transaction (same background backfill as Phase 1), and the evening cron updates it like a held instrument.
- **"Same contributions" simulation**: at the start of the period the benchmark is "bought" for the portfolio's value, then each day it is bought for the inflows and sold for outflows + income, at the closing price converted into the user's currency. Income is mirrored too: this way withdrawals are identical and the two final values can be compared directly ("oggi avresti X invece di Y" — "today you'd have X instead of Y"). If a withdrawal exceeds the simulated benchmark value, everything is sold (the benchmark doesn't go below zero): rare case, accepted.
- Shown: the benchmark's TWR over the period (final price / initial price, in user currency) next to the portfolio's TWR, simulated final value against real value, and a two-line chart of cumulative return (portfolio vs benchmark, in %), with the same granularity as the main chart.
- For an accumulating ETF the price already includes reinvested dividends; for a distributing one it doesn't, and the comparison penalizes it. This is stated in the help text.

### 3. Real return (inflation)

- Source: **Eurostat HICP**, monthly index `prc_hicp_midx` (base 2015=100, `coicop=CP00`), area **Italy** (`geo=IT`). New table `inflation_index (area, month 'YYYY-MM', value, source)`, shared by all users: the area is a column, so adding the euro area in the future requires no migrations.
- Updated inside the `market-prices` cron (one call, last 3 years; from 2000 if the table is empty). A Eurostat error doesn't make the cron fail: `market.inflation.failed` is logged.
- Real return = `(1 + TWR) / (1 + inflation over the period) − 1`, inflation = index of the latest available month ≤ end of period / index of the starting month. Shown **only** if the user's currency is EUR and the period is 1A or Max (Eurostat publishes with about a month's delay: on 1M/3M the figure would be out of step). It states up to which month inflation is available.
- Fake sources (`MARKET_DATA_FAKE=1`) also have a fake inflation index (2% a year) for local development.

### 4. Splits

- New transaction type **`split`**. The ratio is stored in the `quantity` field: new units for each old unit (2 = each unit becomes two; 0.1 = 10:1 reverse split). Price, gross, commissions and taxes at zero. No migration (types are `text`).
- Effect: units × ratio, cost basis unchanged (so the average price is divided by the ratio). Consistent across positions, outcome of individual transactions (open purchases multiply the remaining units), the "sold more units than held" check and the cron's lookup of held instruments (an instrument with a split is considered held: the SQL sum of purchases and sales doesn't see the split).
- **Known limit**: the sources (Yahoo) return a history already adjusted for splits. Closes saved before the split remain unadjusted, those fetched afterwards are adjusted. Today's value is right; the chart before the split may have a step if the history was downloaded after the split. Not fixed in this phase.
- The CSV import doesn't translate any value into `split` by itself (it must be chosen by hand in the mapping), and accepts it only with the ratio in the units column.

### 5. History of dividends and coupons

New "Dividendi e cedole" ("Dividends and coupons") card, visible only if there is at least one income item:
- net total of the last 12 months and **income yield on cost** (last 12 months / current cost basis);
- bars per year (net received), from the year of the first income;
- instruments that paid the most in the last 12 months.
Pure logic in `lib/investments/income.ts`, from the income already computed for the transaction list.

### 6. Returns heatmap (added at the user's request)

"Rendimento nel tempo" ("Return over time") card: green and red squares like an activity calendar, groupable by **days**
(last year, rows = days of the week), **weeks** (rows = years, columns = ISO weeks), **months**
(rows = years, 12 columns plus the year total, value written in the square) and **years**.
- Each square chains the daily returns (TWR) of its days: it doesn't depend on how much was contributed. The detail
  also shows the gain in euros (change in value net of contributions and withdrawals).
- It always covers the whole history from the first transaction, regardless of the period of the main card.
- Color: 4 levels of `--pos`/`--neg` mixed with the neutral `--muted`; the full scale is the 90th percentile of the grid's
  returns (a few extreme days don't flatten the others); below 0.05% the square is neutral.
- In the day view Saturday and Sunday are hidden if they never moved (markets closed); with crypto they stay.
- Pure logic in `lib/calc/return-heatmap.ts`, daily returns in `computeDailyReturns` / `computeHistoryDailyReturns`
  (`lib/calc/returns.ts`), UI in `return-heatmap-card.tsx` and `return-heatmap-grid.tsx`.

## Where the code lives

- `lib/calc/returns.ts`: daily flows, TWR, XIRR, annualization, benchmark simulation, cumulative return series, inflation. All pure and tested.
- `lib/calc/investments.ts`: `split` type, daily points with cumulative `bought`/`income`.
- `lib/investments/view.ts`: adds `returns` and `income` to the view.
- `lib/investments/data.ts`: loads benchmark (instrument, prices, exchange rate) and inflation index.
- `lib/market-data/providers/eurostat.ts` + `lib/market-data/inflation.ts`: source and storage.
- `app/api/investments/portfolio/route.ts`: `PATCH { benchmarkInstrumentId }`.
- UI: `components/domain/investments/returns-card.tsx` (+ chart), `income-history-card.tsx`, "Rapporto" ("Ratio") field in the transaction form.
- Migration `0003_investimenti_fase_2`.

## Knowingly deferred

- Correction of the price history around a split.
- Several simultaneous benchmarks, composite benchmarks (e.g. 60/40), per-position benchmarks.
- Inflation for the euro area or other countries, and for currencies other than EUR.
- Per-position return (TWR/XIRR per instrument).
- Taxation (Phase 4) and risk (Phase 3).

## To verify after the merge (not verifiable from the sandbox)

- Eurostat responds from the VPS (from the sandbox the network policy blocks `ec.europa.eu`): after the first cron run the `inflation_index` table has rows, and the card shows the real return on 1A/Max.
- Choosing a real benchmark (e.g. VWCE) downloads the history and the comparison appears.
