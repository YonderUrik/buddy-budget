# Market data

Market data turns free external sources (Yahoo Finance, Borsa Italiana, Stooq, Alpha Vantage, Twelve Data, CoinGecko, Kraken, the ECB, Frankfurter, Eurostat, OpenFIGI) into shared tables of daily closes, exchange rates, inflation, interest rates, instrument profiles and dividends, which the [investments engine](investments.md) reads. The code lives in [`lib/market-data/`](../../lib/market-data/); the scheduled entry point is [`app/api/cron/market-prices/route.ts`](../../app/api/cron/market-prices/route.ts), and price alerts are in [`lib/investments/alerts-run.ts`](../../lib/investments/alerts-run.ts).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Symbol derivation | ISIN, type, currency, Yahoo symbol, CoinGecko id | one symbol per source in `instrument_symbols` | [`deriveSymbols`](../../lib/market-data/symbols.ts), [`completeSymbols`](../../lib/market-data/update.ts) |
| Source chain | instrument, symbols, date range | closes from the first valid source | [`runChain`](../../lib/market-data/chain.ts), [`chainFor`](../../lib/market-data/chains.ts) |
| Daily update | instruments to keep fresh | `instrument_prices` (last 7 days, overwritten), `fx_rates` | [`updateHeldInstruments`](../../lib/market-data/update.ts) |
| Backfill | one instrument, start date | `instrument_prices` (missing days only), `fx_rates` | [`ensureHistory`](../../lib/market-data/runtime.ts), [`backfillInstrument`](../../lib/market-data/update.ts) |
| FX | currencies, date range | `fx_rates` (EUR base) | [`updateFxRates`](../../lib/market-data/update.ts) |
| Inflation | area per product country | `inflation_index` (HICP) | [`updateInflationIndex`](../../lib/market-data/inflation.ts) |
| Risk-free rate | date range | `interest_rates` (€STR) | [`updateRiskFreeRates`](../../lib/market-data/rates.ts) |
| Profiles | held funds and stocks | `instrument_profiles` | [`lib/market-data/profiles.ts`](../../lib/market-data/profiles.ts) |
| Dividends | held stocks and funds | `instrument_dividends` | [`lib/market-data/dividends.ts`](../../lib/market-data/dividends.ts) |
| Fundamentals | one instrument | key figures and financial statements (Redis cache only) | [`lib/market-data/fundamentals.ts`](../../lib/market-data/fundamentals.ts) |
| Search | query text or ISIN | Yahoo hits, crypto hits, OpenFIGI listings | [`lib/market-data/runtime.ts`](../../lib/market-data/runtime.ts) |
| Price alerts | active alerts, latest closes | triggered alerts, emails | [`evaluatePriceAlerts`](../../lib/investments/alerts-run.ts) |

```text
market-prices cron (06:30, 17:30, 22:30 UTC)
  updateHeldInstruments ── per instrument: runChain(yahoo → borsaitaliana → stooq → ...) ─> instrument_prices
                       └── updateFxRates(ecb → frankfurter) ─────────────────────────────> fx_rates
  updateInflationIndex (Eurostat, per area) ──────────────────────────────────────────────> inflation_index
  refreshCryptoCatalog (CoinGecko) ───────────────────────────────────────────────────────> Redis
  updateRiskFreeRates (ECB €STR) ─────────────────────────────────────────────────────────> interest_rates
  refreshStaleProfiles / refreshStaleDividends (Yahoo) ──────────> instrument_profiles / instrument_dividends
  evaluatePriceAlerts ─────────────────────────────────────────────> user_price_alerts + email
net-worth-snapshot cron (20 minutes later) reads the new closes
```

## 2. Principles

**P1 — The first valid answer wins.** For each instrument the sources are tried in a fixed order per instrument group ([`PROVIDER_CHAINS`](../../lib/market-data/chains.ts)). The first source that returns at least one positive close in range and in the instrument's currency is used; the rest are not called.

