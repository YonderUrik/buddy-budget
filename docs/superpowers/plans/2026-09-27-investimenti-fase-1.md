# Investimenti (Investments) — Phase 1: basic portfolio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the `/investimenti` screen. Transactions (purchases, sales, dividends, coupons, redemptions) and PACs (piani di accumulo, recurring investment plans) are recorded by hand. Closing prices arrive every evening from a **chain of free sources with automatic fallback**. Value, gain, composition and trend over time are shown; the value of investments enters the net worth in Panoramica (Overview).

**Architecture:**
- **Instruments, per-source symbols, prices and exchange rates**: shared by all users.
- **Portfolios, transactions, PACs and manual prices**: per user.
- **Positions and values**: never stored. They are calculated with pure functions in `lib/calc/investments.ts` from transactions + prices + exchange rates.
- **Price sources**: all behind the `PriceProvider` interface (`lib/market-data/providers/`). A chain function (`lib/market-data/chain.ts`) applies the rules of the spec, section 2.1: order by type, currency, sources disabled without a key, circuit breaker, budget, plausibility.
- **Updates**: an evening cron (`/api/cron/market-prices`) updates the held instruments. History backfill runs in `after()` with per-instrument state on Redis.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (Postgres, versioned migrations), TanStack Query, Recharts via `components/ui/chart.tsx`, Zod 4, Vitest, `yahoo-finance2` (new dependency).

**Spec:** `docs/superpowers/specs/2026-09-27-investimenti-design.md` (sections 2.1 and 4 are the reference for every task).

**Branch:** `claude/investment-analysis-tool-wbdcvk` (app) and the same name in the `buddy-budget-infra` repo for the CronJob (Task 9).

## Global Constraints

