# Investments engine

The investments engine turns a user's investment transactions, daily closing prices and exchange rates into positions, a daily portfolio value series, returns, risk, diversification, income and cost figures. Database access lives in [`lib/investments/data.ts`](../../lib/investments/data.ts); the calculations are pure functions in [`lib/calc/investments.ts`](../../lib/calc/investments.ts), [`lib/calc/returns.ts`](../../lib/calc/returns.ts), [`lib/calc/risk.ts`](../../lib/calc/risk.ts), [`lib/calc/risk-extras.ts`](../../lib/calc/risk-extras.ts), [`lib/calc/costs.ts`](../../lib/calc/costs.ts) and [`lib/calc/fx.ts`](../../lib/calc/fx.ts), plus the view builders in [`lib/investments/`](../../lib/investments/). Prices and rates come from [market-data.md](market-data.md).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Load | user id, first chart day | `InvestmentData`: transactions, instruments, prices, manual prices, FX, inflation, €STR, profiles, dividends, broker cash | [`loadInvestmentData`](../../lib/investments/data.ts) |
| Broker filter (view only) | `InvestmentData`, disabled brokers | filtered `InvestmentData` | [`filterInvestmentBrokers`](../../lib/investments/broker-filter.ts) |
| Price index | auto prices, manual prices, transactions | `PriceIndex` (per instrument, one price per day) | [`buildPriceIndex`](../../lib/calc/investments.ts) |
| FX table | `fx_rates` rows | `FxTable` (EUR pivot) | [`buildFxTable`](../../lib/calc/fx.ts) |
| Positions | transactions up to a date | `Position` per instrument (weighted average cost) | [`computePositions`](../../lib/calc/investments.ts) |
| Summary | positions, prices, FX | `PortfolioSummary` (value, gains, rows, weights) | [`computePortfolioSummary`](../../lib/calc/investments.ts) |
| Daily series | transactions, prices, FX, date range | `PortfolioDailyPoint[]` (value, invested, bought, income) | [`computeDailyPortfolioValues`](../../lib/calc/investments.ts) |
| Returns | daily series, benchmark, inflation | TWR, money-weighted, real return, benchmark comparison | [`computePortfolioReturns`](../../lib/calc/returns.ts) |
| Risk | daily returns, benchmark, €STR | volatility, drawdown, Sharpe, beta, correlations | [`computePortfolioRisk`](../../lib/calc/risk.ts) |
| Diversification | positions, profiles, manual breakdowns | sector and area look-through, fund overlaps | [`lib/investments/exposure.ts`](../../lib/investments/exposure.ts), [`overlap.ts`](../../lib/investments/overlap.ts) |
| Income | transactions, dividend events, coupon terms | missing income, 12-month forecast, history | [`lib/investments/dividends.ts`](../../lib/investments/dividends.ts), [`income.ts`](../../lib/investments/income.ts) |
| Cost impact | transactions, tax report, daily returns | reinvested fees and taxes per day | [`computeCostImpact`](../../lib/investments/cost-impact.ts) |
| Net worth history | daily series | `net_worth_snapshots` rows of class `investimenti` | [`lib/net-worth/investments.ts`](../../lib/net-worth/investments.ts) |

```text
investment_transactions ─┐
instrument_prices ───────┤                  ┌─> computePortfolioSummary ─> positions table, weights, composition
user_instrument_prices ──┼─> buildPriceIndex┤
fx_rates ──> FxTable ────┘                  └─> computeDailyPortfolioValues ─┬─> toDailyFlows ─> TWR, XIRR, benchmark
                                                                             ├─> risk (volatility, drawdown, Sharpe)
                                                                             ├─> period gain, cost impact
                                                                             └─> net_worth_snapshots (investimenti)
```

The Investimenti (Investments) page runs the whole pipeline in the browser: [`useInvestmentsView`](../../lib/queries/investments-view.ts) fetches `InvestmentData` from `GET /api/investments/overview` and calls [`buildInvestmentsView`](../../lib/investments/view.ts). The server runs the same functions for net worth snapshots and the sidebar.