**P2 — All network calls look like a browser.** Every price, FX, inflation and rate source is called through [`browserTlsFetch`](../../lib/market-data/browser-fetch.ts) with a browser User-Agent. Only OpenFIGI uses the plain `fetch`.

**P3 — Secondary data never fails the cron.** Inflation, €STR, crypto catalog, profiles, dividends and alerts catch their own errors and log them. Only an unexpected error in the price update marks the cron run as failed.

**P4 — Writes are idempotent.** Daily closes and FX are upserts. Backfill inserts only missing days (`onConflictDoNothing`), so an interrupted backfill can be run again.

**P5 — Shared state lives in Redis.** Quota budgets, the Yahoo session and cooldown, backfill progress and caches are in Redis, so they hold across pods and restarts. In-memory stores exist only for tests and scripts.

**P6 — Sources are injected.** Every source receives a `ProviderContext` (`fetch`, `env`). With `MARKET_DATA_FAKE=1` outside production, [`marketDataDeps`](../../lib/market-data/runtime.ts) swaps in deterministic fake sources from [`fake.ts`](../../lib/market-data/fake.ts).

**P7 — No user data leaves through logs or responses.** The cron responds and logs only counts; alerts log the user as a hash.

## 3. Data model

All tables are in [`lib/db/schema/investments.ts`](../../lib/db/schema/investments.ts) and shared by all users unless noted.

| Table | Key | Stores |
|---|---|---|
| `instrument_symbols` | instrument + provider | the symbol each source uses (inserted once, never overwritten) |
| `instrument_prices` | instrument + date | daily `close` in the instrument currency and the `source` that gave it |
| `user_instrument_prices` | user + instrument + date | manual closes (per user; see [investments.md](investments.md)) |
| `fx_rates` | date + currency | `perEur`: units of the currency per 1 EUR, and `source` (`ecb` or `frankfurter`) |
| `inflation_index` | area + month | HICP index value and `source` (the series key) |
| `interest_rates` | series + date | daily rate as an annual fraction (series `estr` only) |
| `instrument_profiles` | instrument | fund sectors, asset mix, top holdings; stock sector and country; `fetchedAt` |
| `instrument_dividends` | instrument + ex-date | dividend per share in the instrument currency, split-adjusted |
| `instruments.dividendsFetchedAt` | | last dividend history download (null = never) |
| `user_watchlist_items` | user + instrument | instruments followed without owning them |
| `user_price_alerts` | id | direction (`sopra` above / `sotto` below), target price, status (`attivo` / `scattato` triggered), trigger date and price |

Redis keys ([`redis-stores.ts`](../../lib/market-data/redis-stores.ts), [`runtime.ts`](../../lib/market-data/runtime.ts), [`fundamentals.ts`](../../lib/market-data/fundamentals.ts)):

| Key | Content | TTL |
|---|---|---|
| `market:budget:<provider>:<day>` | calls used today by a quota source | 2 days |
| `market:yahoo:session`, `market:yahoo:cooldown` | Yahoo cookie and crumb; refusal cooldown | 1 h (5 min after a failed session); 3 min |
| `market:yahoo:search:<query>` | Yahoo search results | 6 h |
| `market:crypto:catalog`, `market:crypto:search:<q>`, `market:crypto:cooldown` | top 500 crypto; off-catalog searches; CoinGecko refusal | 7 days; 1 day; 2 min |
| backfill state per instrument | status, saved, total, heartbeat | 24 h |
| `market:profile-attempt:<id>`, `market:dividends-attempt:<id>` | on-demand attempt marker | 1 h |
| `market:fundamentals:v2:<id>`, `market:statements:v1:<id>` | key figures; financial statements | 24 h (1 h when empty) |

Nothing in this area is computed per user. Values in user currency are always computed at read time by the investments engine.

## 4. How it works

### 4.1 Price sources

