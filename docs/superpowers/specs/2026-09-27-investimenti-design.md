# Investimenti — portfolio, free market prices, statistics

**Date**: 2026-09-27
**Status**: design approved by the user on 2026-09-27 ("procediamo" — "let's proceed"), Phase 1 plan written: `docs/superpowers/plans/2026-09-27-investimenti-fase-1.md`. The coverage test (section 3) became the first task of the plan and does not block the rest: the order of the sources is configurable.
**Screen**: Investimenti ("Investments", today `comingSoon` in the sidebar), section 5 of `docs/functional-spec.md`

## Goal

The user wants an all-round tool for investments: **tracking their portfolio day by day** with statistics (returns, diversification, risk) and, later on, **analyzing individual instruments** (stocks, ETFs…). Non-negotiable constraint: **zero cost**. Only free data sources, no subscriptions to providers.

## User context (from brainstorming)

- Portfolio with **a bit of everything**: ETFs, listed stocks, bonds/government bonds, funds, crypto. **No unlisted stocks.**
- Broker: **Fineco**, with an **active PAC** (piano di accumulo, a recurring investment plan).
- **Broker CSV import: deferred** by the user's choice (section "Knowingly deferred").
- **Analysis of individual securities: deferred**, but to be kept tracked (backlog + this spec).
- **Italian taxation: of interest**, in a dedicated phase. However the Phase 1 data model already stores the data it needs.

## Decisions made in brainstorming

| Topic | Choice | Discarded alternatives |
|---|---|---|
| Where to start | **Portfolio tracking first**, then securities analysis | Everything together: the analysis needs rich data (fundamentals, look-through, screener), which are weak and fragile when free |
| Price source | **Chain of free sources with automatic fallback** per instrument type (section 2.1), Yahoo Finance first almost everywhere | Paid APIs (zero-cost constraint); a single source (a Yahoo block would stop everything) |
| Price frequency | **Daily close (EOD)** stored in Postgres, plus at most one intraday quote cached in Redis | Real time (useless for a long-term portfolio, and fragile for free) |
| Positions | **Computed from transactions**, never stored | Positions stored and edited by hand (two sources of truth, the same problem already avoided with `effectiveAmount`) |
| Cost method | **Weighted average cost** (the one shown by Fineco and used by the Italian tax authorities in the regime amministrato — administered regime, where the broker withholds the tax) | FIFO (not the Italian tax method) |

## 1. Roadmap