## 2. Principles

**P1 — Positions are computed, never stored.** `investment_transactions` is the only source of holdings. Quantity, cost basis and gains are recomputed from it every time ([`computePositions`](../../lib/calc/investments.ts)).

**P2 — Calculations are pure.** Everything in `lib/calc/` takes plain inputs (numeric columns as strings) and returns plain values. No database, clock or network access, so the same code runs in the browser, in crons and in tests.

**P3 — One daily series feeds every time-based figure.** Returns, risk, period gain, cost impact and the net worth history all start from `computeDailyPortfolioValues`, so they agree with each other and with the chart.

**P4 — Cash flows happen at end of day.** Purchases, sales and income on a day are applied after that day's market move. A purchase on a rising day does not earn the rise of the shares already held.

**P5 — Amounts are in the user's currency.** A transaction's cost is converted with the `fxRate` saved on the transaction. A market value is converted with `fx_rates` for that date. A position without a price or a rate is excluded from the value and counted in `unpricedCount`; it is never valued at zero.

**P6 — Broker filters are views.** [`filterInvestmentBrokers`](../../lib/investments/broker-filter.ts) returns a new object. It never deletes transactions or changes account balances or snapshots.

**P7 — Statement imports are all-or-nothing.** [`runStatementImport`](../../lib/investments/import/execute-statement.ts) validates cash continuity and positions first, then writes everything in one database transaction under a per-user advisory lock.

## 3. Data model

Tables are in [`lib/db/schema/investments.ts`](../../lib/db/schema/investments.ts) and [`lib/db/schema/broker-statements.ts`](../../lib/db/schema/broker-statements.ts).

| Table | Stores | Scope |
|---|---|---|
| `instruments` | ISIN, name, `type` (`etf`, `azione` stock, `obbligazione` bond, `fondo` fund, `crypto`, `etc`), currency, `priceMode` (`auto`/`manuale`), `priceUnit` (`unita` per share, `percentuale_nominale` % of face value), default tax rate | shared; rows with `createdByUserId` are private |
| `investment_portfolios` | name, broker tag, `benchmarkInstrumentId`, `taxRegime`, `statementCashAccountId` | per user |
| `investment_transactions` | type, date, quantity, price (instrument currency), `fxRate` (instrument → user currency at that date), fees and taxes (user currency), `grossAmount` (instrument currency), `statementAccountKey`, encrypted note | per user |
| `instrument_prices` | daily closes from automatic sources, with `source` | shared |
| `user_instrument_prices` | closes typed by the user or taken from a broker statement | per user |
| `fx_rates` | `perEur`: units of `currency` per 1 EUR, by date | shared |
| `inflation_index`, `interest_rates` | monthly HICP index, daily €STR | shared |
| `instrument_profiles`, `user_instrument_breakdowns` | sectors, asset mix, top holdings, country; user overrides | shared / per user |
| `instrument_dividends`, `user_dismissed_dividends` | per-share dividends by ex-date; ignored suggestions | shared / per user |
| `user_instrument_settings` | per-user tax rate, coupon rate and frequency, maturity date | per user |
| `investment_targets` | target weight per instrument | per portfolio |
| `investment_tax_carryforwards` | prior capital losses (zainetto fiscale, the tax-loss backpack) | per user |
| `broker_statements` | parsed broker statement (JSON), raw records, period, fingerprint, linked cash account | per user |

Always computed, never stored: quantities, average prices, cost basis, realised and unrealised gains, portfolio value, returns, risk and exposure. The only derived figures that are persisted are the daily `investimenti` rows in `net_worth_snapshots` (section 4.13). `investment_plans` is deprecated: recurring plans were removed on 2026-10-04 and the table waits for a migration that drops it.

## 4. How it works

### 4.1 Transaction types

Types are a closed list in [`lib/investments/constants.ts`](../../lib/investments/constants.ts). Effects below are those applied by `applyTransaction` in [`lib/calc/investments.ts`](../../lib/calc/investments.ts). `m` is the price multiplier (1, or 0.01 for `percentuale_nominale`), `fx` the transaction's `fxRate`.

