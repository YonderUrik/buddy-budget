/**
 * Response contracts of the investments view endpoints (gaps.md G7, G7b, G8). The engine's nested types are large and
 * already pinned by its own tests, so these schemas fix the top-level shape and the fields the apps key on; nested
 * engine objects are loose (extra fields allowed). Money is JSON numbers, dates `YYYY-MM-DD`, shares are 0–1 ratios.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const range = z.object({ from: isoDate, to: isoDate });
const chartPeriod = z.enum(["1mese", "3mesi", "1anno", "max", "ytd", "custom"]);
const calculationPeriod = z.enum(["1mese", "3mesi", "1anno", "max"]);
const instrument = z.looseObject({ id: z.string(), name: z.string(), type: z.string(), currency: z.string() });
const positionRow = z.looseObject({
  instrument,
  quantity: z.number(),
  averagePrice: z.number().nullable(),
  costBasis: z.number(),
  value: z.number().nullable(),
  unrealizedGain: z.number().nullable(),
  unrealizedGainPct: z.number().nullable(),
  weight: z.number().nullable(),
});
const summary = z.looseObject({
  totalValue: z.number(),
  dayChange: z.number().nullable(),
  dayChangePct: z.number().nullable(),
  unrealizedGain: z.number(),
  realizedGain: z.number(),
  income: z.number(),
  totalGain: z.number(),
  totalGainPct: z.number().nullable(),
  investedNet: z.number(),
  costBasis: z.number(),
  unpricedCount: z.number().int(),
  rows: z.array(positionRow),
});
const incomeHistory = z.looseObject({ total: z.number(), trailing: z.number(), yieldOnCost: z.number().nullable(), count: z.number().int(), payments: z.array(z.looseObject({ date: isoDate })) });
const returnValues = z.object({
  fromKey: isoDate,
  baseKey: isoDate,
  toKey: isoDate,
  days: z.number().int(),
  showAnnual: z.boolean(),
  twr: z.number().nullable(),
  twrAnnual: z.number().nullable(),
  moneyWeighted: z.number().nullable(),
  moneyWeightedAnnual: z.number().nullable(),
  real: z.object({ value: z.number(), inflation: z.number(), throughMonth: z.string() }).nullable(),
  benchmarkStatus: z.enum(["none", "missing_prices", "ok"]),
  benchmark: z.object({ twr: z.number(), twrAnnual: z.number().nullable(), simulatedValue: z.number(), portfolioValue: z.number(), moneyWeighted: z.number().nullable(), depleted: z.boolean() }).nullable(),
  timingInsight: z.string().nullable(),
});
const heatmap = z.looseObject({ grouping: z.string(), columns: z.array(z.string()), rows: z.array(z.looseObject({ label: z.string(), cells: z.array(z.looseObject({ key: z.string(), ret: z.number().nullable() }).nullable()) })), scale: z.number() }).nullable();

/** GET /api/investments/view (G7): Portafoglio, Diversificazione, Operazioni. */
export const investmentsViewSchema = z.object({
  currency: z.string(),
  today: isoDate,
  period: chartPeriod,
  calculationPeriod,
  range: range.nullable(),
  brokers: z.array(z.object({ id: z.string(), label: z.string(), operations: z.number().int(), excluded: z.boolean() })),
  brokerCash: z.array(z.object({ accountId: z.string(), provider: z.string(), name: z.string(), balance: z.number(), statementDate: isoDate.nullable() })),
  cashTotal: z.number(),
  hasTransactions: z.boolean(),
  summary,
  series: z.array(z.looseObject({ date: isoDate, label: z.string(), value: z.number() })),
  byType: z.array(z.looseObject({ key: z.string(), value: z.number(), share: z.number() })),
  byCurrency: z.array(z.looseObject({ key: z.string(), value: z.number(), share: z.number() })),
  instruments: z.array(instrument),
  heldInstrumentIds: z.array(z.string()),
  /** Deprecated alias of `heldInstrumentIds`. */
  usedInstrumentIds: z.array(z.string()),
  breakdown: z.object({ paid: z.number(), market: z.number(), value: z.number(), marketShare: z.number(), cashedIn: z.number() }),
  concentration: z.object({ kind: z.enum(["single", "dominant", "spread"]), name: z.string().nullable(), share: z.number() }).nullable(),
  concentrationText: z.string().nullable(),
  priceNotes: z.array(z.looseObject({ instrumentId: z.string(), stale: z.boolean() })),
  currencyExposure: z.number(),
  periodGain: z.looseObject({ fromKey: isoDate, toKey: isoDate, gain: z.number() }).nullable(),
  costImpact: z.object({ fees: z.number(), taxes: z.number(), estimatedTaxes: z.number(), available: z.boolean() }),
  /** The four «Reinvesti costi / imposte» combinations; `series[i]` is the value of `series[i]` above in that scenario. */
  costScenarios: z.array(z.object({ includeFees: z.boolean(), includeTaxes: z.boolean(), active: z.boolean(), value: z.number(), extra: z.number(), series: z.array(z.number()) })).length(4),
  reinvestmentEffects: z.object({ fees: z.number(), taxes: z.number() }),
  income: incomeHistory,
  analysis: z.looseObject({
    risk: z.looseObject({ volatility: z.number().nullable() }).nullable(),
    sectors: z.looseObject({}),
    areas: z.looseObject({}),
    exposureRows: z.array(z.looseObject({ instrument, value: z.number(), share: z.number() })),
    overlaps: z.array(z.looseObject({})),
    stocksInFunds: z.array(z.looseObject({})),
    correlations: z.looseObject({}).nullable(),
    targets: z.array(z.looseObject({ instrumentId: z.string() })),
    allocation: z.looseObject({}).nullable(),
    sectorInsight: z.string().nullable(),
    areaInsight: z.string().nullable(),
    correlationPairs: z.array(z.looseObject({})),
    correlationFamilies: z.looseObject({}).nullable(),
    currentWeights: z.array(z.looseObject({ instrumentId: z.string() })),
  }),
  operationMonths: z.array(z.looseObject({ key: z.string(), label: z.string(), operations: z.array(z.looseObject({})) })),
  operationYears: z.array(z.number().int()),
  operationTotals: z.looseObject({}),
  returns: z.looseObject({ fromKey: isoDate, toKey: isoDate }).nullable(),
  benchmark: instrument.nullable(),
  benchmarkFirstPriceDate: isoDate.nullable(),
});

