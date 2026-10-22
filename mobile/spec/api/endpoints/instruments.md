# Instruments

Feature area(s): Investments > add operation (instrument search / create, price prefill), Investments > portfolio (backfill polling, instrument icons), Investments > Title page ("Titolo": chart, stats, position, watchlist, price alerts, fundamentals, ETF composition, LLM commentary, link manual instrument to a quotation), Investments > instrument settings (tax / coupons), Investments > diversification (manual sector/area breakdown), Investments > manual prices.
Source: `app/api/instruments/**/route.ts`

## Ownership model (read first)

- The `instruments` table is **shared across users**. Two kinds of rows:
  - **Global / common** (`createdByUserId: null`): created from Yahoo or CoinGecko search results. Name, type, currency, exchange and verified ISIN come from the data source, never from the client. Every user sees and reuses the same row (and the same price history in `instrument_prices`).
  - **Private** (`createdByUserId: <the user's id>`): `source: "isin"` and `source: "manuale"` instruments. Only the creator can see them.
- "Visible" = `createdByUserId IS NULL OR createdByUserId = me` (`visibleTo()` / `findVisibleInstrument()` in `lib/investments/instruments.ts`). Every `[id]` route returns **404 `{ error: "Strumento non trovato" }`** for an id that is not visible (including another user's private instrument).
- Everything a user personalises on a shared instrument lives in **per-user side tables**, never on the shared row: manual prices (`user_instrument_prices`), tax/coupon settings (`user_instrument_settings`), sector/area overrides (`user_instrument_breakdowns`), watchlist (`user_watchlist_items`), price alerts (`user_price_alerts`).
- Only private instruments can be renamed (`PATCH /api/instruments/{id}`).
- There is **no GET /api/instruments/{id}** and **no list endpoint** here. Instrument detail comes from `GET /api/instruments/{id}/analysis` (`.instrument`); the user's instrument list comes from the investments routes (see `investments.md`).

## Instrument object (`Instrument`)

Raw Drizzle row of `instruments`, returned by `POST /api/instruments`, `PATCH /api/instruments/{id}`, `POST /api/instruments/{id}/quotation`, inside search results (`known[]`) and in `analysis.instrument`.

```ts
interface Instrument {
  id: string;                    // uuid
  isin: string | null;           // 12 chars, uppercase
  name: string;
  type: "etf" | "azione" | "obbligazione" | "fondo" | "crypto" | "etc";
  currency: string;              // ISO 4217, e.g. "EUR", "USD"
  priceMode: "auto" | "manuale"; // auto = prices from provider chain; manuale = only user-entered prices
  priceUnit: "unita" | "percentuale_nominale"; // bonds: value = quantity(nominal) * price / 100
  exchange: string | null;       // Yahoo exchange code, e.g. "MIL"
  taxRate: string;               // numeric(5,4) as STRING, default "0.2600" (legacy per-row default; per-user value is in settings)
  taxHarmonized: boolean | null;
  dividendsFetchedAt: string | null; // ISO-8601
  createdByUserId: string | null;    // null = global/shared; otherwise the owner (always the caller, given visibility rules)
  createdAt: string;             // ISO-8601
  updatedAt: string;             // ISO-8601
}
```

```json
{
  "id": "6f1c2a8e-3b0d-4c55-9a1e-2f7d9b0c1e42",
  "isin": "IE00B4L5Y983",
  "name": "iShares Core MSCI World UCITS ETF USD (Acc)",
  "type": "etf",
  "currency": "EUR",
  "priceMode": "auto",
  "priceUnit": "unita",
  "exchange": "MIL",
  "taxRate": "0.2600",
  "taxHarmonized": null,
  "dividendsFetchedAt": null,
  "createdByUserId": null,
  "createdAt": "2026-10-18T09:12:44.123Z",
  "updatedAt": "2026-10-18T09:12:44.123Z"
}
```

## External data sources (server-side only; the client never talks to them)

| Source | Used for | Notes |
|---|---|---|
| Yahoo Finance (search, `chart`, `quoteSummary`) | search, quote meta (currency/exchange/name/type), price history, fundamentals, statements, ETF profile (holdings/sectors), dividends | Shared session + cooldown in Redis; when Yahoo is cooling down, search returns `[]` silently |
| OpenFIGI | ISIN -> listings (Yahoo symbols) | Search ISIN fallback, quotation candidates, ISIN verification on create |
| CoinGecko (+ local Redis catalog of top ~500) | crypto search & prices | Catalog in Redis 7 days; off-catalog search cached 24 h |
| Borsa Italiana, Stooq, Alpha Vantage, Twelve Data, Kraken | price-history fallback chains | Chains: ETF/EU stocks `yahoo > borsaitaliana > stooq > alphavantage`; USD stocks `yahoo > stooq > twelvedata > alphavantage`; bonds `borsaitaliana > yahoo`; funds `yahoo`; crypto `coingecko > kraken` |
| Logo.dev (`img.logo.dev`) | instrument logos | Needs `LOGODEV_PUBLISHABLE_KEY`; 5 s timeout |
| Ollama (self-hosted LLM, `OLLAMA_BASE_URL`, model `OLLAMA_MODEL` default `llama3.2`) | title commentary | 45 s timeout; optional |

In dev/test `MARKET_DATA_FAKE=1` replaces all providers with fakes.

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| POST | /api/instruments | Create or reuse an instrument; kicks off 30-day price backfill | session | Background backfill in `after()` (no jobId; poll `/api/instruments/backfill`). `?history=deferred` skips it. No demo guard |
| GET | /api/instruments/search | Search known instruments + Yahoo + CoinGecko (+ OpenFIGI ISIN fallback) | session | External calls, Redis-cached |
| GET | /api/instruments/backfill | Price-history backfill status for up to 50 ids | session | Polling endpoint (Redis) |
| PATCH | /api/instruments/{id} | Rename a private instrument | session | 403 for shared instruments |
| GET | /api/instruments/{id}/analysis | Title page payload (chart series, stats, position, alerts, fundamentals, composition…) | session | May start backfill/profile/dividend downloads in `after()`; poll while `backfilling` |
| PUT | /api/instruments/{id}/breakdown | Per-user manual sector/area weights | session | |
| POST | /api/instruments/{id}/commentary | LLM commentary (Ollama) | session | Redis cache 12 h; per-user cooldown 20 s -> 429 |
| GET | /api/instruments/{id}/logo | Logo image bytes (webp/png…) | session | Binary, `Cache-Control: private` |
| POST, DELETE | /api/instruments/{id}/manual-prices | Upsert / delete a per-user manual close | session | |
| GET | /api/instruments/{id}/price | Price on a date (prefill operation form) | session | May start backfill; poll while `loading` |
| GET, POST | /api/instruments/{id}/quotation | List / link Yahoo quotations for a private manual ISIN instrument | session | POST may start backfill |
| PUT | /api/instruments/{id}/settings | Per-user tax + coupon settings | session | Country-gated fields (taxes unavailable for DE -> 403 `country_feature_unavailable`) |
| PUT, DELETE | /api/instruments/{id}/watch | Follow / unfollow (watchlist) | session | PUT may start 380-day backfill |
| POST | /api/instruments/{id}/alerts | Create price alert | session | Only `priceMode: "auto"` |
| DELETE | /api/instruments/{id}/alerts/{alertId} | Delete price alert | session | |

None of these routes call `rejectIfDemoActive` and none use `withCountryGuard`. `/api/instruments` is not in the country-gate prefix list (only the `settings` route has an inline DE check).

---

## POST /api/instruments
Route name: `instruments.create` · Auth: session cookie required · Guards: none · `maxDuration = 300`

**Query params**

| name | type | required | default | constraints |
|---|---|---|---|---|
| history | string | no | — | only value recognised: `deferred` -> do not start the initial 30-day backfill (used when the instrument is about to become a portfolio benchmark, whose PATCH starts the full history) |

**Request body** (`application/json`, zod `createInstrumentSchema`, discriminated union on `source`)

```ts
type CreateInstrumentInput =
  | { // chosen from Yahoo search result (market[] hit)
      source: "yahoo";
      yahooSymbol: string;          // trimmed, 1..40
      name: string;                 // trimmed, 1..200 (fallback only: server uses Yahoo's name)
      type: InstrumentType;         // fallback only: server prefers Yahoo's type
      isin?: string;                // trimmed, uppercased, valid ISIN (format + Luhn check digit); bound only if OpenFIGI confirms the symbol is a listing of it
      taxRate?: "0.26" | "0.125";   // saved to the caller's user_instrument_settings (never on the shared row)
      taxHarmonized?: boolean | null;
    }
  | { // crypto hit
      source: "coingecko";
      coingeckoId: string;          // trimmed, 1..100
      name: string;                 // 1..200
      currency: string;             // /^[A-Z]{3}$/
    }
  | { // "ISIN only" (typically Italian BTP) – auto prices via Borsa Italiana; PRIVATE instrument
      source: "isin";
      isin: string;                 // valid ISIN
      name: string;                 // 1..200
      type: InstrumentType;
      currency: string;             // /^[A-Z]{3}$/
      taxRate?: "0.26" | "0.125";
      taxHarmonized?: boolean | null;
    }
  | { // manual prices; PRIVATE instrument
      source: "manuale";
      name: string;                 // 1..200
      type: InstrumentType;
      currency: string;             // /^[A-Z]{3}$/
      priceUnit?: "unita" | "percentuale_nominale"; // default: bonds -> percentuale_nominale, else unita
      isin?: string;                // valid ISIN
      taxRate?: "0.26" | "0.125";
      taxHarmonized?: boolean | null;
    };
// InstrumentType = "etf" | "azione" | "obbligazione" | "fondo" | "crypto" | "etc"
```

Reuse rules (`createOrReuseInstrument`):
- `yahoo`: reuse a global instrument with the same Yahoo symbol, else a global instrument with the same ISIN; else call Yahoo quote-meta (currency/exchange/name/type) and create a **global** row.
- `coingecko`: reuse global instrument with symbol `"<coingeckoId>:<currency>"`, else create global `type: "crypto"`.
- `isin`: reuse a visible instrument with same ISIN + currency; else create **private** instrument (auto prices). 400 if no provider symbol can be derived for that ISIN/type.
- `manuale`: if `isin` given, reuse visible instrument with same ISIN + currency; else create **private** `priceMode: "manuale"`.
- For `isin` / `manuale` the `taxRate`/`taxHarmonized` are written on the private row; for global instruments they go to the caller's `user_instrument_settings`.

**Response**
- `201` `Instrument` — newly created.
- `200` `Instrument` — existing instrument reused (same shape).

**Errors**

| status | body | when |
|---|---|---|
| 400 | `{ error: "<first zod issue>" }` | invalid body (e.g. `"ISIN non valido"`, `"Valuta non valida"`) |
| 400 | `{ error: "Per questo tipo di strumento cercalo per nome, oppure crealo con prezzi manuali" }` | `source: "isin"` with no derivable provider symbol |
| 422 | `{ error: "Strumento non trovato sulla fonte prezzi" }` | Yahoo has no currency for `yahooSymbol` |
| 502 | `{ error: "Fonte prezzi non raggiungibile, riprova tra poco" }` | Yahoo quote-meta threw |
| 500 | `{ error: "Errore interno" }` | unhandled (withRoute) |

**Side effects**: inserts `instruments` + `instrument_symbols`; possibly upserts `user_instrument_settings`. External: Yahoo quote meta, OpenFIGI (ISIN verification). Unless `history=deferred`: starts a background backfill (`after()`) of the last 30 days (`INITIAL_HISTORY_DAYS`) if prices are missing, only for `priceMode: "auto"`; status stored in Redis `market:backfill:<instrumentId>` (TTL 24 h). A failure to start backfill is logged only (nightly cron catches up).

**Mobile notes**: Latency can be 1–3 s (Yahoo + OpenFIGI). Not idempotent in the strict sense but effectively idempotent thanks to reuse (returns 200 with the existing row). After create, poll `GET /api/instruments/backfill?ids=<id>` to know when prices exist. Web fires analytics client-side, not server-side.

---

## GET /api/instruments/search
Route name: `instruments.search` · Auth: session cookie required

**Query params**

| name | type | required | default | constraints |
|---|---|---|---|---|
| q | string | yes (effectively) | `""` | trimmed; fewer than 2 chars -> empty result, no provider calls |

**Response 200**

```ts
interface InstrumentSearchResult {
  known: Instrument[];              // up to 8; instruments visible to AND linked to the user (own manual, with operations, watchlist, alerts or settings) matching ISIN (exact, uppercased) or name ILIKE
  market: YahooSearchHit[];         // Yahoo search (quotesCount=15); or OpenFIGI->Yahoo verified hits for an ISIN (max 3)
  crypto: CryptoHit[];              // max 5
  isin: string | null;              // uppercased query if it is a valid ISIN (offer "ISIN only" / manual creation)
  marketUnavailable: boolean;       // Yahoo search threw (source down) – show "source not responding", not "no results"
  cryptoUnavailable: boolean;       // CoinGecko threw / rate-limited
}
interface YahooSearchHit {
  symbol: string;                   // Yahoo symbol, pass as yahooSymbol to POST /api/instruments
  name: string;
  exchange: string;                 // e.g. "MIL" (may be "")
  exchangeLabel: string;            // e.g. "Milan"
  type: "etf" | "azione" | "fondo" | "crypto" | "obbligazione";
}
interface CryptoHit { id: string /* coingeckoId */; name: string; symbol: string; }
```

```json
{
  "known": [],
  "market": [{ "symbol": "SWDA.MI", "name": "iShares Core MSCI World UCITS ETF USD (Acc)", "exchange": "MIL", "exchangeLabel": "Milan", "type": "etf" }],
  "crypto": [],
  "isin": null,
  "marketUnavailable": false,
  "cryptoUnavailable": false
}
```

ISIN fallback: when Yahoo answered with 0 hits, `known` is empty and `q` is a valid ISIN, the server asks OpenFIGI for listings and confirms up to 8 symbols on Yahoo sequentially (max 3 kept). Hit `name` = OpenFIGI name or the ISIN; `type` guessed from OpenFIGI security type.

**Errors**: only 401 / 500. Provider failures never fail the request.

**Side effects / caching**: Redis `market:yahoo:search:<lowercased q>` 6 h (successful searches only); crypto catalog `market:crypto:catalog` (7 d) + `market:crypto:search:<q>` 24 h + shared cooldown after a CoinGecko 429. No `Cache-Control` header.

**Mobile notes**: Debounce (web: ≥2 chars, debounced, `staleTime` 60 s). Uncached latency ~0.5–2 s; ISIN fallback can take several seconds (sequential Yahoo confirmations).

---

## GET /api/instruments/backfill
Route name: `instruments.backfill_status` (quiet on success) · Auth: session

**Query params**

| name | type | required | default | constraints |
|---|---|---|---|---|
| ids | string | no | `""` | comma-separated UUIDs; non-UUID entries silently dropped; first 50 kept; ids not visible to the user are dropped |

**Response 200** — array (only instruments that have a state in Redis; others are simply absent):

```ts
type BackfillStateView = {
  instrumentId: string;
  status: "running" | "done" | "failed";
  saved: number;          // prices saved so far
  total: number | null;   // expected total (null until known)
  startedAt: string;      // ISO-8601
  updatedAt: string;      // ISO-8601 (heartbeat)
  interrupted: boolean;   // running but no heartbeat for > 60 s (function died) – treat as finished
}[];
```

```json
[{ "instrumentId": "6f1c2a8e-…", "status": "running", "saved": 120, "total": 260, "startedAt": "2026-10-18T09:12:45.001Z", "updatedAt": "2026-10-18T09:12:51.410Z", "interrupted": false }]
```

Empty/invalid `ids` -> `200 []`.

**Errors**

| status | body | when |
|---|---|---|
| 503 | `{ status: "unavailable" }` | Redis/DB error (note: no `error` key) |

**Mobile notes**: Web polls every 2 s while any state is `running && !interrupted`, then refetches portfolio data. State is per instrument and shared by all users (TTL 24 h).

---

## PATCH /api/instruments/{id}
Route name: `instruments.update` · Auth: session

**Path params**: `id` uuid.

**Request body** (`updateInstrumentSchema`): `{ name: string /* trimmed, 1..200 */ }`. ISIN cannot be changed.

**Response 200** — updated `Instrument`.

**Errors**

| status | body | when |
|---|---|---|
| 404 | `{ error: "Strumento non trovato" }` | not visible |
| 403 | `{ error: "Solo gli strumenti manuali si possono rinominare" }` | shared/global instrument (`createdByUserId !== me`) |
| 400 | `{ error: "<zod msg>" }` | invalid body |

**Side effects**: updates `instruments.name`, `updatedAt`.
**Mobile notes**: Not currently called by the web client (no caller found in `lib/queries`). Applies to `source: "isin"` and `"manuale"` instruments.

---

## GET /api/instruments/{id}/analysis
Route name: `instruments.analysis` · Auth: session · `maxDuration = 300`

**Query params**

| name | type | required | default | constraints |
|---|---|---|---|---|
| period | string | no | `1A` | `"1M" \| "3M" \| "6M" \| "1A" \| "5A" \| "Max"` (Italian: A = anno/year). Chart window: 30, 91, 182, 365, 1826 days, or all history |

**Response 200** (`TitleAnalysis`, `lib/investments/title-view.ts`). All numbers below are JSON **numbers** (converted with `Number()`), except inside `instrument` and `alerts` (raw rows, numeric columns as strings). Fractions: 0.01 = 1 %.

```ts
interface TitleAnalysis {
  instrument: Instrument;
  series: { date: string /* YYYY-MM-DD */; close: number }[]; // chart, ascending, downsampled to ≤ 240 points (first & last kept); user's manual prices override provider closes on the same date; for priceMode "manuale" only manual prices
  stats: TitleStats | null;             // null when no closes
  historyDays: number;                  // number of closes available (0 = none yet)
  backfilling: boolean;                 // history download running -> re-fetch (web polls every 2.5 s)
  position: TitlePosition | null;       // null if user holds none (or no stats)
  watching: boolean;
  alerts: UserPriceAlert[];             // user's alerts on this instrument, oldest first (active + triggered)
  fundamentals: TitleFundamentals | null;
  fundamentalsStatus: "ok" | "unsupported" | "unavailable"; // unsupported: type not azione/etf/fondo or priceMode manuale; unavailable: no Yahoo symbol / Yahoo silent / error
  commentaryAvailable: boolean;         // server has OLLAMA_BASE_URL -> show "generate commentary" button
  stock: StockFundamentals | null;      // only stocks with Yahoo statements
  dividends: DividendFacts | null;      // null if never paid
  annualReturns: { year: number; value: number; partial: boolean }[]; // price return per calendar year; current year partial
  composition: {                        // only etf/fondo with a profile
    holdings: { symbol: string | null; name: string; weight: number /* 0-1 */ }[];
    sectors: Record<SectorKey, number> | null; // 0-1 weights
    shared: { holding: { symbol: string | null; name: string; weight: number }; elsewhere: { id: string; name: string; weight: number | null }[] }[]; // top holdings also present in other instruments the user holds
  } | null;
  insideFunds: { id: string; name: string; weight: number | null }[]; // for a stock: user's funds containing it among top holdings (weight non-null only)
}

interface TitleStats {
  lastClose: number;
  lastDate: string;               // YYYY-MM-DD
  dayChange: number | null;       // vs previous close
  returns: Partial<Record<"1M" | "3M" | "6M" | "1A" | "YTD", number>>; // missing key = history too short
  high52: number | null;
  low52: number | null;
  fromHigh: number | null;        // ≤ 0
  volatility: number | null;      // annualised, last year, needs > 20 observations
  maxDrawdown: number | null;     // ≤ 0, last year
}

interface TitlePosition {         // in instrument currency, no FX, no fees/taxes
  quantity: number;
  averagePrice: number | null;
  value: number;                  // quantity * lastClose (* 0.01 for percentuale_nominale)
  gain: number | null;
  incomeReceived: number;         // gross dividends + coupons recorded
  purchases: { date: string; price: number }[]; // "acquisto" operations, for chart markers
  changeVsAverage: number | null;
}

interface TitleFundamentals {     // Yahoo quoteSummary; every field may be null; fractions where Yahoo gives percents
  marketCap; trailingPE; forwardPE; priceToBook; dividendYield; eps; beta; profitMargin; returnOnEquity;
  revenueGrowth; debtToEquity /* percent as Yahoo gives it: 150 = 1.5x */; expenseRatio /* TER */; totalAssets;
  revenuePerShare; grossMargin; operatingMargin; returnOnAssets; freeCashFlow; totalCash; totalDebt; currentRatio;
  ebitda; enterpriseValue; enterpriseToEbitda; sharesOutstanding; bookValue; pegRatio; payoutRatio;
  holdingsPE; holdingsPB; holdingsPS; fundYield: number | null;
  exDividendDate: string | null;     // YYYY-MM-DD
  financialCurrency: string | null;
  fundCategory: string | null;
}

interface StockFundamentals {
  currency: string;               // reporting currency
  priceComparable: boolean;       // false if reporting currency ≠ quote currency (price multiples omitted)
  latestEnd: string;              // YYYY-MM-DD
  columns: { label: string; end: string; trailing: boolean }[]; // fiscal years (+ TTM)
  valuation: Partial<Record<"pe" | "ps" | "pb" | "pfcf" | "evEbitda" | "earningsYield", Indicator>>;
  perShare: Record<"revenue" | "eps" | "fcf" | "book" | "dividend", (number | null)[]>; // aligned with columns
  company: { revenue: (number | null)[]; netIncome: (number | null)[]; freeCashFlow: (number | null)[] };
  margins: Partial<Record<"gross" | "operating" | "net", Indicator>>;
  growth: { lastYear: number | null; average: number | null; averageYears: number };
  profitability: Partial<Record<"roe" | "roa" | "roic" | "interestCoverage", Indicator>>;
  solidity: Partial<Record<"debtToEquity" | "netDebtToEbitda" | "currentRatio" | "payout", Indicator>>;
}
interface Indicator {
  value: number;
  numerator: { label: string; value: number; unit: "money" | "perShare" | "price" | "shares" };
  denominator: { label: string; value: number; unit: "money" | "perShare" | "price" | "shares" };
  history?: { min: number; max: number; average: number; years: number } | null; // multiples only, ≥ 3 years
}
interface DividendFacts {
  perYear: { year: number; amount: number; partial: boolean }[]; // last ≤ 6 calendar years, per share
  trailing: number;               // per-share dividends with ex-date in last 12 months
  yieldToday: number | null;
  yieldOnCost: number | null;
  growth: number | null;          // CAGR, needs ≥ 2 growth years
  growthYears: number;
  nextExDate: string | null;
}
```

`SectorKey` = `tecnologia, finanza, salute, industria, consumi_ciclici, consumi_difensivi, comunicazioni, energia, materiali, servizi_pubblici, immobiliare, obbligazioni, liquidita, materie_prime, crypto, altro, non_classificato`. Labels (`label` in Indicator/columns) are Italian strings computed server-side (unverified whether localized).

Abridged example:

```json
{
  "instrument": { "id": "6f1c…", "name": "iShares Core MSCI World…", "type": "etf", "currency": "EUR", "priceMode": "auto", "taxRate": "0.2600", "…": "…" },
  "series": [{ "date": "2025-10-20", "close": 98.12 }, { "date": "2026-10-17", "close": 112.4 }],
  "stats": { "lastClose": 112.4, "lastDate": "2026-10-17", "dayChange": 0.0041, "returns": { "1M": 0.012, "1A": 0.145, "YTD": 0.09 }, "high52": 113.1, "low52": 92.3, "fromHigh": -0.0062, "volatility": 0.14, "maxDrawdown": -0.11 },
  "historyDays": 1260,
  "backfilling": false,
  "position": { "quantity": 25, "averagePrice": 90.5, "value": 2810, "gain": 547.5, "incomeReceived": 0, "purchases": [{ "date": "2024-03-01", "price": 90.5 }], "changeVsAverage": 0.242 },
  "watching": false,
  "alerts": [{ "id": "a1…", "userId": "u1", "instrumentId": "6f1c…", "direction": "sopra", "targetPrice": "120.00000000", "status": "attivo", "triggeredAt": null, "triggeredPrice": null, "createdAt": "2026-10-01T08:00:00.000Z" }],
  "fundamentals": { "expenseRatio": 0.002, "totalAssets": 95000000000, "fundCategory": "Global Large-Cap Blend Equity", "trailingPE": null, "…": null },
  "fundamentalsStatus": "ok",
  "commentaryAvailable": false,
  "stock": null,
  "dividends": null,
  "annualReturns": [{ "year": 2025, "value": 0.18, "partial": false }, { "year": 2026, "value": 0.09, "partial": true }],
  "composition": { "holdings": [{ "symbol": "AAPL", "name": "Apple Inc", "weight": 0.048 }], "sectors": { "tecnologia": 0.26 }, "shared": [] },
  "insideFunds": []
}
```

**Errors**

| status | body | when |
|---|---|---|
| 400 | `{ error: "Periodo non valido" }` | bad `period` |
| 404 | `{ error: "Strumento non trovato" }` | not visible |

**Side effects**: for `auto` instruments may start in `after()`: price backfill (from min(chart start, 5 y+15 d for stocks/ETF/funds, else 370 d)); profile download (ETF holdings/sectors, stock sector/country; one attempt/hour per instrument via Redis `market:profile-attempt:<id>`); dividends download (`market:dividends-attempt:<id>`). Synchronous Yahoo calls for fundamentals and statements on Redis miss (`market:fundamentals:v2:<id>`, `market:statements:v1:<id>`: 24 h when data, 1 h when empty).

**Mobile notes**: Heavy endpoint: cold (Redis miss) latency 1–4 s; warm < 500 ms. Poll while `backfilling: true` (web: every 2.5 s). Response is per-user (position, alerts, watchlist) even though instrument/price data is shared. No `Cache-Control`.

---

## PUT /api/instruments/{id}/breakdown
Route name: `instruments.breakdown_update` · Auth: session

**Request body** (`updateBreakdownSchema`) — both keys required (may be `null`):

```ts
{
  sectors: Partial<Record<ManualSectorKey, number>> | null; // each weight >0 and ≤1; ≥1 key; sum ≤ 1.0001
  areas:   Partial<Record<ManualAreaKey, number>>   | null; // same rules
}
// ManualSectorKey: tecnologia | finanza | salute | industria | consumi_ciclici | consumi_difensivi | comunicazioni | energia | materiali | servizi_pubblici | immobiliare | obbligazioni | liquidita | materie_prime | crypto | altro
// ManualAreaKey:   nord_america | europa | italia | giappone | pacifico | emergenti | nessuna
```
`null` in a dimension = back to automatic for that dimension; both `null` deletes the override. Remainder to 100 % is treated as "non_classificato". Error messages: `"Inserisci almeno una percentuale"`, `"Le percentuali superano il 100%"`.

**Response 200**: `{ instrumentId: string; sectors: Record<string, number> | null; areas: Record<string, number> | null }` (weights are JSON numbers).

```json
{ "instrumentId": "6f1c…", "sectors": { "obbligazioni": 1 }, "areas": { "italia": 1 } }
```

**Errors**: 404 `Strumento non trovato`; 400 `{ error }` zod.
**Side effects**: upsert/delete `user_instrument_breakdowns` (per user).

---

## POST /api/instruments/{id}/commentary
Route name: `instruments.commentary` · Auth: session · `maxDuration = 90`

**Request body**: none.

**Response 200**

```ts
| { available: false; text: null }                    // server has no OLLAMA_BASE_URL (normal state – hide feature)
| { available: true; text: string; cached: boolean }  // text ≤ 1500 chars, plain text, language = user's profile language (it/en/de)
| { available: true; text: null }                     // model returned nothing / timed out (45 s) / error
```

```json
{ "available": true, "text": "Nell'ultimo anno lo strumento è salito del 14,5%…", "cached": false }
```

**Errors**

| status | body | when |
|---|---|---|
| 404 | `{ error: "Strumento non trovato" }` | not visible |
| 400 | `{ error: "Non ci sono ancora prezzi per questo titolo" }` | no closes |
| 429 | `{ error: "Attendi qualche secondo prima di chiedere un altro commento" }` | per-user cooldown (20 s) on a cache miss |

**Side effects**: Redis cache `market:commentary:<userId>:<instrumentId>:<lastCloseDate>:<language>` 12 h; cooldown `market:commentary-cooldown:<userId>` 20 s (NX). If Redis down: generates without cache/cooldown. Calls Yahoo fundamentals (cached) and Ollama `/api/generate` (non-streaming). Prompt contains only public instrument data (no user amounts). Web tracks `title_commentary_requested` client-side.

**Mobile notes**: Can take up to ~45 s (local LLM); use a long request timeout and a spinner. Check `analysis.commentaryAvailable` before showing the button. It is a POST but semantically a cached read; safe to retry after 20 s.

---

## GET /api/instruments/{id}/logo
Route name: `instruments.logo` · Auth: session

**Response 200**: raw image bytes (not JSON). Headers: `Content-Type` = the type returned by Logo.dev (requested as `format=webp`, 128 px; normally `image/webp`), `Cache-Control: private, max-age=86400`.

**Response 404**: **empty body**, `Cache-Control: private, max-age=3600`. Returned when: instrument not visible, no logo source (only `azione` with valid ISIN -> logo by ISIN; `etf`/`fondo` -> logo of a recognised fund issuer by domain; crypto/bonds/ETC/other -> never), service disabled (no `LOGODEV_PUBLISHABLE_KEY`), logo missing, service error/cooldown, or image > 100 KB.

**Side effects**: Redis `instrument:logo:<issuer:domain | isin:ISIN>` (hit 30 d, miss 3 d, stored base64), `instrument:logo:cooldown` 5 min after a service error. Metric `recordLogoRequest`.

**Mobile notes**: Requires the session cookie (use an image loader that sends cookies/`Authorization` equivalent). Render local fallback (crypto icon / issuer initials) and swap when the logo loads; treat any non-200 as "no logo". Respect the `max-age` in the image cache. Logos are global per issuer/ISIN, but the endpoint is per-user-authenticated.

---

## POST /api/instruments/{id}/manual-prices
Route name: `instruments.manual_price_upsert` · Auth: session

**Request body** (`manualPriceSchema`): `{ date: string /* YYYY-MM-DD, "Data non valida" */; close: number /* > 0, instrument currency/unit (percent of nominal for bonds) */ }`

**Response 201** (always 201, also on update) — `UserInstrumentPrice` row:

```ts
{ id: string; userId: string; instrumentId: string; date: string; close: string /* numeric(20,8) STRING */; createdAt: string; updatedAt: string }
```
```json
{ "id": "c0…", "userId": "u1", "instrumentId": "6f1c…", "date": "2026-10-17", "close": "101.25000000", "createdAt": "2026-10-18T10:00:00.000Z", "updatedAt": "2026-10-18T10:00:00.000Z" }
```

**Errors**: 404 `Strumento non trovato`; 400 zod; 400 `{ error: "La data non può essere nel futuro" }` (compared to UTC today).
**Side effects**: upsert on `(userId, instrumentId, date)`. Valid for any visible instrument (also `auto`; manual price wins over provider close on the same date for this user only).

## DELETE /api/instruments/{id}/manual-prices
Route name: `instruments.manual_price_delete`

**Query params**: `date` (YYYY-MM-DD, required).

**Response**: `204` empty body.
**Errors**: 400 `{ error: "Data non valida" }`; 404 `{ error: "Prezzo non trovato" }`. (No visibility check; scoped by userId.)
**Mobile notes**: Not called by the current web client (unverified UI path).

---

## GET /api/instruments/{id}/price
Route name: `instruments.price_on_date` (quiet on success) · Auth: session · `maxDuration = 300`

**Query params**: `date` (YYYY-MM-DD, required).

**Response 200**

```ts
{
  price: { date: string; close: number /* NUMBER */; origin: "manuale" | "operazione" | ProviderId } | null;
  loading: boolean;   // true = history download in progress; retry
}
// ProviderId = "yahoo" | "borsaitaliana" | "stooq" | "alphavantage" | "twelvedata" | "coingecko" | "kraken"
```
`price` = close on that date or the latest within 10 days before (weekends/holidays); user's manual price wins over provider. For `priceMode: "manuale"` never loads (`loading: false`).

```json
{ "price": { "date": "2026-10-16", "close": 112.1, "origin": "yahoo" }, "loading": false }
```

**Errors**: 400 `{ error: "Data non valida" }`; 404 `Strumento non trovato`.
**Side effects**: if missing and no backfill running, starts a backfill from `date − 7 days` once per instrument+date per hour (Redis `market:price-on-date:<id>:<date>` NX, 1 h).
**Mobile notes**: Used to prefill the operation form. Poll while `loading: true` (web: every 2 s). `price: null, loading: false` = give up, let the user type a price.

---

## GET /api/instruments/{id}/quotation
Route name: `instruments.quotation_candidates` · Auth: session · `maxDuration = 300`

Only for the caller's **private** `priceMode: "manuale"` instruments with an ISIN. Read-only.

**Response 200**

```ts
| { status: "ok"; candidates: { symbol: string /* Yahoo symbol */; exchange: string | null; currency: string }[] } // ≤ 3, preferred exchange first; currency always equals the instrument currency
| { status: "empty" }        // OpenFIGI doesn't know the ISIN or no listing in the instrument currency
| { status: "unavailable" }  // a source didn't respond – retry later
```

**Errors**: 404 `Strumento non trovato`; 409 `{ error: "Questo strumento non si può collegare a una quotazione" }` (not eligible).
**Mobile notes**: OpenFIGI + up to 8 sequential Yahoo checks: can take several seconds. Web caches 5 min.

## POST /api/instruments/{id}/quotation
Route name: `instruments.quotation_link`

**Request body** (`linkQuotationSchema`): `{ yahooSymbol: string /* trimmed 1..40; must be one of the candidates the server re-computes */ }`

**Response 200**: updated `Instrument` (`priceMode: "auto"`, `exchange` set). Instrument stays private.

**Errors**

| status | body | when |
|---|---|---|
| 404 | `{ error: "Strumento non trovato" }` | not visible |
| 409 | `{ error: "Questo strumento ha già i prezzi automatici o non ha un ISIN" }` | not eligible |
| 400 | `{ error: "<zod msg>" }` | invalid body |
| 502 | `{ error: "Fonte prezzi non raggiungibile, riprova tra poco" }` | OpenFIGI/Yahoo unavailable |
| 422 | `{ error: "Quotazione non valida per questo strumento" }` | symbol not among verified candidates |
| 409 | `{ error: "Lo strumento è già stato collegato" }` | race: already switched to auto |

**Side effects**: saves `instrument_symbols`, sets `priceMode = "auto"`; starts backfill from the user's first operation date − 7 days (background). Manual prices remain stored but provider prices are shown. Web tracks `instrument_quotation_linked` client-side.

---

## PUT /api/instruments/{id}/settings
Route name: `instruments.settings_update` · Auth: session

**Request body** (`updateInstrumentSettingsSchema`) — all keys required, each nullable (`null` = automatic):

```ts
{
  taxRate: "0.26" | "0.125" | null;
  taxHarmonized: boolean | null;
  couponRate: number | null;       // >0, ≤ 0.3 (fraction: 0.035 = 3.5%)
  couponFrequency: 1 | 2 | 4 | null; // integer; "Frequenza non valida"
  maturityDate: string | null;     // YYYY-MM-DD
}
// coupon fields: all three null or all three non-null ("Per le cedole servono tasso, frequenza e scadenza", path couponRate)
```

**Response 200**

```ts
{ instrumentId: string; taxRate: string | null /* e.g. "0.2600" */; taxHarmonized: boolean | null; couponRate: string | null /* numeric(8,6) STRING e.g. "0.035000" */; couponFrequency: 1 | 2 | 4 | null; maturityDate: string | null }
```
When every field is `null` (and taxes enabled) the row is deleted and the all-null object is returned (taxRate etc. as JSON `null`).

**Errors**

| status | body | when |
|---|---|---|
| 404 | `{ error: "Strumento non trovato" }` | not visible |
| 400 | `{ error: "<zod msg>" }` | invalid body |
| 403 | `{ code: "country_feature_unavailable", error: "Tax settings are not available for Germany" }` | product country without taxes (DE) and `taxRate` or `taxHarmonized` non-null (message is hard-coded English) |
| 400 | `{ error: "Le cedole si inseriscono solo per le obbligazioni" }` | `couponRate` non-null and `type !== "obbligazione"` |

**Side effects**: upsert/delete `user_instrument_settings`. For DE users tax fields are never written (and an all-null body does not delete the row, it upserts coupon nulls). Web tracks `instrument_settings_saved` client-side.

---

## PUT /api/instruments/{id}/watch
Route name: `instruments.watch` · Auth: session · `maxDuration = 300`

**Request body**: none. Idempotent.
**Response 200**: `{ instrumentId: string; watching: true }`
**Errors**: 404 `Strumento non trovato`.
**Side effects**: insert `user_watchlist_items` (on conflict do nothing); starts a background backfill of the last 380 days if missing. Web tracks `title_watched` client-side.

## DELETE /api/instruments/{id}/watch
Route name: `instruments.unwatch`

**Response 200**: `{ instrumentId: string; watching: false }` (also when it was not watched; no visibility check). Alerts and operations are untouched.

---

## POST /api/instruments/{id}/alerts
Route name: `instruments.alert_create` · Auth: session

**Request body** (`createPriceAlertSchema`): `{ direction: "sopra" | "sotto"; targetPrice: number /* >0, ≤ 1e12, instrument currency */ }` (`sopra` = close ≥ target, `sotto` = close ≤ target).

**Response 201** — `UserPriceAlert` row:

```ts
{ id: string; userId: string; instrumentId: string; direction: "sopra" | "sotto"; targetPrice: string /* numeric(20,8) STRING */; status: "attivo" | "scattato"; triggeredAt: string | null; triggeredPrice: string | null; createdAt: string }
```
```json
{ "id": "a1…", "userId": "u1", "instrumentId": "6f1c…", "direction": "sopra", "targetPrice": "120.00000000", "status": "attivo", "triggeredAt": null, "triggeredPrice": null, "createdAt": "2026-10-18T10:05:00.000Z" }
```

**Errors**

| status | body | when |
|---|---|---|
| 404 | `{ error: "Strumento non trovato" }` | not visible |
| 400 | `{ error: "Gli avvisi funzionano solo per gli strumenti con prezzi automatici" }` | `priceMode !== "auto"` (checked before body validation) |
| 400 | `{ error: "<zod msg>" }` | invalid body |
| 400 | `{ error: "Al massimo 10 avvisi attivi per titolo" }` | ≥ 10 active alerts for user+instrument |
| 400 | `{ error: "L'ultima chiusura è già oltre questo livello" }` | latest provider close already satisfies the condition |

**Side effects**: insert `user_price_alerts`. Evaluation happens in the nightly cron (`evaluatePriceAlerts`): `attivo -> scattato` + email via Resend (if configured). No push notifications.

## DELETE /api/instruments/{id}/alerts/{alertId}
Route name: `instruments.alert_delete`

**Response 200**: `{ id: string }` (the alertId).
**Errors**: 404 `{ error: "Avviso non trovato" }` when `alertId` is not a UUID or no matching alert for (user, instrument, alertId). Works on active and triggered alerts.

---

## Cross-cutting observations

- **Non-UUID `{id}`**: most `[id]` routes pass `id` straight to a Postgres `uuid` comparison without validation; a malformed id most likely yields `500 { error: "Errore interno" }` instead of 404 (unverified; only `alertId` and backfill `ids` are UUID-validated).
- **Status codes**: `POST /api/instruments` returns 201 (created) vs 200 (reused); manual-price upsert always 201; manual-price delete 204 empty.
- **Odd error shapes**: `GET /backfill` 503 is `{ status: "unavailable" }` (no `error`); settings 403 is `{ code, error }` with an English hard-coded message; logo 404 has empty body.
- **Rate limiting**: only commentary (Redis per-user 20 s cooldown -> 429). Price-on-date retries throttled per instrument+date (1 h) without error.
- **Background work** uses `after()` without `jobId`; progress is via `GET /api/instruments/backfill` (shared per instrument, Redis TTL 24 h) or the `backfilling`/`loading` flags in analysis/price responses. Not via `/api/sync-jobs`.
- **No demo guard** on any instruments write route.
- **Mixed numeric serialization**: raw DB rows (`Instrument`, alerts, manual prices, settings) send numeric columns as strings; computed payloads (`analysis`, `price`, `breakdown`) send JSON numbers.