| Source | Key (env) | History | Daily budget | Min. delay | Notes |
|---|---|---|---|---|---|
| `yahoo` | none | unlimited | none | 400 ms | unofficial `chart` endpoint, cookie and crumb session |
| `borsaitaliana` | none | unlimited | none | 1.5 s | token scraped from the chart page (20 min); symbol `ISIN,MARKET` |
| `stooq` | `STOOQ_API_KEY` | unlimited | none | 1 s | CSV without currency |
| `alphavantage` | `ALPHAVANTAGE_API_KEY` | limited | 25 | 1.5 s | daily update only |
| `twelvedata` | `TWELVEDATA_API_KEY` | limited | 800 | 8 s | daily update only, US stocks |
| `coingecko` | optional `COINGECKO_API_KEY` | unlimited | none | 2.5 s | symbol `id:CURRENCY` |
| `kraken` | none | unlimited | none | 1 s | OHLC pairs such as `XBTEUR` |

Each source implements `PriceProvider` ([`types.ts`](../../lib/market-data/types.ts)) and is registered in [`PRICE_PROVIDERS`](../../lib/market-data/providers/index.ts). A source whose required key is missing is skipped. HTTP calls go through [`providerGet`](../../lib/market-data/http.ts): 15 s timeout, 404 as an empty answer, 429 as `ProviderRateLimitedError`, 401/403 as `ProviderBlockedError`, an HTML page instead of JSON as an error. Error messages never contain the URL, which can carry keys.

### 4.2 Fallback order

[`chainKeyFor`](../../lib/market-data/chains.ts) maps an instrument to a group and [`PROVIDER_CHAINS`](../../lib/market-data/chains.ts) fixes the order:

| Group | Instruments | Order |
|---|---|---|
| `etf_eu` | ETFs, ETCs, non-USD stocks | yahoo → borsaitaliana → stooq → alphavantage |
| `stock_us` | stocks in USD | yahoo → stooq → twelvedata → alphavantage |
| `bond` | bonds | borsaitaliana → yahoo |
| `fund` | funds | yahoo |
| `crypto` | crypto | coingecko → kraken |

### 4.3 Symbols

[`deriveSymbols`](../../lib/market-data/symbols.ts) derives every source's symbol from the Yahoo symbol, the ISIN and the type, without network calls:

- Stooq: Yahoo suffix `""`/`DE`/`L` becomes `.us`/`.de`/`.uk` (lower case); other exchanges are not used.
- Alpha Vantage: suffix `""`/`DE`/`L`/`PA`/`AS` becomes `""`/`.DEX`/`.LON`/`.PAR`/`.AMS`.
- Twelve Data: only US symbols in USD.
- Borsa Italiana: `ISIN,MOTX` for bonds (even without a Yahoo symbol), `ISIN,ETFP` or `ISIN,XMIL` for ETFs, ETCs and stocks listed in Milan (`.MI`).
- Crypto: `coingeckoId:CURRENCY` and, for about 30 known coins, a Kraken pair.

[`completeSymbols`](../../lib/market-data/update.ts) saves derived symbols that are missing; stored symbols always win.

### 4.4 The chain run

[`runChain`](../../lib/market-data/chain.ts) tries each source in order:

1. **Skip** without calling it when: the source has no implementation or no symbol for the instrument, its key is missing, its circuit breaker is open, its daily budget is used up (checked with `tryConsume`), or the purpose is backfill and its history is `limited`.
2. **Wait** until `minDelayMs` has passed since the last call to the same source in this run.
3. **Call.** A blocked answer (401/403, firewall page) opens the breaker at once. A rate limit or other error counts one failure; 3 consecutive failures open the breaker for the rest of the run (`CIRCUIT_BREAKER_THRESHOLD`).
4. **Validate.** Keep closes that are finite, positive and inside `[from, to]`. Any answered request, even empty, resets the failure count. No valid closes is `empty`. A declared currency different from the instrument's is `currency_mismatch`. Closes without a currency (Stooq) are accepted.
5. **Accept** the first `success` and stop.