/** GET /api/investments/performance (G7b). */
export const investmentsPerformanceSchema = z.object({
  currency: z.string(),
  today: isoDate,
  period: chartPeriod,
  calculationPeriod,
  range: range.nullable(),
  selection: range.nullable(),
  hasTransactions: z.boolean(),
  benchmark: instrument.nullable(),
  benchmarkFirstPriceDate: isoDate.nullable(),
  returns: returnValues
    .extend({
      series: z.array(z.object({ date: isoDate, label: z.string(), portfolio: z.number(), benchmark: z.number().nullable() })),
      daily: z.array(z.looseObject({ date: isoDate })),
    })
    .nullable(),
  benchmarkVerdict: z.enum(["better", "worse", "even"]).nullable(),
  /** The figures of the returns card as of a chart point (`index` into `returns.series`), sampled when the series is long. */
  inspect: z.array(returnValues.extend({ index: z.number().int(), date: isoDate })),
  risk: z
    .looseObject({
      volatility: z.number().nullable(),
      sharpe: z.number().nullable(),
      fewData: z.boolean(),
      level: z.number().int().min(1).max(4).nullable(),
      levelLabel: z.string().nullable(),
      scalePosition: z.number().nullable(),
      levelInsight: z.string().nullable(),
      volatilityInsight: z.string().nullable(),
      sharpeLevel: z.string().nullable(),
      sharpeInsight: z.string().nullable(),
      betaInsight: z.string().nullable(),
      recoveryDays: z.number().int().nullable(),
    })
    .nullable(),
  correlationInsight: z.looseObject({}).nullable(),
  heatmaps: z.object({ giorno: heatmap, settimana: heatmap, mese: heatmap, anno: heatmap }),
});