| Type | Quantity | Cost basis | Invested net / bought (contributions) | Cash flow in returns |
|---|---|---|---|---|
| `acquisto` (buy) | `+ q` | `+ q·p·m·fx + fees + taxes` | both `+` the same cost | inflow |
| `vendita` (sell), `rimborso` (redemption) | `− min(q, held)` | `− avgCost · sold` | invested net `− proceeds` | outflow of `q·p·m·fx − fees − taxes` |
| `dividendo` (dividend), `cedola` (coupon) | unchanged | unchanged | unchanged; `income += gross·fx − taxes − fees` | income, paid out |
| `split` | `× q` (ratio new/old) when `q > 0` | unchanged | unchanged | none |
| `rettifica` (non-cash adjustment) | `+ q` | `+ grossAmount · fx` | unchanged | none |

`rettifica` cannot be entered by hand ([`lib/validation/investments.ts`](../../lib/validation/investments.ts)); only imports create it, with a gross amount and a zero price ([`lib/validation/investments-import.ts`](../../lib/validation/investments-import.ts)). When quantity falls below `QUANTITY_EPSILON` (1e-9), quantity and cost basis reset to zero.

Same-day order ([`sortTransactions`](../../lib/calc/investments.ts)): `split` first, then buys, then income and adjustments, then sells and redemptions. Selling shares bought the same day is valid. [`findOversoldTransaction`](../../lib/calc/investments.ts) returns the first sale that would take quantity below zero. The transaction routes (create, update, delete) and personal CSV imports reject any change that makes the final list oversold.

### 4.2 Weighted average cost

```text
cost of a buy      = q * price * m * fx + fees + taxes
average cost       = costBasis / quantity
on a sell of s     : proceeds     = q * price * m * fx - fees - taxes
                     realisedGain += proceeds - averageCost * s
                     costBasis    -= averageCost * s
averagePrice       = costBasis / (quantity * m)        (same unit as the market price)
```

Example. Buy 10 at 100 EUR with 5 EUR fees: cost 1,005. Buy 10 at 120 EUR with 5 EUR fees: cost 1,205. Quantity 20, cost basis 2,210, average 110.50. Sell 5 at 130 EUR with 5 EUR fees: proceeds 645, realised gain `645 − 5 × 110.50 = 92.50`, cost basis 1,657.50 for 15 shares. Invested net is `2,210 − 645 = 1,565`; total bought stays 2,210.

Bonds quoted as a percentage of face value use `m = 0.01`: a face value of 10,000 at a price of 98 is worth `10,000 × 98 × 0.01 = 9,800`.

### 4.3 Prices and valuation

[`buildPriceIndex`](../../lib/calc/investments.ts) keeps one price per instrument per day. Same-day precedence is `manuale` (user or broker statement) over automatic sources over `operazione` (the price of a buy or sell, a fallback so a fresh purchase has a value before the first market close). [`resolvePrice`](../../lib/calc/investments.ts) returns the last price on or before the date.

```text
value(date) = quantity * close * m  converted instrument currency -> user currency at date
```

[`fxRateBetween`](../../lib/calc/fx.ts) goes through EUR: `rate(from→to) = perEur(to) / perEur(from)`, with the last rate on or before the date. EUR is always 1. Example: 10 shares at 210 USD, `perEur(USD) = 1.10`, user currency EUR: `10 × 210 / 1.10 = 1,909.09 EUR`.

[`computePortfolioSummary`](../../lib/calc/investments.ts) returns:

```text
unrealisedGain = sum over priced positions of (value - costBasis)
totalGain      = unrealisedGain + realisedGain + income
totalGainPct   = totalGain / totalBought          (all purchases ever, fees included)
dayChange      = value today - value at the close before the last price, on positions with both prices
weight         = position value / total value
```

[`computeComposition`](../../lib/calc/investments.ts) groups the same rows by instrument type or currency.

### 4.4 Daily series and flows

