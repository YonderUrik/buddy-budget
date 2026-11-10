# Investments views (Portafoglio, Performance, Diversificazione, Operazioni, Proventi, Tasse)

Feature area(s): Investimenti tabs ([features/07-investments.md](../../features/07-investments.md))
Source: `app/api/investments/{view,performance,income,taxes,taxes/simulate-sale}/route.ts`, `lib/views/investments.ts`
(`buildInvestmentsViewData`, `buildInvestmentsPerformance`, pure), `lib/views/investments-tax.ts` (`buildInvestmentsIncome`,
`buildInvestmentsTaxes`, `simulateInvestmentSale`, pure), `lib/views/investments-data.server.ts` (loader),
`lib/views/investments-schemas.ts` (zod), `lib/views/investments-query.ts` (shared query params)
Status: implemented on branch `feat/mobile-api-foundations` of `buddy-budget` (gaps.md **G7**, **G7b**, **G8**). Not merged yet.

The server loads the same data as `GET /api/investments/overview?period=max` (JSON round trip, so the engine sees
exactly what the browser sees), applies the view-only broker filter (`filterInvestmentBrokers`) and runs the web's
functions: `buildInvestmentsView`, `computeValueBreakdown`, `computeConcentration`, `computeCurrencyExposure`,
`simulateCostExclusions` / `reinvestmentEffects`, `localizedPositionFormats` (`concentrationText`, `priceNote`),
`sectorInsight` / `areaInsight`, `correlationPairs` / `correlationFamilies`, `roundedCurrentWeights`,
`operationYears` / `sumOperationTotals`, `computePortfolioReturns` (also `asOf` for the inspect points),
`localizedReturnInsights`, `localizedRiskInsights`, `heatmapFromDaily`, `buildIncomeView`, `buildTaxView`,
`simulateSale`. **Port none of the engines.** What stays on the device: chart period navigation, the cost toggles
(pick one of the four precomputed `costScenarios`), the allocation «next contribution» suggestion (`suggestContribution`,
[domain/exposure.md](../../domain/exposure.md)), operations year filter and «show all» (sums are trivial; totals for
all years are served), heatmap grouping switch (all four served), formatting.

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/investments/view` | Portafoglio + Diversificazione + Operazioni | session (Bearer) | `maxDuration` 60 s; not country-gated |
| GET | `/api/investments/performance` | Performance tab (returns, inspect points, risk, heatmaps) | session | `maxDuration` 60 s; not country-gated |
| GET | `/api/investments/income` | Proventi (Italy) | session | **IT only**: DE → 403 `country_feature_unavailable` (DE income is the financial plan, [financial-planning.md](./financial-planning.md)) |
| GET | `/api/investments/taxes` | Tasse (Italy) | session | **IT only** (same 403) |
| POST | `/api/investments/taxes/simulate-sale` | «Prima di vendere» simulation | session | **IT only**; pure computation, no writes; debounce ~300 ms |

### Shared query params

| Name | Type | Default | Notes |
|---|---|---|---|
| period | `1mese` \| `3mesi` \| `1anno` \| `max` \| `ytd` \| `custom` | `3mesi` | the chart period selector. `ytd` / `custom` compute on `max` within explicit bounds (`calculationPeriod` in the response) |
| from, to | `YYYY-MM-DD` | — | bounds for `period=custom` (required then), inclusive, `from ≤ to ≤ today` |
| selFrom, selTo | `YYYY-MM-DD` | — | performance only: a range dragged on the chart; replaces the period's bounds (web «Intervallo selezionato sul grafico») |
| excludeBrokers | comma list of broker ids | none | the broker selector (ids from `brokers[].id`, e.g. `interactive-brokers,manual`); view-only, never changes stored data |
| today | `YYYY-MM-DD` | server's day | device's local day |

Errors (all endpoints): `401` empty; `400 invalid_period` (`field: "period"`), `400 invalid_date` (`field: "today"`),
`400 invalid_date_range` (`field: "from"` or `"selFrom"`: half a pair, a malformed or future day, `from > to`, or
`custom` without bounds).

---

## GET /api/investments/view

Route name: `investments.view`. Fixtures: [investments-view.json](../fixtures/investments-view.json) (`period=3mesi`),
[investments-view-ytd-excluded.json](../fixtures/investments-view-ytd-excluded.json) (`period=ytd&excludeBrokers=manual`).

```ts
interface InvestmentsView {
  currency: string; today: string;
  period: ChartPeriod; calculationPeriod: "1mese" | "3mesi" | "1anno" | "max"; range: { from: string; to: string } | null;
  brokers: { id: string; label: string; operations: number; excluded: boolean }[];   // the broker selector (from all data)
  brokerCash: { accountId: string; provider: string; name: string; balance: number; statementDate: string | null }[];
  cashTotal: number;                                // «Includi liquidità»
  hasTransactions: boolean;                         // false + no cash → empty state
  summary: PortfolioSummary;                        // totalValue, dayChange(Pct), unrealized/realized gain, income, totalGain(Pct),
                                                    // investedNet, costBasis, unpricedCount, rows: PositionRow[] (instrument row embedded)
  series: { date: string; label: string; value: number; invested: number; … }[];  // hero chart, sampled like the web
  byType: CompositionSlice[]; byCurrency: CompositionSlice[];
  instruments: Instrument[]; heldInstrumentIds: string[];   // «I tuoi strumenti»: held today (qty > 0), most recently traded first (web #445)
  usedInstrumentIds: string[];                               // deprecated alias of heldInstrumentIds (same values), kept for older builds
  breakdown: { paid; market; value; marketShare; cashedIn };
  concentration: { kind: "single" | "dominant" | "spread"; name: string | null; share: number } | null;
  concentrationText: string | null;                 // localized line under the positions
  priceNotes: { instrumentId; price; detail; stale: boolean; hint }[];   // per position: last price line, stale flag (> 4 days)
  currencyExposure: number;                         // share in other currencies (web shows it above 5%)
  periodGain: PeriodGain | null;                    // gain in the chosen period (web hides it for max)
  costImpact: { fees; taxes; estimatedTaxes; available };
  costScenarios: {                                  // the 4 combinations of «Reinvesti costi» / «Reinvesti imposte»
    includeFees: boolean; includeTaxes: boolean;    // includeFees=true,includeTaxes=true is the default (toggles off)
    active: boolean; value: number; extra: number;
    series: number[];                               // value of series[i] in this scenario (same length as `series`)
  }[];
  reinvestmentEffects: { fees: number; taxes: number };   // effect of each toggle alone
  income: IncomeHistory;                            // dividends card: trailing, total, count, yieldOnCost, years, topInstruments, payments
  analysis: {                                       // Diversificazione
    risk: PortfolioRisk | null;                     // full reading in /performance
    sectors: ExposureBreakdown; areas: ExposureBreakdown; exposureRows: ExposureRow[];
    overlaps: FundOverlap[]; stocksInFunds: StockInsideFunds[]; correlations: CorrelationMatrix | null;
    targets: TargetInput[]; allocation: AllocationAnalysis | null;
    sectorInsight: string | null; areaInsight: string | null;          // localized
    correlationPairs: CorrelationPair[]; correlationFamilies: CorrelationFamilies | null;
    currentWeights: TargetInput[];                  // starting weights for the target editor when no target exists
  };
  operationMonths: OperationMonthGroup[];           // Operazioni, newest month first, each operation with its result
  operationYears: number[]; operationTotals: OperationTotals;          // year filter and totals for all years
  returns: PortfolioReturns | null;                 // same as on the web (Performance has the display-ready version)
  benchmark: Instrument | null; benchmarkFirstPriceDate: string | null;
}
```

Still separate calls: backfill status of prices (`GET /api/instruments/backfill?ids=`), watched titles
(`GET /api/investments/titles`), statements (`GET /api/investments/statements`, «reconciled» flag on operations).

## GET /api/investments/performance

Route name: `investments.performance`. Fixtures: [investments-performance.json](../fixtures/investments-performance.json)
(`3mesi`), [investments-performance-max.json](../fixtures/investments-performance-max.json) (`max`, monthly series,
sampled inspect points).

```ts
interface InvestmentsPerformance {
  currency; today; period; calculationPeriod; range; selection: { from; to } | null; hasTransactions: boolean;
  benchmark: Instrument | null; benchmarkFirstPriceDate: string | null;
  returns: (ReturnValues & {
    series: { date: string; label: string; portfolio: number; benchmark: number | null }[];  // cumulative TWR line(s), 0.08 = +8%
    daily: DailyReturn[];                                  // per-day returns of the range (heatmap input)
  }) | null;                                               // null: no operation in the range
  benchmarkVerdict: "better" | "worse" | "even" | null;
  inspect: (ReturnValues & { index: number; date: string })[];
  //  the card's figures «as of» a chart point: index into returns.series. One per point up to 160 points; longer
  //  series are sampled evenly (last point always included) — snap the pointer to the nearest inspect entry.
  risk: (PortfolioRisk & {                                 // null without enough data
    level: 1 | 2 | 3 | 4 | null; levelLabel; scalePosition: number | null;   // risk meter
    levelInsight; volatilityInsight; sharpeLevel; sharpeInsight; betaInsight; // localized sentences
    recoveryDays: number | null;                           // trough → recovery of the max drawdown
  }) | null;
  correlationInsight: CorrelationInsight | null;
  heatmaps: Record<"giorno" | "settimana" | "mese" | "anno", ReturnHeatmap | null>;  // all four groupings (web default: mese)
}
interface ReturnValues {
  fromKey; baseKey; toKey; days; showAnnual: boolean;
  twr; twrAnnual; moneyWeighted; moneyWeightedAnnual: number | null;
  real: { value; inflation; throughMonth } | null;          // shown only when capabilities.features.inflation
  benchmarkStatus: "none" | "missing_prices" | "ok";
  benchmark: { twr; twrAnnual; simulatedValue; portfolioValue; moneyWeighted; depleted } | null;
  timingInsight: string | null;                            // localized TWR-vs-MWR line
}
```

Client-side text still built from these fields (catalog strings): the risk card's drawdown line («Dal {0} al {1}…»)
and footnote, the benchmark «wait» message (needs the backfill status call), heatmap summary sentence.

## GET /api/investments/income (IT)

Route name: `investments.income`. Fixture: [investments-income.json](../fixtures/investments-income.json).
`buildIncomeView` with Maps as arrays: `{ currency, todayKey, hasTransactions, history: IncomeHistory, missing:
MissingIncome[] (to record; already without dismissed ones), forecast: { months[12], events, totalGross, totalNet,
bondsWithoutTerms }, byMonth: IncomeYearDetail[], byInstrument: IncomeInstrumentRow[], rows: PositionRow[],
instruments: Instrument[], taxSettings: { instrumentId, taxRate, taxRateSource, harmonized, harmonizedSource }[],
dismissed: { instrumentId, date }[], pendingDividendHistory: number }`. While `pendingDividendHistory > 0` the web
refetches every 4 s (max 6 times). Actions stay on the existing routes (`POST/DELETE /api/investments/dividends/dismissed`,
register operation, `PUT /api/instruments/{id}/settings`).

## GET /api/investments/taxes (IT)

Route name: `investments.taxes`. Fixture: [investments-taxes.json](../fixtures/investments-taxes.json).
`buildTaxView` without the raw inputs of the browser simulator: `{ currency, todayKey, currentYear, regime:
"amministrato" | "dichiarativo", report: { regime, years: TaxYear[] (bollo filled), realized: RealizedGain[], losses:
LossEntry[] }, bollo: BolloYear[], opportunities: TaxOpportunities, instruments, rateListInstrumentIds: string[]
(«Aliquote» list), settings: InstrumentSetting[] (edit dialog), resolved: { instrumentId, taxRate, … }[], sellable: {
instrument, quantity, price | null, fxRate | null }[] (simulator picker: only entries with price and fxRate),
carryforwards: { id, year, amount: string, note }[], hasTransactions }`.

## POST /api/investments/taxes/simulate-sale (IT)

Route name: `investments.taxes_simulate_sale`. Same query params (`excludeBrokers`, `today`). Fixture:
[investments-simulate-sale.json](../fixtures/investments-simulate-sale.json).

Body: `{ instrumentId: uuid; quantity: number > 0; price?: number > 0; fxRate?: number > 0; fees?: number ≥ 0 }`
(defaults as on the web card: last price in the instrument's currency, today's ECB rate, no fees; `quantity` is
clamped to the units held).

```ts
interface SaleSimulation {
  instrumentId; todayKey; regime; quantity /* used */; heldQuantity; price; fxRate;
  proceeds; cost; gain;                          // «Incasso», «Costo fiscale (prezzo medio)», «Plusvalenza/Minusvalenza»
  category: "diversi" | "capitale" | "crypto";
  taxDelta;                                      // tax change this year; negative = saving
  lossesUsed; lossesCreated;                     // «Zaino usato», «Nuovo zaino» (show when > 0)
  net;                                           // «Ti resta» = proceeds − taxDelta
  nonHarmonized: boolean;
  taxLineLabel: string;                          // localized label of the tax line (in meno / trattenute / in dichiarazione)
  note: string;                                  // localized category explanation (+ non-harmonised ETF note)
}
```

| Status | Body | When |
|---|---|---|
| 400 | `{ code: "validation_failed", field }` | bad body |
| 422 | `{ code: "position_not_sellable", field: "instrumentId" }` | not held (after the broker filter), or no price / FX rate |
| 403 | `{ code: "country_feature_unavailable" }` | product country DE |

## Mobile notes

- One call per tab: Portafoglio, Diversificazione and Operazioni can share one `view` response for the same period
  and brokers. Refetch after any operation, price, target, breakdown or settings mutation.
- Payload: ~130–250 KB (gzip ~10×). The engine runs on every call (no server cache yet).
- Germany: Proventi/Tasse are the financial plan sections (`GET /api/financial-planning` with computed results).