/** GET /api/investments/income (G8, Italy). */
export const investmentsIncomeSchema = z.object({
  currency: z.string(),
  todayKey: isoDate,
  hasTransactions: z.boolean(),
  history: incomeHistory,
  missing: z.array(z.looseObject({ instrumentId: z.string(), kind: z.enum(["dividendo", "cedola"]), date: isoDate, gross: z.number() })),
  forecast: z.looseObject({ months: z.array(z.object({ key: z.string(), gross: z.number(), net: z.number() })), events: z.array(z.looseObject({ instrumentId: z.string(), date: isoDate })), totalGross: z.number(), totalNet: z.number() }),
  byMonth: z.array(z.looseObject({ year: z.number().int(), gross: z.number(), withheld: z.number(), net: z.number() })),
  byInstrument: z.array(z.looseObject({ instrumentId: z.string() })),
  rows: z.array(positionRow),
  instruments: z.array(instrument),
  taxSettings: z.array(z.object({ instrumentId: z.string(), taxRate: z.number(), taxRateSource: z.string(), harmonized: z.boolean(), harmonizedSource: z.string() })),
  dismissed: z.array(z.object({ instrumentId: z.string(), date: isoDate })),
  pendingDividendHistory: z.number().int(),
});

/** GET /api/investments/taxes (G8, Italy). */
export const investmentsTaxesSchema = z.object({
  currency: z.string(),
  todayKey: isoDate,
  currentYear: z.number().int(),
  regime: z.enum(["amministrato", "dichiarativo"]),
  report: z.looseObject({ years: z.array(z.looseObject({ year: z.number().int(), estimatedTax: z.number(), bollo: z.number() })), realized: z.array(z.looseObject({})), losses: z.array(z.looseObject({ year: z.number().int(), remaining: z.number() })) }),
  bollo: z.array(z.object({ year: z.number().int(), value: z.number(), days: z.number().int(), bollo: z.number(), estimate: z.boolean() })),
  opportunities: z.looseObject({ expiringThisYear: z.number(), compensableTotal: z.number(), lossesTotal: z.number() }),
  instruments: z.array(instrument),
  rateListInstrumentIds: z.array(z.string()),
  settings: z.array(z.looseObject({ instrumentId: z.string() })),
  resolved: z.array(z.object({ instrumentId: z.string(), taxRate: z.number(), taxRateSource: z.string(), harmonized: z.boolean(), harmonizedSource: z.string() })),
  sellable: z.array(z.object({ instrument, quantity: z.number(), price: z.number().nullable(), fxRate: z.number().nullable() })),
  carryforwards: z.array(z.object({ id: z.string(), year: z.number().int(), amount: z.string(), note: z.string().nullable() })),
  hasTransactions: z.boolean(),
});

/** POST /api/investments/taxes/simulate-sale request body. */
export const saleSimulationRequestSchema = z.object({
  instrumentId: z.uuid(),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  fxRate: z.number().positive().optional(),
  fees: z.number().min(0).optional(),
});

/** POST /api/investments/taxes/simulate-sale response. */
export const saleSimulationSchema = z.object({
  instrumentId: z.string(),
  todayKey: isoDate,
  regime: z.enum(["amministrato", "dichiarativo"]),
  quantity: z.number(),
  heldQuantity: z.number(),
  price: z.number(),
  fxRate: z.number(),
  proceeds: z.number(),
  cost: z.number(),
  gain: z.number(),
  category: z.enum(["diversi", "capitale", "crypto"]),
  taxDelta: z.number(),
  lossesUsed: z.number(),
  lossesCreated: z.number(),
  net: z.number(),
  nonHarmonized: z.boolean(),
  taxLineLabel: z.string(),
  note: z.string(),
});