```text
suspect = previous source != new source
          and type != crypto
          and |latest close / previous close - 1| > 0.20
```

A suspect close is still saved; it is logged as `market.prices.suspect`. Example: the last close was 100 from Yahoo, Yahoo is down and Stooq returns 125. The jump is 25%, so it is saved and flagged.

### 4.5 browserTlsFetch

Yahoo, and other sites behind similar firewalls, recognise Node's TLS handshake by the order of OpenSSL's cipher suites and answer 429 to every request, even with a browser User-Agent and a valid session. [`browserTlsFetch`](../../lib/market-data/browser-fetch.ts) uses undici's `fetch` with an `Agent` whose cipher list follows Chrome's order. It uses undici directly because Next.js replaces the global `fetch` and the global one cannot take a dispatcher.

### 4.6 Yahoo session and units

[`yahoo.ts`](../../lib/market-data/providers/yahoo.ts) first gets the A3 cookie from `fc.yahoo.com` and a crumb, and reuses them for an hour through the Redis session store. If a cached session is refused (429, 401, 403), it gets a fresh one and retries once. A confirmed refusal sets a 3-minute cooldown, which only interactive search honours; the price chain has its own breaker. Closes are dated with the exchange's GMT offset. Prices quoted in minor units are divided by 100: `GBp`/`GBX` to GBP, `ZAc` to ZAR, `ILA` to ILS. Example: 1,250 GBp is saved as 12.50 GBP.

### 4.7 Daily update

[`findHeldAutoInstruments`](../../lib/market-data/store.ts) selects `auto` instruments that any user holds (buys minus sells and redemptions above 1e-7, or any split), uses as a benchmark, follows in a watchlist or has an active alert on. [`updateHeldInstruments`](../../lib/market-data/update.ts) then, for each one:

1. Requests the last `DAILY_LOOKBACK_DAYS` (7) days, to cover weekends, holidays and a missed run.
2. If no source succeeded and Yahoo answered empty for a suffixed symbol (for example `.SG`), retries Yahoo once with the ISIN as the symbol, without saving it.
3. Saves closes with `overwrite: true`: the latest good reading replaces the close and source of a day already stored. Inserts run in batches of 500.
4. Counts the instrument as `updated`, `fallback` (the source is not the first usable one in its chain) or `failed`. An error on one instrument does not stop the others.

Finally it updates FX for the currencies of these instruments and of every user who has investment transactions.

### 4.8 Backfill

[`ensureHistory`](../../lib/market-data/runtime.ts) starts a background backfill for an `auto` instrument when its first stored close is later than the date needed. It is called on instrument creation (30 days, `INITIAL_HISTORY_DAYS`), on a new transaction (7 days before its date, `HISTORY_MARGIN_DAYS` in [`lib/investments/history.ts`](../../lib/investments/history.ts)), on watch, on the security page, and after imports.

- The work runs in `after()`; the route answers at once.
- The Redis backfill store refuses a second start while a run is alive. A `running` state whose heartbeat is older than 60 s is treated as interrupted and can be restarted. Progress (`saved` of `total`) is updated per batch of 500 and read by `GET /api/instruments/backfill`.
- [`backfillInstrument`](../../lib/market-data/update.ts) uses only `unlimited` sources, starts at most 20 years back (`MAX_BACKFILL_YEARS`), inserts only missing days, and then fetches FX for the instrument's currency over the same range.

[`ensureFxHistorySafely`](../../lib/investments/history.ts) fetches FX history for a benchmark whose prices already existed.

### 4.9 Schedule

