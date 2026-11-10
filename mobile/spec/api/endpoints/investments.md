# Investments

Feature area(s): Investimenti (Portafoglio, Performance, Diversificazione, Operazioni, Proventi, Tasse, Titoli, Rendiconti, Rendiconti > Importazioni), Import wizard (broker statements / generic CSV), Sidebar summary.
Source: `app/api/investments/**/route.ts`, `lib/investments/**` (`data.ts`, `titles-list.ts`, `operations.ts`, `import/*`), `lib/validation/investments.ts`, `lib/validation/investments-import.ts`, `lib/db/schema/investments.ts`, `lib/db/schema/broker-statements.ts`, client hooks in `lib/queries/investments.ts`, `lib/queries/titles.ts`.

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| POST | /api/investments/dividends/dismissed | Dismiss "dividend/coupon to record" proposals | session | idempotent |
| DELETE | /api/investments/dividends/dismissed | Restore dismissed proposals | session | JSON body on DELETE |
| POST | /api/investments/import | Dry-run preview or atomic import of operations (generic rows or full broker statement) | session | synchronous (NOT a job); price history + categorization run in `after()` |
| POST | /api/investments/import/parse | Server-side parse of IBKR / DEGIRO / Trade Republic CSV | session | raw `text/csv` body, 5 MB cap, no writes except format metadata |
| GET | /api/investments/import/reset | Preview of full investment-history reset (revision hash + counts) | session | `Cache-Control: no-store` |
| DELETE | /api/investments/import/reset | Wipe investment history (needs revision + typed confirmation) | session | destructive |
| POST | /api/investments/import/resolve | Match file instruments to catalogue / market providers | session | read-only; calls Yahoo/CoinGecko/OpenFIGI sequentially; `maxDuration` 120 s |
| GET | /api/investments/overview | All raw portfolio data for client-side calculations | session | may schedule profile/dividend fetches in `after()` |
| PATCH | /api/investments/portfolio | Set benchmark instrument and/or tax regime | session | `taxRegime` blocked for DE (403); benchmark history fetch in `after()` |
| GET | /api/investments/statements | Imported broker statements (valuation + cash ledger) | session | `Cache-Control: no-store` |
| DELETE | /api/investments/statements/{id} | Delete a statement import and all later ones of the same account | session | requires exact confirmed id set |
| PUT | /api/investments/targets | Replace target allocation | session | |
| POST | /api/investments/tax-carryforwards | Add a prior-year capital loss ("zainetto") | session | **DE -> 403** (proxy + `withCountryGuard`) |
| DELETE | /api/investments/tax-carryforwards/{id} | Delete a carryforward | session | **DE -> 403** (proxy + `withCountryGuard`) |
| GET | /api/investments/titles | Watchlist + held titles with last close, changes, sparkline, alert counts | session | |
| POST | /api/investments/transactions | Create one investment operation | session | price history fetch in `after()` |
| PATCH | /api/investments/transactions/{id} | Replace an operation (full object) | session | 409 for reconciled statement operations |
| DELETE | /api/investments/transactions/{id} | Delete an operation | session | 409 for reconciled statement operations |

General facts for this resource:
- **No route calls `rejectIfDemoActive`.** No route uses `withCountryGuard` except the two tax-carryforwards handlers.
- **There is no GET for transactions, portfolios, targets, carryforwards, prices or instruments here**: all of them are returned in bulk by `GET /api/investments/overview`, and the web computes positions/values/charts/taxes **client-side** (`lib/calc/investments.ts`, `lib/investments/view.ts`, etc.). See "Mobile notes" under overview.
- Background work is always via Next `after()` (no `jobId`). Price-history backfill progress is polled via `GET /api/instruments/backfill?ids=...` (documented in the instruments resource), the web polls every 2 s while any instrument is `running`.
- Validation errors use the standard `400 { error: issues[0].message }` unless stated otherwise. Messages are Italian, not localized.
- Path ids for `transactions/{id}` and `statements/{id}`: see each endpoint for how a malformed UUID is handled.

### Shared enums (`lib/investments/constants.ts`)

```ts
type InstrumentType = "etf" | "azione" | "obbligazione" | "fondo" | "crypto" | "etc";
type PriceMode = "auto" | "manuale";
type PriceUnit = "unita" | "percentuale_nominale";       // bonds: value = quantity(nominal) * price / 100
type ProviderId = "yahoo" | "borsaitaliana" | "stooq" | "alphavantage" | "twelvedata" | "coingecko" | "kraken";
type InvestmentTransactionType = "acquisto" | "vendita" | "dividendo" | "cedola" | "rimborso" | "split" | "rettifica";
// split: ratio (new shares per old) stored in `quantity`. rettifica: capital adjustment, only via broker statement import.
type TaxRegime = "amministrato" | "dichiarativo";
type CouponFrequency = 1 | 2 | 4;
```

### Shared row types (Drizzle select, as serialized)

```ts
interface Instrument {                // table `instruments` (shared catalogue; private if createdByUserId != null)
  id: string;                         // uuid
  isin: string | null;
  name: string;
  type: InstrumentType;
  currency: string;                   // ISO 4217
  priceMode: PriceMode;
  priceUnit: PriceUnit;
  exchange: string | null;
  taxRate: string;                    // numeric(5,4) STRING, e.g. "0.2600"
  taxHarmonized: boolean | null;
  dividendsFetchedAt: string | null;  // ISO timestamp
  createdByUserId: string | null;     // non-null = manual instrument private to that user
  createdAt: string; updatedAt: string;
}

interface InvestmentPortfolio {       // table `investment_portfolios`
  id: string; userId: string; name: string;      // default name "Portafoglio"
  broker: string | null;              // e.g. "ibkr:<sha256 accountKey>", "degiro:<key>", "trade-republic:<key>"
  statementCashAccountId: string | null;         // uuid of an `accounts` row (broker cash)
  benchmarkInstrumentId: string | null;
  taxRegime: TaxRegime;               // default "amministrato"; statement-created portfolios get "dichiarativo"
  createdAt: string; updatedAt: string;
}

interface InvestmentTransaction {     // table `investment_transactions`
  id: string; userId: string; portfolioId: string; instrumentId: string;
  statementAccountKey: string | null; // non-null = imported from a reconciled broker statement (read-only)
  type: InvestmentTransactionType;
  date: string;                       // "YYYY-MM-DD"
  quantity: string;                   // numeric(24,10) STRING; 0 for dividendo/cedola; split ratio for split
  price: string;                      // numeric(20,8) STRING, instrument currency; 0 for income/split
  fxRate: string;                     // numeric(20,8) STRING, instrument currency -> user currency
  fees: string;                       // numeric(14,2) STRING, USER currency
  taxes: string;                      // numeric(14,2) STRING, USER currency
  grossAmount: string | null;         // numeric(14,2) STRING, instrument currency; dividendo/cedola/rettifica only
  note: string | null;                // encrypted at rest, decrypted
  createdAt: string; updatedAt: string;
}
```