[`computeDailyPortfolioValues`](../../lib/calc/investments.ts) walks every calendar day from `fromKey` to `toKey`, applies that day's transactions, and records `value`, cumulative `invested` (net), `bought` and `income`. [`toDailyFlows`](../../lib/calc/returns.ts) turns the cumulative point pairs into daily flows:

```text
inflow_t  = bought_t - bought_{t-1}
outflow_t = (bought_t - invested_t) - (bought_{t-1} - invested_{t-1})
income_t  = income_t - income_{t-1}
```

The period window comes from [`resolvePerformanceRange`](../../lib/calc/performance-range.ts): it never starts before the first transaction, never ends after today, and adds a base day (the day before the first day) whose closing value is the starting capital.

### 4.5 Time-weighted return (TWR)

[`computeDailyReturns`](../../lib/calc/returns.ts):

```text
if V_{t-1} > 0:   r_t = (V_t + outflow_t + income_t - inflow_t) / V_{t-1} - 1
else if inflow_t > 0: r_t = (V_t + outflow_t + income_t) / inflow_t - 1     (first buy, measured against the close)
else:             r_t = null                                                 (nothing invested, skipped)
TWR = product(1 + r_t) - 1
```

Example. Base value 1,000. Day 1 closes at 1,100 with no flows: `r = 10%`. Day 2 buys 1,000 and closes at 2,200: `r = (2,200 − 1,000) / 1,100 − 1 = 9.09%`. TWR `= 1.10 × 1.0909 − 1 = 20%`, independent of the 1,000 added. Income counts as return. Each day's `gain` in money is `V_t + outflow + income − inflow − V_{t−1}`; [`computePeriodGain`](../../lib/investments/period-gain.ts) sums these gains for the chosen period.

### 4.6 Money-weighted return (XIRR)

[`investorCashFlows`](../../lib/calc/returns.ts) builds the investor's flows: the base value as a deposit (negative), each inflow negative, each outflow plus income positive, and the final value positive on the last day. [`xirrDaily`](../../lib/calc/returns.ts) finds the daily rate `h` that zeroes the net present value by 200 bisection steps on the log rate, bounded by `min(1, 500 / span_days)` so `exp` never overflows. It returns null without flows of both signs.

```text
NPV(h) = sum amount_i * exp(-h * days_i) = 0
daily  = exp(h) - 1
period = (1 + daily)^days - 1
annual = (1 + daily)^365 - 1
```

Example. One deposit of 1,000 worth 1,100 after 365 days gives `annual = 10%`. When the period starts with nothing invested, `days` is counted from the first day, not from the base day.

### 4.7 Annualisation

```text
annualise(r, days) = (1 + r)^(365 / days) - 1      (null when days <= 0 or r <= -1)
```

Annual values are shown only when the period covers at least 365 days (`showAnnual`). Example: +21% over 730 days is `1.21^0.5 − 1 = 10%` a year.

### 4.8 Benchmark comparison

The portfolio's `benchmarkInstrumentId` names an instrument whose prices are loaded with the portfolio's. [`simulateBenchmark`](../../lib/calc/returns.ts) replays the same money in it: buy units for the base value at the base-day price, buy for every inflow, sell for every outflow plus income, all at that day's close in user currency. If a withdrawal exceeds the simulated holding, units floor at zero and `depleted` is set. Missing benchmark prices give `benchmarkStatus = "missing_prices"`.

```text
units_0 = baseValue / P_0
units_t = units_{t-1} + inflow_t / P_t - (outflow_t + income_t) / P_t
benchmark TWR = P_end / P_0 - 1        (price only)
```

Example. Base value 1,000 at a benchmark price of 50: 20 units. A 500 purchase at 55 adds 9.09 units. At an end price of 60 the simulated value is `29.09 × 60 = 1,745.45` and the benchmark TWR is `60 / 50 − 1 = 20%`. The simulated flows also give the benchmark's money-weighted return.

### 4.9 Inflation-adjusted return

[`inflationBetween`](../../lib/calc/returns.ts) takes the HICP index of the first month of the period and the last available month not after the end. [`realReturn`](../../lib/calc/returns.ts) deflates the period TWR:

```text
inflation = index(endMonth) / index(startMonth) - 1
real      = (1 + TWR) / (1 + inflation) - 1
```

Example: TWR 10%, inflation 3%, real return `1.10 / 1.03 − 1 = 6.80%`. The index is loaded only when the product country has inflation enabled and the user's currency equals that country's currency ([`inflationAreaForCountry`](../../lib/localization/financial-country.ts)): Italy and Germany, EUR only.

### 4.10 Risk

[`computePortfolioRisk`](../../lib/calc/risk.ts) works on the TWR daily returns of the chosen period.

- **Observations.** [`riskObservations`](../../lib/calc/risk.ts) drops days with nothing invested and weekend days with a zero return (closed markets). Weekend days that moved (crypto) stay. Observations per year are measured from the data: `n × 365 / calendar days with a return`, about 252 for exchanges and 365 for crypto only.
- **Volatility** needs at least 20 observations (`MIN_VOLATILITY_OBSERVATIONS`): `stdev_sample(r) × sqrt(perYear)`. Example: daily stdev 1% and 252 a year give 15.9%.
- **Maximum drawdown** ([`computeDrawdown`](../../lib/calc/risk.ts)) runs on the TWR index, not on value, so deposits do not hide losses. It reports depth, peak, trough, recovery date (null if not yet recovered) and the current drawdown. Example: index 1.00 → 1.20 → 0.90 → 1.25 gives a depth of `0.90 / 1.20 − 1 = −25%`, recovered on the day the index reaches 1.20 again. Long periods chart the monthly minimum.
- **Sharpe** needs 60 observations (`MIN_RELATION_OBSERVATIONS`). The risk-free rate is the average €STR on the observed days, only for EUR users; otherwise 0.

```text
Sharpe = (mean(r) - rf / perYear) / stdev(r) * sqrt(perYear)
```

  Example: mean 0.05% a day, stdev 1%, €STR 2%, 252 a year: `(0.0005 − 0.0000794) / 0.01 × 15.87 = 0.67`.
- **Benchmark beta and correlation** pair each observation with the benchmark's close-to-previous-calendar-day return; 60 pairs are needed. `beta = cov(p, b) / var(b)`.
- **Correlation matrix** ([`computeCorrelationMatrix`](../../lib/calc/risk.ts)) covers the 8 largest positions. Each pair uses only days on which both have a market close (operation prices excluded) and needs 20 common returns.
- Below 250 observations the result carries `fewData`.

[`lib/calc/risk-extras.ts`](../../lib/calc/risk-extras.ts) adds Sortino, Calmar, historical VaR/CVaR (95%, 100 observations), Euler risk contributions, Herfindahl concentration (`effectiveN = 1 / HHI`) and `annualizedReturn`. These are used by the Analitiche (Analytics) section, not by the Investimenti risk card.

### 4.11 Diversification and look-through

[`resolveInstrumentExposure`](../../lib/investments/exposure.ts) picks one source per dimension (sector, area) and per instrument, in this order:

| Order | Sectors | Areas |
|---|---|---|
| 1 | user override (`user_instrument_breakdowns`) | user override |
| 2 | type: crypto, ETC, bond | type: crypto and ETC have no area |
| 3 | Yahoo profile: stock sector, or fund sectors scaled by the equity share of the asset mix, plus bond/cash/other shares | Yahoo country (stocks) |
| 4 | index estimate from the fund name ([`index-profiles.ts`](../../lib/investments/index-profiles.ts)) | ISIN country (stocks and bonds only; for funds the ISIN is the domicile) |
| 5 | none | index estimate |

[`completeWeights`](../../lib/investments/exposure.ts) drops unknown keys, rescales a sum above 1 and puts the rest in "unclassified". [`aggregateExposure`](../../lib/investments/exposure.ts) weights each instrument by position value. Example: an ETF worth 6,000 (50% technology, 50% health) and a technology stock worth 4,000 give technology 70% and health 30%.