The `market-prices` cron calls `GET /api/cron/market-prices` with `CRON_SECRET` at 06:30, 17:30 and 22:30 UTC: CronJob `30 6,17,22 * * *` in the infra repo (`argocd/manifests/app/cronjob-market-prices.yaml`) and the same line in [`docker-compose.yml`](../../docker-compose.yml). The route has `maxDuration = 300`. The `net-worth-snapshot` cron runs at 06:50, 17:50 and 23:50 UTC, after each price run. Closes are end-of-day values, not intraday quotes. Order inside a run:

1. `updateHeldInstruments` (prices, then FX).
2. `updateInflationIndex` for each area in `INFLATION_AREAS` (today `IT`, `DE`).
3. `refreshCryptoCatalogOnProviders`.
4. `updateRiskFreeRates`.
5. `refreshStaleProfiles` and `refreshStaleDividends` on the same instrument set.
6. `evaluatePriceAlerts`.
7. `recordCronRun("market_prices", ...)` and the log line `market.prices.updated` with counts.

### 4.10 FX rates

Sources are tried in order: ECB Data API (`EXR`, daily reference rates), then Frankfurter (the same ECB data by another route). The first non-empty answer is saved with an upsert; if all fail, `market.fx.all_failed` is logged (an error if any source failed, a warning if all were empty). Rates are stored with EUR as base, and any pair is computed through EUR ([`fxRateBetween`](../../lib/calc/fx.ts)):

```text
perEur(c) = units of c for 1 EUR
rate(from -> to) = perEur(to) / perEur(from)        (EUR has perEur = 1)
rate on a date   = last stored rate on or before that date
```

Example: `perEur(USD) = 1.10`, `perEur(GBP) = 0.85`. 100 USD is `100 × 0.85 / 1.10 = 77.27 GBP`. On a Saturday the Friday rate is used.

### 4.11 Inflation (Eurostat)

[`eurostatProvider`](../../lib/market-data/providers/eurostat.ts) reads dataset `prc_hicp_minr`: monthly all-items HICP (`coicop18=TOTAL`), unit `I25` (2025 = 100), one country at a time. The answer must contain exactly that area, unit, item and frequency, otherwise it is rejected. [`updateInflationIndex`](../../lib/market-data/inflation.ts):

- With no rows, or rows from another series key (`eurostat:prc_hicp_minr:I25:TOTAL`), it downloads from 2000-01 and replaces the whole area in one transaction, so readers never see two bases mixed.
- Otherwise it re-reads the last 36 months, because Eurostat revises recent values.
- An empty or failed answer leaves the stored series untouched.

[`loadInflationIndex`](../../lib/market-data/inflation.ts) returns only rows of the current series key. The investments engine loads the area only for the product country's currency; see [investments.md](investments.md) section 4.9.

### 4.12 Interest rates (ECB €STR)

[`estrProvider`](../../lib/market-data/providers/estr.ts) reads series `EST/B.EU000A2X2A25.WT` as CSV and converts percent to fractions (1.92 becomes 0.0192). [`updateRiskFreeRates`](../../lib/market-data/rates.ts) downloads from 2019-10-01 when the table is empty, otherwise the last 30 days, with upserts. [`loadRiskFreeRates`](../../lib/market-data/rates.ts) adds a 10-day margin before the requested start. The rate is used for the Sharpe ratio of EUR users.

### 4.13 Profiles, dividends, fundamentals

All three come from Yahoo `quoteSummary` and related endpoints and use the instrument's Yahoo symbol.

- **Profiles** ([`profiles.ts`](../../lib/market-data/profiles.ts)), for ETFs, funds and stocks: the cron refreshes up to 20 profiles a run that are missing or older than 30 days, oldest first. An empty answer is still saved so it is not asked again every day. When the overview page finds instruments without a profile, up to 5 are fetched in `after()`, at most once an hour per instrument.
- **Dividends** ([`dividends.ts`](../../lib/market-data/dividends.ts)), for `auto` stocks, ETFs and funds: the cron refreshes up to 20 histories a run that were never downloaded or are older than 7 days. Events in a currency other than the instrument's are dropped. `dividendsFetchedAt` is set even when there are none (accumulating ETFs). On-demand fetches follow the same limits as profiles.
- **Fundamentals and statements** ([`fundamentals.ts`](../../lib/market-data/fundamentals.ts), [`statements.ts`](../../lib/market-data/statements.ts)) are fetched only when a security page asks, and cached in Redis for 24 hours (1 hour when empty). Statements are for stocks only: annual figures for up to 6 years and a trailing twelve months. If Redis is down the source is asked directly. Both functions never throw; a failure becomes `unavailable` or null.