---

## GET /api/investments/overview
Route name: `investments.overview` · Auth: session cookie required · Guards: none (country-independent; DE users still receive e.g. `taxCarryforwards`)

`maxDuration = 60`.

**Query params**

| name | type | required | default | constraints |
|---|---|---|---|---|
| period | string | no | `"3mesi"` | one of `"1mese"`, `"3mesi"`, `"1anno"`, `"max"`; any other value silently falls back to `"3mesi"` |

`period` only controls how far back `prices`, `fxRates` and `riskFreeRates` go: from `max(periodStart, firstTransactionDate) - 10 days` (`PRICE_LOOKBACK_DAYS`); `"max"` = from first transaction - 10 days. Period start = today minus 1/3/12 months (clamped).

**Response** `200` — `InvestmentData` (`lib/investments/data.ts`). No Cache-Control header set.

```ts
interface InvestmentData {
  productCountry: "IT" | "DE";
  currency: string;                       // user currency (authUser.currency, default "EUR")
  brokerCash: BrokerCash[];               // broker cash accounts linked to imports
  personalSources: { id: string; name: string }[];  // user's personal import formats (personal_formats)
  brokerSources: { accountKey: string; provider: string; cashAccountId: string | null }[];
                                          // NOTE: cashAccountId is sent although the TS interface omits it
  portfolios: InvestmentPortfolio[];      // ordered by createdAt asc; portfolios[0] is the "default" one
  instruments: Instrument[];              // instruments held (any transaction) or in targets; NOT the benchmark unless also owned
  transactions: InvestmentTransaction[];  // ALL user operations, ordered by date asc, createdAt asc
  prices: { instrumentId: string; date: string; close: string; source: ProviderId }[];   // close = numeric STRING; includes benchmark
  manualPrices: { instrumentId: string; date: string; close: string }[];                // user-entered/broker closing prices, all dates
  fxRates: { date: string; currency: string; perEur: string }[];  // 1 EUR = perEur units; only non-EUR currencies
  benchmark: Instrument | null;           // portfolios[0].benchmarkInstrumentId resolved
  inflation: { month: string /* "YYYY-MM" */; value: number }[];   // HICP index; [] unless country inflation feature on and currency matches (EUR)
  targets: { instrumentId: string; weight: string /* "0.600000" */ }[];  // of portfolios[0]
  profiles: ExposureProfile[];
  manualBreakdowns: { instrumentId: string; sectors: Record<string, number> | null; areas: Record<string, number> | null }[];
  riskFreeRates: { date: string; rate: number }[];  // €STR fraction/yr, NUMBER; [] unless user currency is EUR
  instrumentSettings: {
    instrumentId: string;
    taxRate: string | null;               // numeric(5,4) STRING
    taxHarmonized: boolean | null;
    couponRate: string | null;            // numeric(8,6) STRING, e.g. "0.035000"
    couponFrequency: 1 | 2 | 4 | null;
    maturityDate: string | null;          // "YYYY-MM-DD"
  }[];
  taxCarryforwards: { id: string; year: number; amount: string /* numeric(14,2) */; note: string | null }[];  // year asc
  dividends: { instrumentId: string; exDate: string; amount: string /* numeric(20,8) per share, instrument ccy */ }[];
  dismissedDividends: { instrumentId: string; date: string }[];
}

interface BrokerCash {
  accountId: string;          // accounts.id
  provider: string;           // "interactive-brokers" | "degiro" | "trade-republic"
  name: string;
  balance: number;            // NUMBER (converted from numeric), already in user currency
  statementDate: string | null;  // latest statement `to` date
}

interface ExposureProfile {   // instrument_profiles (Yahoo quoteSummary), shared
  instrumentId: string;
  symbol: string | null;
  sectors: Record<string, number> | null;     // SECTOR_KEYS -> weight (sum ≈ 1)
  assetMix: { stock: number | null; bond: number | null; cash: number | null; other: number | null } | null;
  holdings: { symbol: string | null; name: string; weight: number }[] | null;  // top holdings, weight 0-1
  sector: string | null;      // stocks only
  country: string | null;     // ISO alpha-2, stocks only
}
```

When the user has no transactions and no targets, the response short-circuits with `instruments`, `prices`, `manualPrices`, `fxRates`, `inflation`, `profiles`, `manualBreakdowns`, `riskFreeRates`, `dividends` all `[]` and `benchmark: null` (portfolios, transactions, targets, carryforwards etc. still populated).