[`overlap.ts`](../../lib/investments/overlap.ts) estimates fund overlaps (same index, index areas, or common top holdings) and stocks held both directly and inside funds. Free data gives only the top 10 holdings, so the top-holdings method is a lower bound. Overlaps under 20% are hidden. [`analyzeAllocation`](../../lib/investments/allocation.ts) compares weights with `investment_targets` (5-point tolerance) and suggests how to split a new contribution.

### 4.12 Dividends and coupons (proventi)

[`lib/investments/dividends.ts`](../../lib/investments/dividends.ts):

- **Missing income.** For each ex-date in `instrument_dividends` after the first buy, if shares were held the day before and no dividend was recorded between 5 days before and 60 days after, a suggestion is made unless dismissed. Source amounts are per current share, so `gross = sharesThen × splitsAfter × amountPerShare`. Example: 100 shares, a 2:1 split after the ex-date and 0.50 per current share give `100 × 2 × 0.50 = 100`. The estimated tax is `gross × fx × taxRate`.
- **Coupons.** For bonds quoted in % of face value with complete coupon terms, coupon dates are counted back from maturity: `coupon = face value × rate / frequency`. Example: 10,000 at 3.5% twice a year pays 175.
- **Forecast.** The next 12 full months use today's quantity: last year's ex-dates shifted one year, coupons and redemption from bond terms, otherwise recorded income of the same months rescaled to today's quantity. `net = gross × (1 − taxRate)`; foreign withholding is not modelled. Redemptions are shown but not counted as income.
- **History** ([`computeIncomeHistory`](../../lib/investments/income.ts), `incomeByMonth`, `incomeByInstrument`) groups recorded `dividendo`/`cedola` transactions.

### 4.13 Investments in net worth

[`refreshDerivedInvestmentHistory`](../../lib/net-worth/investments.ts) rebuilds the past daily `investimenti` rows of `net_worth_snapshots`, from the first transaction (at most 20 years back) to yesterday:

1. Build a fingerprint from row count and latest `updatedAt`/`createdAt` of the user's transactions, manual prices, closes of held instruments, relevant FX rates, the user's currency and yesterday's date.
2. If it equals the fingerprint stored in Redis, stop.
3. Otherwise compute the daily series, delete rows before the first transaction and upsert only days whose rounded value changed, in batches of 500, as `source = "derivato"`. Existing `snapshot` rows keep their source but get the recomputed value.
4. Save the fingerprint. A Redis failure only causes an extra recomputation.

[`writeInvestmentSnapshot`](../../lib/net-worth/investments.ts) writes today's row (`source = "snapshot"`) from `computePortfolioSummary`. Both run from [`lib/net-worth/scheduler.ts`](../../lib/net-worth/scheduler.ts) in the `net-worth-snapshot` cron; the history refresh also runs on `GET /api/net-worth/snapshots`. See [net-worth.md](net-worth.md).

### 4.14 Broker cash and statements

A complete broker statement import (Interactive Brokers, DEGIRO, Trade Republic) is handled by [`runStatementImport`](../../lib/investments/import/execute-statement.ts):

1. The CSV is reparsed on the server; client-supplied operations are ignored. An identical fingerprint is a duplicate.
2. Periods must be contiguous with earlier and later statements of the same account, and opening cash must equal the previous closing cash for every currency. A partial overlap is refused; a statement that fully covers earlier periods replaces them.
3. Imported quantities must equal the statement's positions, and later retained statements must stay consistent.
4. In one transaction: delete replaced operations and their closing prices, insert operations tagged with `statementAccountKey`, store the `broker_statements` row, store each position's closing price as a `user_instrument_prices` row on the statement end date, and set the balance of a dedicated `Liquidità broker` (broker cash) account.

```text
broker cash = NAV "Cash" row in base currency          (when the statement has a valuation)
            = sum of non-zero closing balances by currency (when it does not)
            each converted to the user currency at the statement end date
```

The account balance is updated only when no later statement exists. [`resolveBrokerCash`](../../lib/investments/broker-cash.ts) lists these accounts once each, including legacy links through `statementCashAccountId`, with the last statement date. Broker cash is shown next to the portfolio («Includi liquidità», include cash) and counted in net worth as an account, not as investments, so it is never counted twice. Details per broker: [`docs/ibkr-import.md`](../ibkr-import.md), [`docs/degiro-import.md`](../degiro-import.md), [`docs/trade-republic-import.md`](../trade-republic-import.md).