### 4.14 Search

- **Yahoo search** ([`searchInstrumentsOnProviders`](../../lib/market-data/runtime.ts)) caches successful results for 6 hours per lower-cased query.
- **Crypto** ([`crypto-catalog.ts`](../../lib/market-data/crypto-catalog.ts)): the cron stores the top 500 coins by market cap (two pages of 250 from CoinGecko, in EUR). Searches match the catalog first (exact symbol, then name prefix, then market cap); only off-catalog searches call CoinGecko, cached for a day, with a 2-minute shared pause after a refusal.
- **ISIN** ([`searchByIsinOnProviders`](../../lib/market-data/runtime.ts)): when Yahoo search misses an ISIN, OpenFIGI lists its exchanges and Yahoo confirms the symbol's currency and exchange.

### 4.15 Watchlist and price alerts

Adding an instrument to the watchlist (`PUT /api/instruments/[id]/watch`) inserts a `user_watchlist_items` row and starts a backfill. Watched instruments and instruments with an active alert are then kept fresh by the daily update (section 4.7).

[`evaluatePriceAlerts`](../../lib/investments/alerts-run.ts) runs at the end of every price run, for active alerts on `auto` instruments:

```text
triggered = direction == "sopra" ? close >= target : close <= target
```

`close` is the latest row in `instrument_prices` (manual prices are not used), in the instrument's currency. A triggered alert is claimed with a conditional `UPDATE ... WHERE status = 'attivo'`, so with several pods only one sends the email, once. Without `RESEND_API_KEY` and `RESEND_FROM` the alert still triggers and shows in the app, but no email is sent. An email failure does not undo the trigger. Example: an alert "below 50.00" and a latest close of 49.80 trigger; the alert becomes `scattato` with a trigger price of 49.80 and does not fire again.

### 4.16 Observability

Metrics ([`lib/observability/metrics.ts`](../../lib/observability/metrics.ts)): `buddybudget_price_provider_requests_total{provider,outcome}`, `buddybudget_price_update_instruments_total{outcome}` (`updated`, `fallback`, `failed`), `buddybudget_fx_provider_requests_total`, `buddybudget_fundamentals_requests_total`, and the cron heartbeat from `recordCronRun("market_prices")`. Log events include `market.prices.updated`, `market.prices.failed`, `market.prices.fallback_used`, `market.prices.isin_fallback_used`, `market.prices.suspect`, `market.fx.all_failed`, `market.inflation.updated`/`failed`, `market.rates.updated`/`failed`, `market.profiles.updated`/`failed`, `market.dividends.failed`, `market.backfill.failed`, `market.alerts.evaluated`/`email_failed`.

## 5. Limits and out of scope

- **Free sources only.** Yahoo and Borsa Italiana are unofficial endpoints that can change or block without notice. Paid sources and SEC filings are out of scope.
- **End-of-day only.** Three runs a day read daily closes; there are no intraday quotes.
- **Held set ignores splits.** `findHeldAutoInstruments` sums quantities without applying split ratios, so any instrument with a split is always treated as held.
- **Backfill checks only the first date.** `ensureHistory` starts a backfill only when the first stored close is later than needed; gaps inside the stored range are filled only by the 7-day daily window.
- **A suspect close is saved.** The plausibility check only logs.
- **Inflation areas** are those of the supported product countries (`IT`, `DE`). **Risk-free rate** is €STR only.
- **Overlap data** uses Yahoo's top 10 holdings; ETF regions from issuers' files are deferred.
- **Alerts** use automatic closes only, fire once, and have no push notification (deferred).
- To verify by hand (CLAUDE.md): the probe script `scripts/probe-price-sources.ts` from the VPS, real Yahoo, Eurostat and ECB answers, `COINGECKO_API_KEY` as a secret, a real alert email, no new 429s across the three daily runs. The cloud sandbox cannot reach these sources.