Example (trimmed):
```json
{
  "productCountry": "IT", "currency": "EUR",
  "brokerCash": [{ "accountId": "7c1…", "provider": "interactive-brokers", "name": "Interactive Brokers · liquidità …1234", "balance": 1520.33, "statementDate": "2026-06-30" }],
  "personalSources": [], "brokerSources": [{ "accountKey": "9f2…", "provider": "interactive-brokers", "cashAccountId": "7c1…" }],
  "portfolios": [{ "id": "a1…", "userId": "u1", "name": "Portafoglio", "broker": null, "statementCashAccountId": null, "benchmarkInstrumentId": null, "taxRegime": "amministrato", "createdAt": "2026-01-02T10:00:00.000Z", "updatedAt": "2026-01-02T10:00:00.000Z" }],
  "instruments": [{ "id": "i1…", "isin": "IE00B4L5Y983", "name": "iShares Core MSCI World", "type": "etf", "currency": "EUR", "priceMode": "auto", "priceUnit": "unita", "exchange": "MIL", "taxRate": "0.2600", "taxHarmonized": true, "dividendsFetchedAt": null, "createdByUserId": null, "createdAt": "…", "updatedAt": "…" }],
  "transactions": [{ "id": "t1…", "userId": "u1", "portfolioId": "a1…", "instrumentId": "i1…", "statementAccountKey": null, "type": "acquisto", "date": "2026-02-03", "quantity": "10.0000000000", "price": "95.12000000", "fxRate": "1.00000000", "fees": "2.95", "taxes": "0.00", "grossAmount": null, "note": null, "createdAt": "…", "updatedAt": "…" }],
  "prices": [{ "instrumentId": "i1…", "date": "2026-07-17", "close": "101.23000000", "source": "yahoo" }],
  "manualPrices": [], "fxRates": [], "benchmark": null,
  "inflation": [{ "month": "2026-05", "value": 121.4 }],
  "targets": [], "profiles": [], "manualBreakdowns": [], "riskFreeRates": [{ "date": "2026-07-16", "rate": 0.0192 }],
  "instrumentSettings": [], "taxCarryforwards": [], "dividends": [], "dismissedDividends": []
}
```

**Errors**

| status | body | when |
|---|---|---|
| 401 | empty | no session |
| 500 | `{ error: "Errore interno" }` (withRoute generic) | unexpected failure |

**Side effects**
- `ensureProfilesSafely` / `ensureDividendsSafely`: for instruments lacking a profile / dividend history, acquires Redis keys `market:profile-attempt:<id>` / `market:dividends-attempt:<id>` (NX + TTL) and schedules Yahoo fetches in `after()` (limited per request). Never fails the request.
- No DB writes on the request path.

**Mobile notes**
- This is the only source of portfolio data; the server does **not** compute positions, market values, P&L, TWR/MWR, allocation, taxes, dividend proposals or charts. The web does it client-side with `lib/calc/investments.ts` (`computePositions`, price resolution with precedence manual > provider > last operation price), `lib/calc/fx.ts`, `lib/calc/returns.ts`, `lib/calc/risk.ts`, `lib/investments/view.ts` (`buildInvestmentsView`), `tax-view.ts`, `income-view.ts`, `analysis-view.ts`, `exposure.ts`, `allocation.ts`, `dividends.ts`. Native clients must port that logic or a server-side "computed view" endpoint must be added (see gaps).
- Payload can be large with `period=max` (all daily closes since the first operation for all instruments + FX). Prefer `3mesi` for the home screen and fetch `max` only on demand.
- Parse every numeric STRING with a decimal type (Swift `Decimal`, Kotlin `BigDecimal`). Note the mixed conventions: `brokerCash.balance`, `inflation.value`, `riskFreeRates.rate`, profile weights are NUMBERS.
- Web client refetches overview after any mutation and when backfill polling finishes.
- Web applies a view-only broker filter client-side (`filterInvestmentBrokers`), not a server parameter.

---

## PATCH /api/investments/portfolio
Route name: `investment_portfolio.update` · Auth: session cookie required · Guards: in-handler country check for `taxRegime`

`maxDuration = 300`. Always targets the default portfolio (oldest; created if missing). No `portfolioId` parameter.

**Request body** (`application/json`, `updatePortfolioSchema`)
```ts
interface UpdatePortfolioBody {
  benchmarkInstrumentId?: string | null;  // uuid; null removes the benchmark
  taxRegime?: "amministrato" | "dichiarativo";
}
// refine: at least one of the two must be present, else "Nessun campo da aggiornare"
```

**Response** `200` — the updated `InvestmentPortfolio` row (see shared types).
```json
{ "id": "a1…", "userId": "u1", "name": "Portafoglio", "broker": null, "statementCashAccountId": null, "benchmarkInstrumentId": "b9…", "taxRegime": "dichiarativo", "createdAt": "…", "updatedAt": "2026-10-18T09:12:00.000Z" }
```

**Errors**

| status | body | when |
|---|---|---|
| 400 | `{ error }` | zod failure (first issue) |
| 403 | `{ code: "country_feature_unavailable", error: "Tax settings are not available for Germany" }` | DE user sends `taxRegime` (hardcoded English, not localized) |
| 404 | `{ error: "Strumento non trovato" }` | benchmark not visible to the user |
| 400 | `{ error: "Come confronto serve uno strumento con prezzi automatici" }` | benchmark has `priceMode !== "auto"` |
| 401 | empty | no session |

**Side effects**: updates `investment_portfolios`. If a benchmark is set: `ensureHistorySafely(instrument, firstTransactionDate|today)` (price backfill from date − 7 days, in `after()`) and `ensureFxHistorySafely` for its currency (in `after()`). Re-sending the same benchmark retries a failed backfill. Web tracks `investment_benchmark_set`, `investment_tax_regime_set` client-side.

**Mobile notes**: DE clients must hide the tax-regime control. Poll `/api/instruments/backfill` for the benchmark if you need to show progress.

---

## PUT /api/investments/targets
Route name: `investment_targets.update` · Auth: session cookie required · Guards: none

**Request body** (`updateTargetsSchema`)
```ts
interface UpdateTargetsBody {
  targets: { instrumentId: string /* uuid */; weight: number /* > 0, <= 1 */ }[];  // max 30 ("Al massimo 30 strumenti")
}
// refine: no duplicate instrumentId ("Uno strumento compare due volte")
// refine: if non-empty, |sum(weight) - 1| <= 0.0001 ("I pesi devono sommare a 100%")
// empty array = remove target allocation
```

**Response** `200`
```ts
{ targets: { instrumentId: string; weight: string /* numeric(7,6) STRING, e.g. "0.600000" */ }[] }
```

**Errors**: 400 zod; 404 `{ error: "Strumento non trovato" }` if any instrument is not visible to the user (instruments need not be owned); 401 empty.

**Side effects**: in one DB transaction, deletes all `investment_targets` of the default portfolio and inserts the new set (`weight.toFixed(6)`). Creates the default portfolio if missing.

---

## POST /api/investments/transactions
Route name: `investment_transactions.create` · Auth: session cookie required · Guards: none