### 4.15 Broker filters

[`transactionBroker`](../../lib/investments/broker-filter.ts) attributes each transaction: by `statementAccountKey` through `broker_import_accounts`, then by the portfolio's `broker` prefix (`ibkr:`, `degiro:`, `personal:`), else `manual`. [`filterInvestmentBrokers`](../../lib/investments/broker-filter.ts) removes the disabled brokers' transactions, their broker cash, and instruments and targets no longer used. The selection lives in React state ([`broker-selection.tsx`](../../lib/investments/broker-selection.tsx)), is shared by the Investimenti tabs, and resets on reload.

### 4.16 Costs

**Recurring costs** ([`summarizeCosts`](../../lib/calc/costs.ts)), used by Analitiche:

```text
annual cost per position = value * TER + (subject to stamp duty ? value * annualStampDutyRate : 0)
```

`annualStampDutyRate` comes from the product country ([`financial-country.ts`](../../lib/localization/financial-country.ts)): 0.2% for Italy (bollo, the securities stamp duty), 0 for Germany. An unsupported country throws. TER is typed by the user. Example: 10,000 with TER 0.20% in Italy costs `20 + 20 = 40` a year (0.40%). [`costDrag`](../../lib/calc/costs.ts) projects `value × (1 + g)^y` against `value × (1 + g − c)^y`: 10,000 at 6% gross with 0.40% costs is about 17,908 against 17,245 after 10 years.

**Cost and tax impact** ([`computeCostImpact`](../../lib/investments/cost-impact.ts)), used by the Portfolio chart. Fees and taxes recorded on transactions (not on splits or adjustments), plus taxes on sales estimated by the tax report when the country has a tax model, are treated as if they had stayed invested from their payment date at the portfolio's observed daily return:

```text
saved_t = saved_{t-1} * (1 + r_t) + paid_t        (r_t = 0 on days with nothing invested)
```

Example: 10 EUR of fees, then two days at +1% and +2%: `10 × 1.01 × 1.02 = 10.30`. The two switches («Reinvesti costi», «Reinvesti imposte») add these amounts to the displayed value and series only ([`simulateCostExclusions`](../../lib/investments/cost-impact.ts)). The simulation is disabled when any position is unpriced. Taxes are covered by [taxes.md](taxes.md).

## 5. Limits and out of scope

- **One portfolio in practice.** Several `investment_portfolios` rows can exist (imports create them), and all transactions are combined. Benchmark and targets are read only from the oldest portfolio (`portfolios[0]` in [`loadInvestmentData`](../../lib/investments/data.ts)).
- **Adjustments are not flows.** A `rettifica` adds quantity and cost without an inflow, so its value counts as return in TWR and XIRR. The dividend quantity timeline in [`dividends.ts`](../../lib/investments/dividends.ts) ignores `rettifica` quantities.
- **Corporate actions.** History around a split is not corrected; split ratios must be recorded as `split` transactions.
- **Cost impact scope.** Standalone account charges, TER and stamp duty are not part of the cost and tax impact.
- **Inflation and risk-free rate.** Real return is shown only for EUR users in a country with inflation enabled; Sharpe uses €STR only for EUR users and 0 otherwise.
- **Overlaps** use top-10 holdings from free data: they are lower bounds.
- **Income forecast** applies the Italian rate only; foreign withholding taxes and tax return sections are not modelled.
- Deferred (CLAUDE.md "Consciously deferred"): multiple portfolios per user, PWA push for alerts, an import preset for an Italian broker, import undo, screener, ETF regions from issuers' files, rebalancing with sales, Sortino/VaR in the Investimenti risk card.
- Statement imports do not rebuild tax lots and refuse partial overlaps ([`docs/ibkr-import.md`](../ibkr-import.md)).

## 6. Tests