## 6. Tests

- [`chain.test.ts`](../../lib/market-data/chain.test.ts): first valid source wins; fallback on error, empty or wrong currency; closes without currency; silent skips; breaker after 3 errors and immediately on a block; empty resets failures; daily budget; backfill skips limited sources.
- [`update.test.ts`](../../lib/market-data/update.test.ts) (database): fallback with the source saved, daily overwrite, sold-out instruments ignored, FX with fallback, ISIN retry not saved as a symbol, `market.fx.all_failed`, backfill leaves stored days untouched.
- [`symbols.test.ts`](../../lib/market-data/symbols.test.ts): derivation for Xetra ETFs, Milan ETFs, US and Italian stocks, bonds, funds and crypto.
- [`backfill-state.test.ts`](../../lib/market-data/backfill-state.test.ts): no double start, restart after interruption, progress and finish.
- [`inflation.test.ts`](../../lib/market-data/inflation.test.ts), [`providers/eurostat.test.ts`](../../lib/market-data/providers/eurostat.test.ts): JSON-stat parsing, first download from 2000 then 36 months, full replacement on a base change with rollback on failure, country isolation, request shape and rejection of wrong series.
- [`profiles-rates.integration.test.ts`](../../lib/market-data/profiles-rates.integration.test.ts): only missing or stale profiles, empty answers saved, €STR from 2019 then 30 days.
- [`providers/main-providers.test.ts`](../../lib/market-data/providers/main-providers.test.ts), [`fallback-providers.test.ts`](../../lib/market-data/providers/fallback-providers.test.ts), [`profile-rate-providers.test.ts`](../../lib/market-data/providers/profile-rate-providers.test.ts), [`openfigi.test.ts`](../../lib/market-data/providers/openfigi.test.ts): parsing from fixtures, pence conversion, typed 429/403, HTML instead of JSON, Yahoo session reuse and single retry, quota messages with status 200.
- [`crypto-catalog.test.ts`](../../lib/market-data/crypto-catalog.test.ts), [`statements.test.ts`](../../lib/market-data/statements.test.ts): catalog ranking and caching; statement grouping and trailing twelve months.
- [`lib/investments/alerts.test.ts`](../../lib/investments/alerts.test.ts): trigger rules and email content. [`lib/calc/fx.test.ts`](../../lib/calc/fx.test.ts): EUR pivot and last-rate lookup.

## 7. Related

- [overview.md](overview.md), [investments.md](investments.md), [background-jobs.md](background-jobs.md), [net-worth.md](net-worth.md), [analytics-and-goals.md](analytics-and-goals.md)
- Specs: [`2026-09-27-investimenti-design.md`](../superpowers/specs/2026-09-27-investimenti-design.md) (section 2 on sources), [phase 2](../superpowers/specs/2026-09-29-investimenti-fase-2-design.md), [phase 3](../superpowers/specs/2026-09-29-investimenti-fase-3-design.md), [phase 4](../superpowers/specs/2026-09-30-investimenti-fase-4-design.md)
- Decisions: [`2026-10-11-scheda-titolo-e-indicatori.md`](../decisioni/2026-10-11-scheda-titolo-e-indicatori.md), [`2026-10-14-inflazione-germania.md`](../decisioni/2026-10-14-inflazione-germania.md); earlier ones (browserTlsFetch on 2026-09-28, three runs a day on 2026-10-01) in [`docs/decision-log.md`](../decision-log.md)