`maxDuration = 300`.

**Request body** (`createInvestmentTransactionSchema`)
```ts
interface CreateInvestmentTransactionBody {
  portfolioId?: string;          // uuid; default = default portfolio (created if missing)
  instrumentId: string;          // uuid, must be visible to user
  type: "acquisto" | "vendita" | "dividendo" | "cedola" | "rimborso" | "split" | "rettifica";
  date: string;                  // /^\d{4}-\d{2}-\d{2}$/ ("Data non valida"); not in the future (UTC today)
  quantity?: number;             // >= 0, default 0
  price?: number;                // >= 0, default 0 (instrument currency)
  grossAmount?: number | null;   // >= 0 (instrument currency)
  fxRate?: number;               // > 0; instrument ccy -> user ccy. If omitted the server resolves it
  fees?: number;                 // >= 0, default 0, USER currency
  taxes?: number;                // >= 0, default 0, USER currency
  note?: string | null;          // trimmed, max 500 ("La nota non può superare 500 caratteri"); "" -> null
}
```
Type-dependent rules (superRefine, Italian messages):
- `rettifica` always rejected: "Le operazioni sul capitale si gestiscono dal rendiconto del broker".
- `acquisto` / `vendita` / `rimborso`: `quantity > 0` ("Quantità non valida") and `price > 0` ("Prezzo non valido").
- `split`: `quantity > 0` ("Rapporto dello split non valido").
- `dividendo` / `cedola`: `grossAmount > 0` ("Importo non valido").

Stored normalization (`toRowValues`): `split` stores price "0", fxRate "1", fees/taxes "0.00", grossAmount null; income types store quantity "0", price "0"; non-income types store grossAmount null.

**Response** `201` — created `InvestmentTransaction` row (all numerics as strings).
```json
{ "id": "t9…", "userId": "u1", "portfolioId": "a1…", "instrumentId": "i1…", "statementAccountKey": null, "type": "acquisto", "date": "2026-10-15", "quantity": "5", "price": "101.2", "fxRate": "1", "fees": "2.95", "taxes": "0", "grossAmount": null, "note": null, "createdAt": "…", "updatedAt": "…" }
```
(Exact numeric string formatting of the `returning()` row depends on Postgres numeric output, typically scale-padded, e.g. `"5.0000000000"` — unverified.)

**Errors**

| status | body | when |
|---|---|---|
| 400 | `{ error }` | zod failure |
| 400 | `{ error: "La data non può essere nel futuro" }` | date > today (UTC) |
| 404 | `{ error: "Strumento non trovato" }` | instrument not visible |
| 404 | `{ error: "Portafoglio non trovato" }` | `portfolioId` not owned |
| 409 | `{ error: "Questo portafoglio si aggiorna importando il rendiconto successivo" }` | portfolio is an IBKR statement portfolio (`broker` starts with `ibkr:`) |
| 422 | `{ error: "Cambio non disponibile per questa data: inseriscilo a mano" }` | no `fxRate` sent and FX cannot be resolved (even after fetching ECB/Frankfurter) |
| 400 | `{ error: "Il DD/MM/YYYY risulterebbero vendute più quote di quelle possedute" }` | oversell at some date |
| 401 | empty | no session |

**Side effects**: insert into `investment_transactions`; may fetch FX rates synchronously (`fetchFxAround`); `ensureHistorySafely` schedules price backfill from date − 7 days in `after()`. Web tracks `investment_operation_added`.

---

## PATCH /api/investments/transactions/{id}
Route name: `investment_transactions.update` · Auth: session cookie required · Guards: none

`maxDuration = 300`. Full replacement of the operation (cannot change instrument or portfolio).

**Path params**: `id` uuid. A non-UUID value is passed straight to Postgres (no guard) → likely `500` (unverified).

**Request body** (`updateInvestmentTransactionSchema`): same as create **minus** `portfolioId` and `instrumentId`; same type-dependent rules and defaults. If `fxRate` is omitted, the **stored** fxRate is kept (no re-resolution).

**Response** `200` — the updated `InvestmentTransaction` row.

**Errors**

| status | body | when |
|---|---|---|
| 404 | `{ error: "Operazione non trovata" }` | not found / not owned (checked BEFORE body validation) |
| 409 | `{ error: "Operazione di un rendiconto riconciliato: non modificabile singolarmente" }` | row has `statementAccountKey` or its portfolio broker starts with `ibkr:` |
| 400 | `{ error }` | zod failure |
| 400 | `{ error: "La data non può essere nel futuro" }` | future date |
| 400 | `{ error: "Il DD/MM/YYYY risulterebbero vendute più quote di quelle possedute" }` | oversell |
| 401 | empty | no session |

**Side effects**: update row; `ensureHistorySafely` from new date in `after()`. Web tracks `investment_operation_updated`.

## DELETE /api/investments/transactions/{id}
Route name: `investment_transactions.delete` · Auth: session cookie required · Guards: none

**Response** `204` empty.

**Errors**: 404 `{ error: "Operazione non trovata" }`; 409 (same reconciled-statement message as PATCH); 400 `{ error: "Non si può eliminare: il DD/MM/YYYY risulterebbero vendute più quote di quelle possedute" }` if removal makes a later sale oversell; 401 empty.

**Mobile notes**: disable edit/delete UI when `statementAccountKey != null` or the portfolio `broker` starts with `ibkr:`.

---

## POST /api/investments/dividends/dismissed
Route name: `dividends.dismiss` · Auth: session cookie required · Guards: none

**Request body** (`dismissDividendSchema`)
```ts
interface DismissDividendBody {
  items: { instrumentId: string /* uuid */; date: string /* YYYY-MM-DD, ex-date or coupon date */ }[];  // 1..500
}
```

**Response** `201` — echoes the parsed body: `{ items: [...] }`.

**Errors**: 400 zod (also for invalid/missing JSON); 404 `{ error: "Strumento non trovato" }` if any instrument is not visible; 401 empty.

**Side effects**: insert into `user_dismissed_dividends`, `ON CONFLICT DO NOTHING` (idempotent). Web tracks `investment_dividend_dismissed`.

## DELETE /api/investments/dividends/dismissed
Route name: `dividends.restore` · Auth: session cookie required · Guards: none