- [`lib/calc/investments.test.ts`](../../lib/calc/investments.test.ts): weighted average cost with fees, partial and full sells, bonds in % of face value, FX at the transaction rate, income net of taxes, `asOf` cut-off, splits and reverse splits, oversell detection, price precedence, summary, daily series.
- [`lib/calc/returns.test.ts`](../../lib/calc/returns.test.ts): daily flows, TWR independent of deposit timing, total sale, income, XIRR on single and multiple flows and long periods, annualisation, inflation window, benchmark simulation.
- [`lib/calc/returns.properties.test.ts`](../../lib/calc/returns.properties.test.ts): known values (Excel's XIRR example 37.34%, real return 6.80%) and randomised scenarios: TWR equals the price change when trading at the close, an identical benchmark matches the portfolio, daily gains add up to the total gain, heatmap periods compound to the TWR, a split does not change value or return.
- [`lib/calc/risk.test.ts`](../../lib/calc/risk.test.ts), [`lib/calc/analytics-extras.test.ts`](../../lib/calc/analytics-extras.test.ts): statistics, observations per year, Sharpe with €STR, weekend filtering, drawdown and recovery, pair correlation, beta, Sortino, VaR/CVaR, risk contributions, concentration.
- [`lib/calc/fx.test.ts`](../../lib/calc/fx.test.ts), [`lib/calc/costs.test.ts`](../../lib/calc/costs.test.ts), [`lib/investments/cost-impact.test.ts`](../../lib/investments/cost-impact.test.ts): EUR pivot and last-rate lookup; per-country stamp duty; reinvested costs and taxes, the four switch combinations, window independence, losses.
- [`lib/investments/exposure.test.ts`](../../lib/investments/exposure.test.ts), [`overlap.test.ts`](../../lib/investments/overlap.test.ts), [`allocation.test.ts`](../../lib/investments/allocation.test.ts), [`dividends.test.ts`](../../lib/investments/dividends.test.ts), [`income.test.ts`](../../lib/investments/income.test.ts): source order for exposure, overlaps, targets, missing income with splits, coupons, forecast.
- [`lib/investments/broker-cash.test.ts`](../../lib/investments/broker-cash.test.ts), [`broker-filter.test.ts`](../../lib/investments/broker-filter.test.ts): single counting of cash accounts; filters that do not mutate the source.
- [`lib/investments/import/execute-statement.integration.test.ts`](../../lib/investments/import/execute-statement.integration.test.ts) (database): consecutive periods, concurrency, rejection without writes, replacement and rollback, per-user isolation.
- [`lib/net-worth/investments.test.ts`](../../lib/net-worth/investments.test.ts) (database): history rebuild, back-dated changes, deletions, fingerprint skip, Redis failure.

## 7. Related

- [overview.md](overview.md), [market-data.md](market-data.md), [taxes.md](taxes.md), [net-worth.md](net-worth.md), [bank-sync-and-imports.md](bank-sync-and-imports.md), [analytics-and-goals.md](analytics-and-goals.md), [background-jobs.md](background-jobs.md)
- Specs: [`2026-09-27-investimenti-design.md`](../superpowers/specs/2026-09-27-investimenti-design.md), [phase 2](../superpowers/specs/2026-09-29-investimenti-fase-2-design.md), [phase 3](../superpowers/specs/2026-09-29-investimenti-fase-3-design.md), [phase 4](../superpowers/specs/2026-09-30-investimenti-fase-4-design.md)
- Decisions: [`2026-10-05-filtri-broker-e-confronto.md`](../decisioni/2026-10-05-filtri-broker-e-confronto.md), [`2026-10-06-impatto-costi-imposte.md`](../decisioni/2026-10-06-impatto-costi-imposte.md), [`2026-10-08-investimenti-guadagno-periodo-e-reinvestimento.md`](../decisioni/2026-10-08-investimenti-guadagno-periodo-e-reinvestimento.md), [`2026-10-14-costi-investimenti-germania.md`](../decisioni/2026-10-14-costi-investimenti-germania.md), [`2026-10-14-inflazione-germania.md`](../decisioni/2026-10-14-inflazione-germania.md)