| Phase | Content | Status |
|---|---|---|
| **0. Data test** | Check from the VPS and locally which sources respond and what they cover, on a sample of public instruments (section 3) | first task of the Phase 1 plan |
| **1. Basic portfolio** | Instruments, manual transactions, PAC, EOD prices + ECB exchange rates, value/gain/loss, composition by type and currency, chart over time, `investimenti` class in net worth | design below |
| **2. Returns and comparison** | Portfolio return (TWR) and your actual return (XIRR), "same contributions into an index" comparison, splits, dividend/coupon history, real return (Eurostat inflation) | **implemented** on 2026-09-29, spec `2026-09-29-investimenti-fase-2-design.md` |
| **3. Risk and diversification** | Volatility, maximum drawdown from peak, Sharpe, beta, correlations; sector and geography (ETF look-through where free data allows); overlap between ETFs; target allocation and "where to put the next PAC" | **implemented** on 2026-09-29, spec `2026-09-29-investimenti-fase-3-design.md` |
| **4. Italian taxation** | Plusvalenze/minusvalenze (capital gains/losses), zainetto delle minusvalenze (tax-loss carryforward) expiring after 4 years, distinction between redditi diversi / redditi di capitale (miscellaneous income / capital income: gains on harmonized ETFs don't offset losses), tax estimate before a sale, bollo (stamp duty) 0.2% | **implemented** on 2026-09-30, spec `2026-09-30-investimenti-fase-4-design.md` |
| **5. Fineco CSV import** | Import of transactions from the Fineco export, with a column mapping reusable for other brokers | **implemented** on 2026-09-29 (generic CSV import with recognized formats) |
| **6. Securities analysis** | Instrument page (history, fundamentals from Yahoo), watchlist, price alerts (email / PWA notification), optional comment via Ollama. Screener excluded (not realistic for free) | **implemented** on 2026-09-30 (Titoli (Securities) tab); PWA notification deferred, see CLAUDE.md |

## 2. Free data sources

| Needed for | Source | Notes and risks |
|---|---|---|
| EOD prices, history, search by ISIN/name, fundamentals (Phase 6), ETF sectors (Phase 3) | **Yahoo Finance** via `yahoo-finance2` | Unofficial: can break (cookie/"crumb" mechanism) and the terms of use forbid non-personal use. Acceptable for personal use; if the app opens to external users it must be reconsidered, and the `PriceProvider` interface is there for this |
| Everything listed in Milan (MOT/BTP, ETFplus, stocks) | **Borsa Italiana**, undocumented JSON endpoint of the charts (`grafici.borsaitaliana.it`, used by the LGPL library `Librefolio/borsaItaliana-scraping`) | The only good free source for BTPs (Italian government bonds). Protected by an Imperva WAF with an anonymous token: fragile, may block datacenter IPs, grey area on the terms. Personal use only |
| EU ETF/stock fallback | **Stooq** (EOD CSV) | Since 2026 requires an `apikey` obtained once with a captcha. Partial coverage of European instruments |
| EU ETF/stock fallback with key | **Alpha Vantage** (25 calls/day) | Global exchanges included; the limit is enough for the daily update of ~20 instruments, not for backfilling history |
| US stock fallback | **Twelve Data** (800/day), **Finnhub** (60/min, 1 year of history), **Tiingo** | Official free plans but **US only**: useful only for American stocks |
| Mutual funds (NAV) | No official free API | Yahoo with a Morningstar `0P…` id if there is one, otherwise manual price. Morningstar's undocumented endpoints are too fragile to depend on |
| Crypto | **CoinGecko** (free plan); fallback: public **Binance/Kraken** APIs (no key) | Their own ids, no ISIN |
| Exchange rates | **ECB** (Data API, official) | EUR base, one fixing per day (no weekends/holidays: the latest available is used) |
| Inflation (Phase 2) | **Eurostat HICP** | Also needed by Analitiche (Analytics) |
| ISIN → ticker | **OpenFIGI** (free, optional key) | Fallback if the Yahoo ISIN search doesn't find the instrument |

**Manual price always available** (decision already made in `functional-spec.md`): every instrument can have `priceSource = "manuale"`, and the user can enter a price by hand even for an automatic instrument. It is the safety net for BTPs and funds if free coverage isn't enough.

### 2.1 Source chain with automatic fallback

Explicit request from the user (2026-09-27): no free source is reliable on its own, so every price is requested from **several sources in order**, and if the first fails the next one is tried without user intervention.

**Common interface** (`lib/market-data/`): each source implements `PriceProvider` with `id`, `requiresKey`, `fetchDailyCloses(symbol, from, to)` (daily closes with currency) and, where available, `searchByIsin(isin)`. Exchange rates have a separate `FxProvider` interface.

**Default order per instrument type** (constant `PROVIDER_CHAINS`, changeable in one place after the coverage test):

| Type | Chain |
|---|---|
| ETF / ETC / European stocks | Yahoo → Borsa Italiana (only if listed in Milan) → Stooq → Alpha Vantage |
| US stocks | Yahoo → Stooq → Twelve Data → Alpha Vantage |
| Bonds / BTP | Borsa Italiana → Yahoo |
| Mutual funds | Yahoo (`0P…` id) → no fallback: manual price |
| Crypto | CoinGecko → Kraken |
| Exchange rates | ECB → Frankfurter (same ECB data, another access route) |

**Symbols per source**: each source uses its own symbol (`VWCE.DE` on Yahoo, `vwce.de` on Stooq, `VWCE.DEX` on Alpha Vantage, numeric id on Borsa Italiana). That's why symbols live in an `instrument_symbols (instrumentId, provider, symbol)` table and not in a single column. They are resolved when the instrument is created (ISIN search on every source that supports it, otherwise derived from the Yahoo symbol and exchange); a source without a symbol for that instrument is skipped. Resolution is retried on the following days for the sources still without a symbol.

**Chain rules**:
1. Sources are tried in order; the **first valid response** wins. Valid means: at least one close in the requested period, price > 0, **currency equal to the instrument's**. A quote in another currency (e.g. the same stock listed in USD) is discarded: mixing currencies would distort the value.
2. Each row of `instrument_prices` stores the **source that provided it** (`source`). This shows how often we end up on the fallbacks.
3. **Source without a key = disabled, not in error.** Stooq, Alpha Vantage, Twelve Data and CoinGecko read optional keys from environment variables; if missing, the source is silently skipped (same principle as Ollama: "not configured" is a normal state).
4. **Per-source switch** (circuit breaker): within one cron run, after 3 consecutive errors from the same source (429, 5xx, firewall block, timeout) that source is skipped for the rest of the run. Avoids hammering a source that has blocked us.
5. **Budget for quota-limited sources**: Alpha Vantage (25/day) has a daily counter on Redis; once the budget is exhausted, the source is skipped until the next day. Minimum pause between requests configured per source.
6. **History backfill** only from sources without a depth limit (Yahoo, Borsa Italiana, Stooq); quota-limited sources are used only for the daily update.
7. **Plausibility check**: if the new close deviates by more than 20% from the previous one **and** comes from a different source, it is saved anyway but `market.prices.suspect` is logged (crypto excluded from the threshold). In Phase 1 no automatic blocking: visibility only.
8. If **all** sources fail, the last valid price remains, shown with its date. The user's manual price, if more recent, always wins.

**Observability**: metric `buddybudget_price_provider_requests_total{provider, outcome}` with `outcome` from a closed enum (`success`, `empty`, `currency_mismatch`, `error`, `rate_limited`, `skipped`); log `market.prices.fallback_used` when a fallback is needed. An alert on "too many fallbacks" or "stale prices" is added after seeing real numbers.

## 3. Phase 0 — coverage test (first task of the plan)

To be run **from the production VPS** (Hostinger datacenter IP, where Yahoo sometimes answers 429 or blocks) **and** locally. It can't be done from the cloud sandbox: on 2026-09-27 requests to Yahoo, Stooq and the ECB got 403 from the environment's network policy.

The user chose not to provide their own ISINs (2026-09-27). The test script uses a **sample of public instruments** for each type (UCITS ETF on Xetra and Milan, Italian stock, US stock, a BTP, a mutual fund, a crypto) and checks:

1. the ISIN search returns a Yahoo symbol, and on which exchange (for ETFs prefer the EUR listing: Xetra `.DE` or Borsa Italiana `.MI`);
2. the daily history arrives, how far back and in which currency;
3. **BTPs and bonds**: coverage on Yahoo (probably poor) and on the Borsa Italiana endpoint (probably good), price as a percentage of face value;
4. **mutual funds** (not exchange-listed, daily NAV): whether Yahoo exposes them (usually with a Morningstar id like `0P0000…`);
5. **Borsa Italiana from the VPS**: whether the Imperva WAF lets requests from the datacenter IP through;
6. crypto on CoinGecko and ECB exchange rates;
7. repeated for a few days from the VPS, to see whether 429 errors or blocks arrive.

Outcome: a table instrument type → working sources, used to confirm or reorder `PROVIDER_CHAINS`, plus the real responses saved as fixtures for the parser tests (sources can't be reached from the cloud sandbox). If Borsa Italiana is blocked from the VPS, its provider is implemented anyway but stays at the bottom of the chains, and BTPs fall back to the manual price.

## 4. Phase 1 — proposed design

### 4.1 Data

All new tables via versioned Drizzle migrations (`pnpm db:generate` + `db:migrate`, rule of 2026-09-26). Types and sources are `text` + TypeScript constants, not Postgres enums, so values can be added without migrations (same criterion as `net_worth_snapshots.assetClass`).

**`instruments`**: **shared by all users**, because VWCE's prices are the same for everyone.

| Column | Notes |
|---|---|
| `id` | uuid |
| `isin` | nullable (crypto don't have one), unique when present |
| `name` | display name |
| `type` | `etf` / `azione` / `obbligazione` / `fondo` / `crypto` / `etc` (commodities) |
| `currency` | quote currency (ISO 4217) |
| `priceMode` | `auto` (source chain) or `manuale` (only prices entered by the user) |
| `exchange` | optional, informative |
| `priceUnit` | `unita` (price per unit) or `percentuale_nominale` (bonds: value = face value × price / 100) |
| `taxRate` | Italian rate: 26% by default, 12.5% for government bonds and similar (needed by Phase 4, stored right away) |
| `taxHarmonized` | for ETFs/funds: EU-harmonized yes/no (Phase 4) |

A `manuale` instrument created by a user stays visible only to them (`createdByUserId` nullable): it doesn't pollute other users' search with made-up names or prices.

**`instrument_symbols`**: `(instrumentId, provider)` unique, `symbol`, `resolvedAt`. See section 2.1.

**`instrument_prices`**: `(instrumentId, date)` unique, `close` numeric(20,8), `source` (the source that provided the price). One row per day per instrument; manual prices live in a per-user table (`user_instrument_prices`), because a price entered by hand by one user must not change another user's portfolio.

**`fx_rates`**: `(date, currency)` unique, `perEur` (1 EUR = x currency, as published by the ECB). Conversion between any two currencies goes through EUR: the app is multi-currency and the user's currency is not necessarily EUR.

**`investment_portfolios`**: per user (`name`, optional `broker`). Usually one ("Fineco"), but there can be more than one.

**`investment_transactions`**: per user.

| Column | Notes |
|---|---|
| `type` | `acquisto` / `vendita` / `dividendo` / `cedola` / `rimborso` (buy / sell / dividend / coupon / redemption at bond maturity). `split` in Phase 2 |
| `date` | date of the transaction |
| `quantity` | numeric(24,10): fractions of crypto and fund units; face value for bonds |
| `price` | numeric(20,8) in the instrument's currency |
| `fxRate` | exchange rate instrument currency → user currency at the date; default from the ECB, editable (Fineco applies its own rate) |
| `fees` | commissions, in the user's currency |
| `taxes` | taxes withheld (capital gains, withholding on dividends), for Phase 4 |
| `grossAmount` | for `dividendo`/`cedola`: gross amount |
| `note` | optional |

Server-side check: a sale cannot exceed the units held at that date (decision already made in `functional-spec.md`).

**`investment_plans`** (PAC): `portfolioId`, `instrumentId`, `amount`, `frequency` (monthly / bimonthly / quarterly), `dayOfMonth`, `active`. In Phase 1 it is used to show the PAC amount in the KPIs and to **prefill** the "Registra operazione" ("Record transaction") form (instrument and amount). **It does not generate transactions by itself**: the real execution price and units are decided by Fineco, and a made-up purchase would make the average price and gain false.

**Net worth**: `ASSET_CLASSES` in `net_worth_snapshots.ts` is extended to `"investimenti"` (`text` column, no migration). The `net-worth-snapshot` cron (23:50) also writes the investments row. Thanks to transactions + historical prices, the past history is rebuilt as `derivato` (derived) rows, the same mechanism as for cash: the Panoramica (Overview) immediately shows two classes, and the allocation donut deferred on 2026-09-13 is unlocked.

### 4.2 Computations (pure functions, `lib/calc/investments.ts`)

- **Positions at a date**: units, weighted average cost (purchase commissions included), realized gain on sales (sale price − average cost, net of commissions), dividends and coupons received.
- **Value at a date**: units × latest available price ≤ date (automatic or manual, the most recent manual wins) × exchange rate. The most recent price **always shows its date**: a price that is days old is visible, not hidden.
- **Value series over time** and **net invested over time** (contributions − withdrawals), for the chart. Computed on demand from transactions + prices, with Redis cache. No per-instrument snapshots: the source data is already deterministic.
- **Composition** by instrument type and by currency. Sector and geography in Phase 3.

### 4.3 Price updates

- **k8s CronJob `market-prices`** → `GET /api/cron/market-prices` (protected by `CRON_SECRET`, like the others), **every day at ~23:00** Europe/Rome (after the US close; on weekends too for crypto). It runs **before** `net-worth-snapshot` (23:50).
- Updates only the instruments held by at least one user, plus exchange rates. Each instrument goes through the source chain of section 2.1; an error on one instrument doesn't interrupt the others.
- **History backfill** when an instrument is used for the first time (or when a transaction older than the existing history is recorded): background job following the "Operazioni lunghe" ("Long operations") standard (`after()` + state on Redis + global indicator). Downloads from the date of the first transaction.
- **Observability**: `recordCronRun("market_prices", …)` plus what is described in section 2.1. **Never a user's quantities, amounts or portfolio composition in the logs**: the symbol of a shared instrument is not personal data, the fact that a certain user holds it is.

### 4.4 Interface (`/investimenti`)

- **KPIs**: portfolio value (with change since the last close), total gain (unrealized + realized + dividends, in € and %), net invested with monthly PAC amount.
- **Chart**: value vs invested over time, periods 1M/3M/1A/Max (same selector as Panoramica).
- **Positions**: instrument, units, average price, latest price with date, value, gain €/%, weight %. Name editable, ISIN not (decision in `functional-spec.md`).
- **Composition**: by instrument type and by currency.
- **Transactions**: list + "Registra operazione" (type, instrument searched by ISIN or name through the provider search, units, price, date, commissions, prefilled exchange rate, computed total). Same dialog scheme as Transazioni's "+ Aggiungi" ("+ Add").
- **PAC**: card with active plans, monthly amount and a "Registra esecuzione" ("Record execution") button that prefills the form.
- Once implementation is complete: remove `comingSoon` from `NAV_ITEMS` and the entry from `UPCOMING_FEATURES` (CLAUDE.md "coming soon screens" rule).

### 4.5 Relationship with Conti and Transazioni

A PAC contribution leaves the Fineco current account (if linked via GoCardless) and shows up in Transazioni (Transactions) as an expense. **In Phase 1 the two movements are not linked**: the bank transaction is to be categorized in a category of the **"Te futuro"** ("Future you") group (which per the 2026-09-23 decision already counts as a priority expense), while the investment transaction lives in Investimenti. Net worth stays consistent: cash goes down and investments go up. Automatic linking of bank transaction ↔ investment transaction (e.g. suggesting to record the PAC execution when the bank transaction arrives) is a possible later improvement.

## Knowingly deferred

- **Fineco CSV import**: user's choice on 2026-09-27; Phase 5. To be picked up when entering transactions by hand becomes the bottleneck.
- **Analysis of individual securities**: user's choice on 2026-09-27, to be kept tracked; Phase 6. Screener excluded there too.
- **Splits, TWR/XIRR, benchmarks**: Phase 2. A split in Phase 1 is handled by hand (equivalent sale + purchase).
- **Bond accrued interest** (interest accrued between one coupon and the next): excluded from the value in Phase 1, small inaccuracy accepted.
- **Real time**: excluded, closing prices.
- **Automatic linking bank transaction ↔ investment transaction**: after Phase 1.

## Defaults adopted

The user asked to proceed on 2026-09-27 without answering point by point, so the spec's proposals apply:

1. Phase 0 on a sample of public instruments, not on the user's ISINs.
2. The PAC prefills the form, it doesn't generate transactions by itself.
3. Bond accrued interest excluded from Phase 1.