**Request body**: same as POST (JSON body on DELETE). Instruments are not checked for visibility.

**Response** `204` empty. **Errors**: 400 zod; 401 empty.

**Mobile notes**: proposals themselves ("dividend to record") are computed client-side from `overview.dividends` + transactions + `dismissedDividends`.

---

## POST /api/investments/tax-carryforwards
Route name: `tax_carryforwards.create` · Auth: session cookie required · Guards: **country gate** (proxy prefix `/api/investments/tax-carryforwards` + `withCountryGuard`)

**Request body** (`createTaxCarryforwardSchema`)
```ts
interface CreateTaxCarryforwardBody {
  year: number;            // int >= 2000; not > current UTC year ("L'anno non può essere futuro")
  amount: number;          // > 0, <= 100_000_000, user currency
  note?: string | null;    // trimmed, max 500, "" -> null
}
```

**Response** `201`
```ts
{ id: string; year: number; amount: string /* "1234.50" */; note: string | null }
```

**Errors**

| status | body | when |
|---|---|---|
| 403 | `{ code: "country_feature_unavailable", error: "<localized 'feature not available for Germany'>" }` | productCountry = DE |
| 400 | `{ error }` | zod failure / future year |
| 401 | empty | no session |

**Side effects**: insert into `investment_tax_carryforwards` (linked to default portfolio, created if missing). Web tracks `tax_carryforward_added`.

## DELETE /api/investments/tax-carryforwards/{id}
Route name: `tax_carryforwards.delete` · Auth: session cookie required · Guards: country gate (as above)

**Path params**: `id` — must match UUID regex, else `404 { error: "Non trovata" }`.

**Response** `204` empty. **Errors**: 403 country (DE); 404 `{ error: "Non trovata" }` (bad id or not owned); 401 empty.

---

## GET /api/investments/titles
Route name: `investments.titles` · Auth: session cookie required · Guards: none

Lists instruments the user watches (`user_watchlist_items`) or currently holds (computed quantity > 0). Sorted held first, then by name (Italian collation).

**Response** `200`
```ts
{
  items: {
    instrument: Instrument;        // full row (see shared types)
    held: boolean;
    watching: boolean;
    lastClose: number | null;      // NUMBER; provider closes only (manual prices ignored)
    lastDate: string | null;       // "YYYY-MM-DD"
    dayChange: number | null;      // fraction vs previous close (0.012 = +1.2%)
    monthChange: number | null;    // fraction vs last close on/before today-30d
    spark: number[];               // closes of the last 35 days, date asc
    activeAlerts: number;          // price alerts status "attivo"
    triggeredAlerts: number;       // status "scattato"
  }[]
}
```
Empty list → `{ "items": [] }`. **Errors**: 401 empty.

---

## GET /api/investments/statements
Route name: `investments.statements` · Auth: session cookie required · Guards: none

Imported broker statements, ordered by period end (`to`) descending. Header `Cache-Control: no-store`. Raw source `records` are NOT returned.

**Response** `200`
```ts
{
  statements: {
    id: string;                 // uuid
    accountKey: string;         // sha256 hex of broker account id
    portfolioId: string;
    createdAt: string;          // ISO
    statement: BrokerStatement; // jsonb, numbers are JSON NUMBERS here
  }[]
}

interface BrokerStatement {
  provider?: "interactive-brokers" | "degiro" | "trade-republic";  // absent on legacy IBKR rows
  valuationAvailable?: boolean;   // false for DEGIRO / Trade Republic
  positionsReported?: boolean;    // false for DEGIRO / Trade Republic
  account: string;                // IBKR account id; "DEGIRO" / "Trade Republic" for those
  currency: string;               // base currency
  from: string; to: string;       // "YYYY-MM-DD"
  nav: { label: string; prior: number; value: number }[];      // IBKR Net Asset Value rows (label "Total", "Cash", "Stock", ...)
  cash: { currency: string; opening: number; closing: number; calculated: number; difference: number }[];
  positions: { symbol: string; currency: string; quantity: number; price: number; value: number; costBasis: number; unrealized: number }[];
  ledger: { line: number; date: string; currency: string; amount: number; kind: string; description: string; includedInCommission?: boolean }[];
  performance: { symbol: string; currency: string | null; values: Record<string, number> }[];  // IBKR "Realized & Unrealized Performance Summary"
  issues: string[];
}
```
**Errors**: 401 empty.

## DELETE /api/investments/statements/{id}
Route name: `investment_import.delete` · Auth: session cookie required · Guards: none

Deletes the selected statement **and every later statement of the same broker account** (`from >= selected.from`), the operations of that source from `selected.from` onwards, and (Trade Republic) the imported cash movements; resets the broker cash account balance to the previous statement's closing cash (converted to user currency at that date).

**Path params**: `id` uuid (validated; invalid → 400).

**Request body**
```ts
{ confirmedIds: string[] }   // uuid[], 1..1000; must equal EXACTLY the set of affected statement ids (selected + later)
```
The client obtains the affected set from `GET /api/investments/statements` (same `accountKey`, `statement.from >= selected.from`).

**Response** `200`
```ts
{ deletedStatements: number; deletedOperations: number; status: 200 }   // `status` field is leaked into the body
```

**Errors** (body includes `status` field as well)