- Visible strings in Italian. No hardcoded colors or radii: only theme tokens.
- One-line JSDoc on every public function and component; props types exported; `index.ts` barrel for `components/domain/investments/` and `lib/market-data/`.
- No business logic in `app/(app)/investimenti/page.tsx`.
- **Schema only via migrations**: `pnpm db:generate` → migration committed in `lib/db/migrations/` → `pnpm db:migrate` on the development DB. Never `db:push` (it no longer exists), never `ALTER/CREATE` by hand.
- "List" columns (`type`, `priceMode`, `provider`, `source`, `frequency`…) are `text` + TS constants, not Postgres enums.
- Amounts and prices: `numeric`, written as strings. Precisions: quantities `numeric(24,10)`, prices and exchange rates `numeric(20,8)`, amounts in the user's currency `numeric(14,2)`.
- **Observability** (CLAUDE.md standard): routes exported with `withRoute("<resource>.<action>", handler)` and a static name; `bindRequestUser()` after the session check; no `console.*`. **Never in logs**: a user's quantities, amounts, prices paid or portfolio composition. The symbol of a shared instrument can be logged, the link "this user holds X" cannot.
- **External sources never called in tests**: providers receive an injected `fetch`, and tests use fixtures saved in `lib/market-data/providers/__fixtures__/`.
- **Optional keys** in `lib/env.ts`: `ALPHAVANTAGE_API_KEY`, `STOOQ_API_KEY`, `TWELVEDATA_API_KEY`, `COINGECKO_API_KEY`, `OPENFIGI_API_KEY`. A missing key disables the source without error.
- Tests against the shared development Postgres: test users and instruments with id `test-…-${crypto.randomUUID()}`, deleted in `afterEach`. Never launch the real cron in tests.
- Commands: `pnpm exec vitest run <path>`, `pnpm exec tsc --noEmit`, `pnpm lint`.
- Implementer subagent: no git commands other than `git add` and `git commit`.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/probe-price-sources.ts` (create) | Task 1: source coverage probe, saves fixtures |
| `lib/db/schema/investments.ts` (create) | Investment tables + constants |
| `lib/db/schema/net-worth-snapshots.ts` (modify) | `ASSET_CLASSES` += `"investimenti"` |
| `lib/db/migrations/0001_*.sql` (generate) | Migration |
| `lib/calc/investments.ts` (+ test) | Positions, average cost, realized, value, series, composition |
| `lib/calc/fx.ts` (+ test) | Conversion between currencies via EUR |
| `lib/market-data/types.ts` | `PriceProvider`, `FxProvider`, `DailyClose`, `ProviderId`, `ProviderOutcome` |
| `lib/market-data/chain.ts` (+ test) | Chain execution with the rules of spec 2.1 |
| `lib/market-data/chains.ts` | `PROVIDER_CHAINS` per instrument type |
| `lib/market-data/providers/*.ts` (+ test) | yahoo, stooq, alphavantage, twelvedata, coingecko, kraken, borsaitaliana, ecb, frankfurter, openfigi |
| `lib/market-data/symbols.ts` (+ test) | Per-source symbol resolution |
| `lib/market-data/update.ts` (+ test) | Daily update and history backfill (`onProgress`) |
| `lib/market-data/backfill-state.ts` | History backfill state on Redis, per instrument |
| `lib/validation/investments.ts` (+ test) | Zod schemas |
| `app/api/instruments/**` | Search, creation, history status, manual price |
| `app/api/investments/**` | Portfolios, transactions, PACs, portfolio data |
| `app/api/cron/market-prices/route.ts` (+ test) | Evening cron |
| `lib/observability/metrics.ts` (modify) | `CronName` += `market_prices`, `recordPriceProviderRequest` |
| `lib/net-worth/snapshots.ts`, `lib/calc/net-worth.ts` (modify) | `investimenti` class |
| `lib/queries/investments.ts` | TanStack Query hooks |
| `components/domain/investments/*` | UI (detail in Task 13) |
| `app/(app)/investimenti/page.tsx` | Orchestration |
| `components/layout/sidebar.tsx`, `components/domain/auth/upcoming-features.data.ts` (modify) | Screen no longer "coming soon" |
| `buddy-budget-infra: argocd/manifests/app/cronjob-market-prices.yaml` | CronJob |

---

### Task 1: Source coverage probe (Phase 0)

Run **outside the cloud sandbox** (there the sources answer 403): locally and from the VPS. It serves to confirm `PROVIDER_CHAINS` and to record the real responses as fixtures.

**Files:** create `scripts/probe-price-sources.ts`, `lib/market-data/providers/__fixtures__/*`

- [ ] `tsx` script with no DB dependencies. Sample of public instruments:
  - ETF: VWCE (IE00BK5BQT80) on Xetra and Milan, SWDA (IE00B4L5Y983)
  - Italian stock: ENEL (IT0003128367)
  - US stock: Apple (US0378331005)
  - a BTP (Italian government bond) and a mutual fund, with ISINs chosen at the time from the public lists of Borsa Italiana and Morningstar
  - crypto: bitcoin
  - exchange rates: USD, GBP, CHF
- [ ] For every source × instrument pair the script records: search by ISIN, symbol found, last 30 closes, currency, response time, HTTP code. Output: a table on the console and the raw responses saved as fixtures (`<provider>-<caso>.json|csv`), with no keys in the URLs.
- [ ] Borsa Italiana: try the `grafici.borsaitaliana.it` endpoint with the anonymous token (see the `Librefolio/borsaItaliana-scraping` library) and document the exact flow in the file (token URL, headers, response format).
- [ ] **The user runs it** locally (`pnpm exec tsx scripts/probe-price-sources.ts`) and from the VPS. From the VPS a throwaway k8s Job is used in the `app` namespace with the `migrator` image, which contains `tsx` and the development dependencies. The Job manifest goes in the runbook at the bottom of the script.
- [ ] Report the outcome in a table in the spec (section 3) and fix the order in `PROVIDER_CHAINS` if needed.
- [ ] Commit: `chore(investimenti): script di prova delle fonti prezzi e fixture`.

**It does not block Tasks 2-8**, which use synthetic fixtures. The real fixtures replace the synthetic ones as soon as they are available.

### Task 2: Schema and migration

**Files:** create `lib/db/schema/investments.ts`; modify `lib/db/schema/index.ts`, `lib/db/schema/net-worth-snapshots.ts`; generate migration

- [ ] Constants:
  - `INSTRUMENT_TYPES = ["etf","azione","obbligazione","fondo","crypto","etc"]`
  - `PRICE_MODES = ["auto","manuale"]`
  - `PRICE_UNITS = ["unita","percentuale_nominale"]`
  - `PROVIDER_IDS = ["yahoo","borsaitaliana","stooq","alphavantage","twelvedata","coingecko","kraken"]`
  - `INVESTMENT_TRANSACTION_TYPES = ["acquisto","vendita","dividendo","cedola","rimborso"]`
  - `PLAN_FREQUENCIES = ["mensile","bimestrale","trimestrale"]`
- [ ] Tables, as in spec 4.1:
  - **`instruments`**: `id`, `isin` (partial unique `where isin is not null`), `name`, `type`, `currency`, `priceMode`, `priceUnit`, `exchange`, `taxRate numeric(5,4)` with default `0.26`, `taxHarmonized boolean` nullable, `createdByUserId` nullable (FK `auth_user`, `set null`), timestamps.
  - **`instrument_symbols`**: `instrumentId` FK cascade, `provider`, `symbol`, `resolvedAt`; unique `(instrumentId, provider)`.
  - **`instrument_prices`**: `instrumentId`, `date`, `close`, `source`; unique `(instrumentId, date)`; index `(instrumentId, date desc)`.
  - **`user_instrument_prices`**: `userId`, `instrumentId`, `date`, `close`; unique `(userId, instrumentId, date)`.
  - **`fx_rates`**: `date`, `currency`, `perEur`, `source`; unique `(date, currency)`.
  - **`investment_portfolios`**: `userId`, `name`, `broker`.
  - **`investment_transactions`**: `userId`, `portfolioId` (FK cascade), `instrumentId` (FK restrict), `type`, `date`, `quantity`, `price`, `fxRate`, `fees`, `taxes`, `grossAmount`, `note`; index `(userId, date)`.
  - **`investment_plans`**: `userId`, `portfolioId`, `instrumentId`, `amount`, `frequency`, `dayOfMonth` (1-28), `active`.
- [ ] `ASSET_CLASSES = ["liquidita", "investimenti"] as const` (text column, no migration for this).
- [ ] `pnpm db:generate` → check the generated SQL (partial unique on `isin`, FKs, indexes) → `pnpm db:migrate` on the development DB.
- [ ] Minimal integration test: insertion and unique `(instrumentId, date)`; the `restrict` constraint prevents deleting an instrument in use.
- [ ] Commit: `feat(investimenti): schema e migration`.

### Task 3: Pure portfolio calculations

**Files:** create `lib/calc/investments.ts`, `lib/calc/investments.test.ts`, `lib/calc/fx.ts`, `lib/calc/fx.test.ts`

- [ ] `convert(amount, from, to, date, rates)`: goes through EUR (`perEur`), uses the latest available rate ≤ date and throws a typed error if there is none.
- [ ] `computePositions(transactions, asOf)` → per instrument: `quantity`, `averageCost` (weighted average cost in the user's currency, purchase fees included), `realizedGain` (sales and redemptions against the average cost, net of fees), `income` (net dividends and coupons), `investedNet`. A sale reduces the units without changing the average cost.
- [ ] `validateSell(transactions, candidate)`: false if the sale exceeds the units held at the date (used by the route in Task 11).
- [ ] `resolvePrice(instrumentId, date, autoPrices, manualPrices)`: latest price ≤ date; on the same date or if more recent, the manual one wins. Also returns `priceDate` and `source`.
- [ ] `positionValue`: for `percentuale_nominale` (percentage of nominal) it is `quantity × close / 100`.
- [ ] `computePortfolioSummary(...)` → value, change since the previous close, unrealized gain, realized, income, total in € and %.
- [ ] `buildPortfolioSeries(transactions, prices, manual, rates, range)` → daily points `{ date, value, invested }`, same adaptive granularity as `buildNetWorthSeries`: `getNetWorthPeriodRange` is reused.
- [ ] `computeComposition(positions, by: "type" | "currency")` → percentages.
- [ ] Tests: multiple purchases and average cost; partial and total sale; fees; bond priced as a percentage of nominal; instrument in USD with exchange rate; manual price more recent than the automatic one; no price (value `null`, never 0); sale beyond the units held.
- [ ] Commit: `feat(investimenti): calcoli puri del portafoglio e cambi`.

### Task 4: Source chain (logic, without real sources)

**Files:** create `lib/market-data/types.ts`, `lib/market-data/chain.ts`, `lib/market-data/chain.test.ts`, `lib/market-data/chains.ts`, `lib/market-data/index.ts`

- [ ] `PriceProvider { id; requiresKey: boolean; isEnabled(env): boolean; maxHistory: "unlimited" | "limited"; minDelayMs; fetchDailyCloses(symbol, from, to, deps): Promise<DailyClose[]> }` with `DailyClose { date, close, currency }`. Typed errors: `ProviderRateLimitedError`, `ProviderBlockedError`, `ProviderError`.
- [ ] `PROVIDER_CHAINS: Record<ChainKey, ProviderId[]>` with the keys `etf_eu`, `stock_us`, `bond`, `fund`, `crypto`, plus `chainKeyFor(instrument)`: stocks with USD currency use `stock_us`, the others `etf_eu`.
- [ ] `runChain({ instrument, symbols, from, to, purpose: "daily" | "backfill", providers, state, lastClose })` → `{ closes, source, attempts: {provider, outcome}[] }`. Implements all the rules of spec 2.1:
  1. order
  2. validity, currency included
  3. source without a key → `skipped`
  4. circuit breaker after 3 consecutive errors, with state shared within the run (`ChainRunState`)
  5. daily budget through an injected `BudgetStore`
  6. for `backfill` only `unlimited` sources
  7. plausibility: >20% off from a different source → `suspect` flag (crypto excluded)
  8. all failed → `closes: []`
- [ ] Tests with fake providers: fallback to the second; wrong currency discarded; source without a key skipped; circuit breaker trips at the third error and applies to the following instruments; budget exhausted; `backfill` skips `limited` sources; `suspect` flagged; source without a symbol skipped.
- [ ] Commit: `feat(market-data): catena di fonti con riserva automatica`.

### Task 5: Main sources (Yahoo, ECB, Frankfurter, CoinGecko, Kraken)

**Files:** create `lib/market-data/providers/{yahoo,ecb,frankfurter,coingecko,kraken}.ts` + tests; `pnpm add yahoo-finance2`

- [ ] **Yahoo**: `chart()` for history, `search()` for searching by ISIN/name, with a wrapper that converts the library's exceptions into the typed errors. For the currency `meta.currency` is used. Watch out: Yahoo reports pounds sterling in pence (`GBp`), to be converted into `GBP`/100. Must be tested.
- [ ] **ECB**: `data-api.ecb.europa.eu` in CSV format, series `EXR/D.<CUR>.EUR.SP00.A`, for the currencies used by the instruments. **Frankfurter**: same shape, as a fallback.
- [ ] **CoinGecko**: `market_chart/range` in EUR/USD; optional key header (without a key it works but is slower). **Kraken**: public OHLC.
- [ ] Parser tests on the fixtures (synthetic until Task 1 provides the real ones): correct parsing, empty response, 429 → `ProviderRateLimitedError`.
- [ ] Commit: `feat(market-data): fonti Yahoo, BCE, Frankfurter, CoinGecko, Kraken`.

### Task 6: Fallback sources (Stooq, Alpha Vantage, Twelve Data, Borsa Italiana)

**Files:** create `lib/market-data/providers/{stooq,alphavantage,twelvedata,borsaitaliana}.ts` + tests; modify `lib/env.ts` (+ test)

- [ ] Optional keys in `lib/env.ts`. Test: the app starts without them.
- [ ] **Stooq**: CSV with `apikey`. **Alpha Vantage**: `TIME_SERIES_DAILY` with `maxHistory: "limited"` and a budget of 25/day. **Twelve Data**: `time_series` with `maxHistory: "limited"`.
- [ ] **Borsa Italiana**: flow discovered in Task 1 (anonymous token + history endpoint). If Task 1 has not been done yet or the endpoint is blocked, implement the parser on fixtures anyway and keep the source **at the end** of the chains. The firewall block (403, challenge page) becomes `ProviderBlockedError`, so the circuit breaker trips.
- [ ] Parser tests on the fixtures. Test of the Borsa Italiana block (HTML response instead of JSON).
- [ ] Commit: `feat(market-data): fonti di riserva Stooq, Alpha Vantage, Twelve Data, Borsa Italiana`.

### Task 7: Symbol resolution and instrument search

**Files:** create `lib/market-data/symbols.ts` (+ test), `lib/market-data/providers/openfigi.ts`, `app/api/instruments/search/route.ts`, `app/api/instruments/route.ts` (+ test)

- [ ] `resolveSymbols(instrument, yahooHit)`:
  - Yahoo: from the search.
  - Stooq: derived from the Yahoo symbol (`VWCE.DE` → `vwce.de`, `AAPL` → `aapl.us`).
  - Alpha Vantage: exchange suffixes (`.DE` → `.DEX`, `.MI` → `.MIL`, `.L` → `.LON`).
  - Twelve Data: symbol + `mic_code`.
  - Borsa Italiana: search by ISIN.
  - CoinGecko: id from the search.
  Maps in tested constants. Unresolved sources stay without a row and are retried (see Task 8).
- [ ] `GET /api/instruments/search?q=` (authenticated, `withRoute("instruments.search")`): searches first among the instruments already in the DB, then on Yahoo, then on OpenFIGI if `q` is an ISIN. Results with name, ISIN, exchange, currency, proposed type. For ETFs it proposes EUR listings first (Xetra, Milan).
- [ ] `POST /api/instruments`: creates the instrument or reuses the existing one with the same ISIN, resolves the symbols and starts the history backfill (Task 8). A `manuale` (manual) instrument has `createdByUserId` and stays visible only to its author.
- [ ] Tests: reuse by ISIN, manual instrument not visible to another user, suffix maps.
- [ ] Commit: `feat(investimenti): ricerca strumenti e risoluzione simboli per fonte`.

### Task 8: Price updates and history backfill

**Files:** create `lib/market-data/update.ts` (+ test), `lib/market-data/backfill-state.ts`, `app/api/instruments/[id]/backfill/route.ts`; modify `lib/observability/metrics.ts` (+ test)

- [ ] `updateHeldInstruments({ today, deps, onProgress })`:
  - `auto` instruments held by at least one user (quantity > 0 today), plus the exchange rates of their currencies and of the users' currencies;
  - for each one `runChain` in `daily` mode over the last 7 days (covers holidays and gaps), upsert into `instrument_prices` with `source`;
  - retries resolving missing symbols;
  - an error on one instrument does not stop the others. Returns a summary: updated, from fallback, failed, suspect.
- [ ] `backfillInstrument(instrumentId, from, { onProgress })`: `runChain` in `backfill` mode from the date of the first transaction, inserted in blocks of 500 with `onConflictDoNothing`. Idempotent and resumable.
- [ ] Backfill state on Redis per instrument (`market:backfill:<instrumentId>`, TTL 24h, heartbeat): instruments are shared, so a single backfill even if two users request it. The work starts in `after()` from `POST /api/instruments` and from the creation of a transaction dated before the existing history.
- [ ] `GET /api/instruments/[id]/backfill` returns the state for polling. **Deviation from the "Long-running operations" standard**, to be noted in the CLAUDE.md log: progress is shown as a badge on the position in `/investimenti`, not in the global indicator, because it takes a few seconds per instrument and concerns only that page.
- [ ] Metrics: `CronName` += `"market_prices"`; `recordPriceProviderRequest(provider, outcome)` with closed enums. Logs `market.prices.fallback_used` / `market.prices.suspect` / `market.prices.failed` with symbol and source, **never** the user.
- [ ] Tests with fake providers and the development DB: idempotent upsert, fallback recorded in `source`, instrument not held ignored, resumable backfill.
- [ ] Commit: `feat(market-data): aggiornamento giornaliero e recupero storico`.

### Task 9: `market-prices` cron

**Files:** create `app/api/cron/market-prices/route.ts` (+ test); infra repo: `argocd/manifests/app/cronjob-market-prices.yaml`, `kustomization.yaml`

- [ ] Route copied from the `app/api/cron/net-worth-snapshot/route.ts` model: `isAuthorizedCronRequest`, `maxDuration = 300`, `recordCronRun("market_prices", …)`, `withRoute("cron.market_prices", …)`. No user data in the response, only the summary counts.
- [ ] Infra CronJob, same scheme as `cronjob-net-worth-snapshot.yaml`, `schedule: "30 22 * * *"`. No `timeZone`, like the others: these are UTC times, so 00:30 in summer and 23:30 in winter in Rome, after the US close and **before** `net-worth-snapshot` (23:50 UTC). The same every day, weekends included (crypto).
- [ ] The new optional keys, if the user wants them, go into the SOPS-encrypted `app-env` Secret. Without keys, Yahoo, Borsa Italiana, ECB, Frankfurter, CoinGecko and Kraken still work.
- [ ] Route tests: 401 without the secret, 200 with summary (fake dependencies).
- [ ] App commit: `feat(investimenti): cron market-prices`. Infra commit: `feat(app): CronJob market-prices`.

### Task 10: Net worth with investments

**Files:** modify `lib/net-worth/snapshots.ts` (+ test), `lib/calc/net-worth.ts` (+ test), `components/domain/net-worth/net-worth-composition-row.utils.ts` (+ test)

- [ ] `writeDailySnapshot` also writes the `investimenti` row (portfolio value with `computePortfolioSummary`), only if the user has transactions.
- [ ] `derivato` (derived) reconstruction of investments from the first transaction (at most 24 months, like cash), done at the first recorded transaction: `buildPortfolioSeries` is reused.
- [ ] `findUsersWithAccounts` also includes users who only have investments.
- [ ] The composition row in Panoramica shows "Investimenti". The allocation donut deferred on 2026-09-13 stays out of this plan (it goes to the backlog).
- [ ] Commit: `feat(panoramica): investimenti nel patrimonio netto`.

### Task 11: API for portfolios, transactions, PACs, manual prices

**Files:** create `lib/validation/investments.ts` (+ test), `app/api/investments/portfolios/route.ts`, `app/api/investments/transactions/route.ts`, `app/api/investments/transactions/[id]/route.ts`, `app/api/investments/plans/route.ts`, `app/api/investments/plans/[id]/route.ts`, `app/api/investments/overview/route.ts`, `app/api/instruments/[id]/manual-prices/route.ts` (+ a test for each)

- [ ] Zod: quantity > 0, price > 0 (except `dividendo`/`cedola` — dividend/coupon — where `grossAmount` is what counts), fees and taxes ≥ 0, date not in the future, optional `fxRate`. If missing, the route prefills it from the ECB at the date.
- [ ] Ownership on portfolio and transaction (IDOR: same scheme as the transactions routes). A `vendita` (sale) or `rimborso` (redemption) beyond the units held → 400 with a clear message, using `validateSell` also on edit and delete (deleting a purchase must not make a later sale negative).
- [ ] `GET /api/investments/overview?period=`: transactions, prices, manual prices and exchange rates of the user's instruments in the period, plus the history backfill state. As in Cash flow, the calculations are done client-side with `lib/calc/investments.ts`.
- [ ] On first access a default "Portafoglio" ("Portfolio") is created.
- [ ] Umami `track()` after a successful outcome: `investment_transaction_created`, `investment_plan_created` (new names in `ProductEvents`, only categorical props).
- [ ] Commit: `feat(investimenti): API operazioni, PAC e prezzi manuali`.

### Task 12: TanStack Query hooks

**Files:** create `lib/queries/investments.ts`

- [ ] `useInvestmentsOverviewQuery(period)`, `useInstrumentSearchQuery(q)` (300 ms debounce), mutations to create/edit/delete transactions, PACs, manual prices and instruments, with invalidation of the overview.
- [ ] `useBackfillStatusQuery(ids)` with `refetchInterval` active only while at least one instrument is being backfilled.
- [ ] Commit: `feat(investimenti): hook dati`.

### Task 13: UI components

**Files:** create in `components/domain/investments/`:
- `investments-kpi-cards.tsx`
- `portfolio-chart-card.tsx`: value vs invested, reuses `NetWorthPeriodSelector`
- `positions-table.tsx`: on mobile it becomes a list of rows, like `TransactionRow`; "storico in caricamento" ("history loading") and "prezzo del gg/mm" ("price of dd/mm") badges when the price is not today's
- `portfolio-composition.tsx`: by type and by currency
- `investment-transactions-list.tsx`
- `register-operation-dialog.tsx` and `register-operation-form.tsx`
- `instrument-picker.tsx`: search by name or ISIN, same style as `CategoryPicker`
- `plans-card.tsx`
- `manual-price-dialog.tsx`
- `index.ts`

- [ ] State separated from the UI: the form logic (computed total, prefill from the PAC, type changing the visible fields) goes in `register-operation-form.state.ts` with tests.
- [ ] Amounts with `formatCurrency` from `lib/format.ts`, gains with `text-pos`/`text-neg`, no red on outflows (same rule as `StatCard tone`).
- [ ] No file above ~150 lines of JSX.
- [ ] Commit: `feat(investimenti): componenti UI`.

### Task 14: Page and "coming soon"

**Files:** create `app/(app)/investimenti/page.tsx`; modify `components/layout/sidebar.tsx`, `components/domain/auth/upcoming-features.data.ts`

- [ ] The page orchestrates: loading with skeleton, error with `LoadError`, empty state ("Registra il primo investimento" — "Record your first investment" — + instrument search), then KPIs, chart, positions, composition, PACs, transactions.
- [ ] Remove `comingSoon` from Investimenti in `NAV_ITEMS`; remove Investimenti from `UPCOMING_FEATURES`.
- [ ] Live verification with Playwright against local Postgres/Redis and fake providers (variable `MARKET_DATA_FAKE=1`, reads only the fixtures and never activates in production: `lib/env.ts` rejects it if `NODE_ENV=production`). To verify: 390px and 1280px, record a purchase, a sale beyond the units held, a manual price, a PAC with "Registra esecuzione" ("Record execution").
- [ ] Commit: `feat(investimenti): pagina /investimenti`.

### Task 15: Wrap-up

- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, full `pnpm test` suite.
- [ ] CLAUDE.md: project status, phase log, deviation of the history backfill indicator.
- [ ] Message in `#bb-backlog`: Phase 1 → Done, new items for the allocation donut and the manual verification.
- [ ] **Manual user verification** in production after the merge:
  - the first run of the `market-prices` cron writes prices, and `source` shows the sources used (query in the runbook);
  - an ETF on Xetra and one on Milan, a BTP, a fund and a crypto show plausible prices;
  - the real PAC recorded by hand matches Fineco's average price;
  - Panoramica shows Liquidità + Investimenti (Cash + Investments);
  - after 2-3 days, in Grafana, the requests per source and outcome (how much the fallbacks are used).