| status | body | when |
|---|---|---|
| 400 | `{ error: "Richiesta non valida" }` | bad id or body (custom message, not zod's) |
| 404 | `{ error: "Importazione non trovata", status: 404 }` | not found / not owned |
| 409 | `{ error: "Le importazioni sono cambiate: aggiorna la pagina e controlla di nuovo l'elenco da eliminare", status: 409 }` | confirmedIds mismatch |
| 422 | `{ error: "Cambio storico non disponibile: nessun dato eliminato", status: 422 }` | FX for previous closing cash unavailable |
| 401 | empty | no session |

**Side effects**: single DB transaction with per-user advisory lock (`pg_advisory_xact_lock(hashtext(userId), 91473)`); upserts `broker_import_accounts` link; deletes `investment_transactions`, `broker_statements`, Trade Republic `transactions` (externalId `trade-republic:%`) from the date; updates `accounts.balance`. Instruments and prices are kept. Web tracks `investments_import_deleted`.

---

## Import flow (CSV / broker statements)

There are **no multipart uploads** in this resource. Files are read on the client as text and sent either as a raw `text/csv` body (parse) or as a JSON string (`statementCsv` in import).

Two paths, chosen client-side by `detectImportProvider(text)` (`lib/investments/import/providers.ts`):

1. **Recognized broker statements — IBKR (English Activity Statement CSV), DEGIRO (Italian `Account.csv`), Trade Republic (`Transaction export.csv`)**
   1. `POST /api/investments/import/parse` with raw CSV → `ActivityStatement` (identities, operations, issues, statement).
   2. `POST /api/investments/import/resolve` with the statement's `identities` → match per key.
   3. `POST /api/investments/import` with `dryRun: true`, `statementCsv: <original text>`, `instruments` (a selection for **every** identity key — excluding instruments is not allowed), `operations` (sent but **ignored**: the server re-parses `statementCsv`), optional `portfolioId` → preview (`rows`, `counts`, `replacement`).
   4. Same call with `dryRun: false` → atomic write.
2. **Generic / Fineco / Yahoo-portfolio CSV**: parsed **entirely client-side** (`lib/investments/import/csv.ts`, `presets.ts`, `mapping.ts`, `normalize.ts`, `fineco.ts`; the column mapping is remembered in browser `localStorage`). Then resolve → import (`dryRun` true, then false) with explicit `operations` and optional `formatMetadata`, without `statementCsv`.
   - Optional AI fallback when a file is unrecognized: web posts the CSV to `POST /api/personal-imports` (`brokerFallback: true`, consent fields) which is a background job — documented in the personal-imports resource.

Import itself is **synchronous** (not a job). Only price-history backfill (per instrument) and, for statements with cash movements, auto-categorization run in `after()`.

## POST /api/investments/import/parse
Route name: `investment_import.parse` · Auth: session cookie required · Guards: none

**Request**: raw body, `Content-Type: text/csv` or `text/plain` (parameters such as `; charset=utf-8` allowed). Must be valid UTF-8 (fatal decoder). Max 5 MB (`IBKR_MAX_FILE_BYTES = 5*1024*1024`) enforced while streaming. A leading BOM is stripped.

Detection order: Trade Republic (exact header set) → DEGIRO (exact Italian header row) → otherwise IBKR (must have `Statement,Data,Title,Activity Statement` and BrokerName Interactive Brokers, else error).

**Response** `200` (`Cache-Control: no-store`) — `ActivityStatement`:
```ts
interface ActivityStatement {
  preset: "interactive-brokers" | "degiro" | "trade-republic";
  statement?: BrokerStatement | null;   // null for compact IBKR files lacking Cash Report + Net Asset Value (cannot be imported fully)
  cashMovements?: {                     // Trade Republic only
    line: number; date: string; currency: string; amount: number;
    externalId: string;                 // "trade-republic:<transaction_id>"
    description: string; rawDescription: string; merchantCategoryCode: string | null;
  }[];
  records: { line: number; section: string; kind: string; headers: string[]; values: string[] }[];  // every source row (can be big)
  identities: ImportIdentity[];
  operations: (ImportOperation & { key: string; line: number; sourceCurrency: string })[];
  issues: { line: number; section: string; severity: "error" | "warning"; message: string }[];   // Italian messages
}

interface ImportIdentity {
  key: string;                // groups rows of the same instrument
  symbol: string | null; isin: string | null; name: string | null; currency: string | null;
  symbolIsYahoo: boolean;
  type?: InstrumentType;
}

interface ImportOperation {
  type: InvestmentTransactionType;
  date: string; quantity: number; price: number; grossAmount: number | null;
  fees: number; taxes: number; note: string | null;
  sourceCurrency?: string;    // all amounts incl. costs in this currency
  costCurrency?: string;      // DEGIRO: costs currency when different
  brokerFxToEur?: number;     // broker execution FX when present
}
```

**Errors** (all with `Cache-Control: no-store`)

| status | body | when |
|---|---|---|
| 415 | `{ error: "Inviare il CSV come text/csv o text/plain" }` | other content type (incl. multipart) |
| 400 | `{ error: "File mancante" }` | no body |
| 413 | `{ error: "File troppo grande (massimo 5 MB)" }` | > 5 MB |
| 400 | `{ error: "Impossibile leggere il file CSV UTF-8" }` | invalid UTF-8 |
| 400 | `{ error: "<parser message>" }` | unrecognized/invalid file (e.g. "Il file non è un Activity Statement CSV di Interactive Brokers in inglese", "Il file supera i limiti di operazioni o strumenti per import") |
| 401 | empty | no session |

**Side effects**: upserts an anonymized format-metadata profile (`import_format_profiles`, engine `"native"`; column names and field names, no values). Failure is swallowed. No financial writes.

**Mobile notes**: Read the picked file as UTF-8 text and POST it raw; do not use multipart. Keep the original text: it must be re-sent as `statementCsv` to `/import`. The web treats `operations.length === 0 && no cashMovements && no error issues` as "nothing to import".

## POST /api/investments/import/resolve
Route name: `investment_import.resolve` · Auth: session cookie required · Guards: none

`maxDuration = 120`. Identities are resolved **sequentially** (one provider search at a time, to avoid Yahoo throttling), so this call can be slow.

**Request body** (`resolveImportSchema`)
```ts
interface ResolveImportBody {
  identities: {               // 1..50 ("Al massimo 50 strumenti per file")
    key: string;              // 1..250 chars
    symbol: string | null;    // trimmed, max 40
    isin: string | null;      // trimmed, max 12 (not checksum-validated here)
    name: string | null;      // trimmed, max 200
    currency: string | null;  // /^[A-Z]{3}$/
    symbolIsYahoo: boolean;
    type?: InstrumentType;
  }[];
}
```

**Response** `200`
```ts
{ results: { key: string; match: ImportMatch }[] }

type ImportMatch =
  | { kind: "known"; instrument: Instrument }                    // already in catalogue (visible to user)
  | { kind: "proposal"; input: CreateInstrumentInput; label: string; detail: string; type: InstrumentType; confidence: "exact" | "guess" }
                                                                 // to be created at import; "guess" = user should review
  | { kind: "none"; reason: "not_found" | "unavailable" };       // user must pick manually; unavailable = provider down

type CreateInstrumentInput =                                     // createInstrumentSchema (discriminated by `source`)
  | { source: "yahoo"; yahooSymbol: string; name: string; type: InstrumentType; isin?: string; taxRate?: "0.26" | "0.125"; taxHarmonized?: boolean | null }
  | { source: "coingecko"; coingeckoId: string; name: string; currency: string }
  | { source: "isin"; isin: string; name: string; type: InstrumentType; currency: string; taxRate?: "0.26" | "0.125"; taxHarmonized?: boolean | null }
  | { source: "manuale"; name: string; type: InstrumentType; currency: string; priceUnit?: PriceUnit; isin?: string; taxRate?: "0.26" | "0.125"; taxHarmonized?: boolean | null };
```
Example:
```json
{ "results": [
  { "key": "[\"VWCE\",\"EUR\"]", "match": { "kind": "proposal", "input": { "source": "yahoo", "yahooSymbol": "VWCE.MI", "name": "Vanguard FTSE All-World", "type": "etf", "isin": "IE00BK5BQT80" }, "label": "Vanguard FTSE All-World", "detail": "VWCE.MI · Milano · quotazione collegata dall'ISIN", "type": "etf", "confidence": "guess" } },
  { "key": "k2", "match": { "kind": "none", "reason": "unavailable" } }
] }
```

**Errors**: 400 zod; 401 empty. Provider failures never fail the request (they become `none/unavailable`).

**Side effects**: none (read-only). External calls: Yahoo search, CoinGecko search, OpenFIGI + Yahoo confirmation by ISIN.

**Mobile notes**: for `none`, let the user search with `GET /api/instruments/search?q=` and send `{ key, instrumentId }`, or build a `create` input.

## POST /api/investments/import
Route name: `investment_import.run` · Auth: session cookie required · Guards: none

`maxDuration = 300`. Synchronous. Not a background job.

**Request body** (`runImportSchema`, `application/json`)
```ts
interface RunImportBody {
  dryRun: boolean;
  portfolioId?: string;                 // uuid; statement imports only (generic imports always go to the default portfolio)
  statementCsv?: string;                // max 5*1024*1024 chars; original broker CSV -> server re-parses and reconciles
  preset?: string | null;               // max 40; analytics only (e.g. "interactive-brokers", "fineco", preset id)
  formatMetadata?: FormatMetadata;      // generic CSV only; stored as anonymized format profile
  instruments: (                        // max 50
    | { key: string; instrumentId: string /* uuid */ }
    | { key: string; create: CreateInstrumentInput }
  )[];
  operations: {                         // max 5000 ("Al massimo 5000 operazioni per import"); ignored when statementCsv is set
    key: string;                        // 1..250, must match an instruments[].key
    line: number;                       // int > 0, source line (echoed in result rows)
    type: InvestmentTransactionType;
    date: string;                       // /^\d{4}-\d{2}-\d{2}$/
    quantity: number;                   // >= 0
    price: number;                      // >= 0
    grossAmount: number | null;         // finite (may be negative only for rettifica)
    sourceCurrency?: string;            // /^[A-Z]{3}$/; if set, ALL amounts incl. fees/taxes are in this currency
    fees: number;                       // >= 0
    taxes: number;                      // >= 0
    note: string | null;                // max 500
  }[];
}
// per-operation rules: rettifica needs grossAmount != null and price == 0; dividendo/cedola need grossAmount > 0;
// other types need quantity > 0; vendita/rimborso/split also need price > 0 (acquisto may have price 0, e.g. staking).
// top-level refine: statementCsv present OR (instruments non-empty AND operations non-empty) -> else "Nessuna operazione da importare"

interface FormatMetadata {
  version: 1;
  institution: { name: string | null; evidence: "document" | "user" | "recognized_format" | "unknown" };  // name null <=> evidence "unknown"
  delimiter: "," | ";" | "\t" | "|" | "unknown";
  columns: { section: string | null; index: number /* 0..1000 */; name: string | null; mapsTo: ParsedField[] }[];  // max 1000
}
```
Extra check: without `statementCsv`, any operation of type `rettifica` → `400 { error: "Le rettifiche richiedono il CSV originale" }`.

**Response** — `ImportResult`
```ts
interface ImportResult {
  rows: { line: number; status: "new" | "duplicate" | "error"; message?: string }[];  // one per operation (+ one "new" per TR cash movement)
  counts: { new: number; duplicate: number; error: number };
  error?: string;               // import-wide failure
  inserted: number;             // operations (+ cash movements) written; 0 for dryRun
  instrumentsCreated: number;   // 0 for dryRun
  replacement?: { statements: number; operations: number; from: string; to: string };  // statement import replacing overlapping periods
}
```
Status codes:
- `200` — `dryRun: true` and no import-wide `error` (rows may contain `error` entries: the preview shows them).
- `201` — real import succeeded (also when everything was duplicate: `inserted: 0`).
- `400` — real import with `counts.error > 0`: **nothing written**, body is still the full `ImportResult` (rows with messages such as "Vende più quote di quelle possedute a quella data", "Data nel futuro", "Cambio non disponibile per questa data", "La valuta dello strumento non coincide con quella del file").
- `422` — `ImportResult` with `error` set (e.g. "Uno degli strumenti scelti non esiste più", `Strumento "X": <reason>`, "Alcune operazioni non hanno uno strumento", and for statements: "Per l'import completo servono Cash Report e Net Asset Value", "Il rendiconto va importato completo: abbina tutti gli strumenti, senza escluderli", "Sovrapposizione parziale: …", "Manca un periodo tra questo rendiconto e il precedente", "Saldo iniziale EUR diverso dalla chiusura precedente: …", "Posizione X:USD: quantità importata …", "Cambio storico non disponibile: nessuna operazione salvata", "Scegli il portafoglio in cui importare DEGIRO", "Trade Republic: carica lo storico completo, …", or the joined parser issues). For statement failures `counts` is `{ new: 0, duplicate: 0, error: 1 }` and `rows` is `[]`. Note: this 422 can occur with `dryRun: true` too.
- `400 { error }` — zod failure (plain error body, no `rows`).
- `401` empty.

Example (dry run):
```json
{ "rows": [{ "line": 2, "status": "new" }, { "line": 3, "status": "duplicate" }, { "line": 4, "status": "error", "message": "Vende più quote di quelle possedute a quella data" }],
  "counts": { "new": 1, "duplicate": 1, "error": 1 }, "inserted": 0, "instrumentsCreated": 0 }
```

Semantics:
- Duplicate detection: an operation identical to a stored one (same instrument, type, date, quantity 8dp, price 6dp, grossAmount 2dp) is `duplicate`, counted with multiplicity → re-importing the same file is idempotent.
- Generic path: instruments with `create` are created **before** the operations (shared catalogue entries persist even if the import then fails). All-or-nothing insert in one DB transaction (batches of 500). FX resolved per operation date (missing rates fetched from ECB/Frankfurter); fees/taxes with `sourceCurrency` are converted to user currency.
- Statement path: server re-parses `statementCsv`; same file (fingerprint) for the same account → all rows `duplicate`, nothing written. Validates period continuity with prior/later statements, cash opening/closing balances, and positions vs the broker's reported positions (IBKR). Overlapping fully-covered periods are replaced atomically. On success writes, in one transaction with a per-user advisory lock: portfolio (created if needed, name e.g. "Interactive Brokers · 1234", `taxRegime: "dichiarativo"`), `investment_transactions` (with `statementAccountKey`), a broker cash account in `accounts` (type "Liquidità broker", balance = statement cash in user currency), Trade Republic cash movements as `transactions` (fallback category, upsert by externalId), `broker_import_accounts`, `broker_statements`, and broker closing prices as `user_instrument_prices` at `statement.to`.

**Side effects (after response)**: `ensureHistory` per instrument (auto-links manual instruments with an ISIN to a verified Yahoo listing — `autoLinkQuotation` — then price backfill in `after()`); for statement imports with inserted rows, `categorizeNewMovementsSafely(userId)` in `after()` (category suggestions + auto-apply for the imported cash movements). Generic imports with `formatMetadata` store an anonymized format profile (engine `"mapping"`). Web tracks `investments_imported` (client-side).

**Mobile notes**
- Always do a dry run first and show `rows`/`counts`/`replacement`; treat `400` and `422` responses that contain a `rows` array as a result (the web does `if (Array.isArray(body.rows)) return body`), not as a transport error.
- Request body can approach 5 MB+ (statementCsv) — ensure the HTTP client allows it.
- After a real import, poll `GET /api/instruments/backfill?ids=<instrumentIds>` until no instrument is `running`, then refetch overview.
- Generic CSV import requires porting the client-side CSV parser/mapping (`lib/investments/import/csv.ts`, `presets.ts`, `mapping.ts`, `normalize.ts`, `fineco.ts`) — there is no server endpoint that parses generic CSVs (except the AI fallback job via `/api/personal-imports`).

## GET /api/investments/import/reset
Route name: `investment_import.reset_preview` · Auth: session cookie required · Guards: none

**Response** `200` (`Cache-Control: no-store`)
```ts
{
  revision: string;            // sha256 hex (64 chars) of the whole investment state; required by DELETE
  operations: number;          // all investment_transactions
  untrackedOperations: number; // operations without statementAccountKey (manual / legacy)
  statements: number;
  prices: number;              // user_instrument_prices
  cashAccounts: number;        // linked broker cash accounts
}
```
**Errors**: 401 empty.

## DELETE /api/investments/import/reset
Route name: `investment_import.reset` · Auth: session cookie required · Guards: none

**Request body**
```ts
{ revision: string /* /^[a-f0-9]{64}$/ */; confirmation: "AZZERA INVESTIMENTI" /* literal */ }
```

**Response** `200`
```ts
{ status: 200; deletedOperations: number; deletedStatements: number; deletedPrices: number; resetCashAccounts: number }
```

**Errors**

| status | body | when |
|---|---|---|
| 400 | `{ error: "Conferma il riepilogo e scrivi AZZERA INVESTIMENTI." }` | invalid body (custom message) |
| 409 | `{ status: 409, error: "I dati sono cambiati. Riapri il riepilogo e conferma di nuovo il ripristino." }` | revision mismatch (state changed since preview) |
| 401 | empty | no session |

**Side effects** (serializable transaction + advisory lock): deletes ALL user `investment_transactions` (manual ones too), Trade Republic cash `transactions` on linked accounts, all `broker_statements`, all `user_instrument_prices`, `net_worth_snapshots` of class `investimenti`; sets linked broker cash account balances to 0 and upserts today's `liquidita` net-worth snapshot; keeps portfolios, accounts and `broker_import_accounts` (backfilled for legacy statements). Web tracks `investments_import_reset`.

**Mobile notes**: the confirmation literal is Italian and fixed regardless of UI language; always fetch a fresh preview right before showing the dialog.

---

## Cross-cutting observations
- Several error bodies leak an extra `status` field (`statements/{id}` DELETE, `import/reset` DELETE) — e.g. `{ error, status: 409 }`; success bodies also contain `status: 200`.
- `PATCH /api/investments/portfolio` returns a country-gate 403 with a **hardcoded English** message ("Tax settings are not available for Germany") instead of the localized one used by `withCountryGuard`; the path is not in the proxy's DE prefix list.
- `import` returns `400`/`422` with a full `ImportResult` body (not `{ error }` only); `parse` returns `415`/`413`.
- Custom non-zod 400 messages: `statements/{id}` ("Richiesta non valida"), `import/reset` ("Conferma il riepilogo e scrivi AZZERA INVESTIMENTI.").
- `Cache-Control: no-store` only on `import/parse`, `import/reset` GET, `statements` GET.
- Mixed numeric serialization inside one payload (overview): DB numerics as strings, computed/derived values (brokerCash.balance, inflation, riskFreeRates, profiles, statement JSONB) as numbers.
- `tax-carryforwards/[id]` returns 404 (not 400) for a malformed id; `transactions/[id]` has no UUID guard (malformed id likely 500, unverified).
