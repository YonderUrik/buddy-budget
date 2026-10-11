/**
 * Dati già pronti per le card della Fase 3 (rischio, diversificazione, sovrapposizioni, allocazione obiettivo), a
 * partire dagli stessi input della vista principale. La UI li riceve senza fare calcoli.
 */

import type { FxTable } from "@/lib/calc/fx";
import {
  periodStartKey,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PortfolioSummary,
  type PriceIndex,
} from "@/lib/calc/investments";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import {
  MAX_CORRELATION_INSTRUMENTS,
  computeCorrelationMatrix,
  computePortfolioRisk,
  type CorrelationMatrix,
  type PortfolioRisk,
  type RateInput,
} from "@/lib/calc/risk";
import type { Instrument } from "@/lib/db/schema/investments";
import { analyzeAllocation, type AllocationAnalysis, type TargetInput } from "./allocation";
import {
  aggregateExposure,
  resolveInstrumentExposure,
  type ExposureBreakdown,
  type ExposureProfile,
  type InstrumentExposure,
  type ManualBreakdown,
} from "./exposure";
import { computeFundOverlaps, computeStocksInsideFunds, type FundOverlap, type StockInsideFunds } from "./overlap";

/** Strumento posseduto con la sua ripartizione, per l'elenco "da dove vengono i dati". */
export interface ExposureRow {
  instrument: Instrument;
  value: number;
  /** Quota sul valore del portafoglio (0-1). */
  share: number;
  exposure: InstrumentExposure;
  manual: ManualBreakdown | null;
}

export interface InvestmentsAnalysis {
  risk: PortfolioRisk | null;
  sectors: ExposureBreakdown;
  areas: ExposureBreakdown;
  exposureRows: ExposureRow[];
  overlaps: FundOverlap[];
  stocksInFunds: StockInsideFunds[];
  /** Null con meno di due posizioni. */
  correlations: CorrelationMatrix | null;
  targets: TargetInput[];
  /** Null se non c'è un obiettivo. */
  allocation: AllocationAnalysis | null;
}

export interface AnalysisInputs {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  summary: PortfolioSummary;
  instrumentsById: Map<string, Instrument>;
  profiles: ExposureProfile[];
  manualBreakdowns: ManualBreakdown[];
  targets: { instrumentId: string; weight: string }[];
  benchmark: InstrumentInput | null;
  riskFreeRates: RateInput[] | null;
  period: NetWorthPeriod;
  today: Date;
  range?: { from: string; to: string };
}

/** Calcola rischio, esposizione, sovrapposizioni, correlazioni e confronto con l'obiettivo. */
export function buildInvestmentsAnalysis(inputs: AnalysisInputs): InvestmentsAnalysis {
  const { summary, instrumentsById, period, today } = inputs;
  const profileById = new Map(inputs.profiles.map((p) => [p.instrumentId, p]));
  const manualById = new Map(inputs.manualBreakdowns.map((m) => [m.instrumentId, m]));

  const held = summary.rows
    .filter((r) => r.value !== null && r.value > 0)
    .map((r) => ({ row: r, instrument: instrumentsById.get(r.instrument.id) }))
    .filter((x): x is { row: typeof x.row; instrument: Instrument } => x.instrument !== undefined);

  const exposures = new Map<string, InstrumentExposure>();
  const exposureRows: ExposureRow[] = held.map(({ row, instrument }) => {
    const manual = manualById.get(instrument.id) ?? null;
    const exposure = resolveInstrumentExposure(instrument, profileById.get(instrument.id) ?? null, manual);
    exposures.set(instrument.id, exposure);
    return { instrument, value: row.value ?? 0, share: row.weight ?? 0, exposure, manual };
  });
  const positions = exposureRows.map((r) => ({ instrumentId: r.instrument.id, value: r.value }));

  const overlapInputs = exposureRows.map((r) => ({
    instrument: r.instrument,
    value: r.value,
    exposure: r.exposure,
    profile: profileById.get(r.instrument.id) ?? null,
  }));

  const fromKey = periodStartKey(inputs.transactions, period, today);
  const correlationInstruments = held.slice(0, MAX_CORRELATION_INSTRUMENTS).map((h) => h.row.instrument);
  const correlations =
    fromKey !== null && correlationInstruments.length >= 2
      ? computeCorrelationMatrix({ ...inputs, instruments: correlationInstruments, fromKey, toKey: toDateKey(startOfDay(today)) })
      : null;

  const targets = inputs.targets.map((t) => ({ instrumentId: t.instrumentId, weight: Number(t.weight) }));
  return {
    risk: computePortfolioRisk({ ...inputs }),
    sectors: aggregateExposure(positions, exposures, "sectors"),
    areas: aggregateExposure(positions, exposures, "areas"),
    exposureRows,
    overlaps: computeFundOverlaps(overlapInputs),
    stocksInFunds: computeStocksInsideFunds(overlapInputs),
    correlations,
    targets,
    allocation:
      targets.length > 0
        ? analyzeAllocation(
            summary.rows.map((r) => ({ instrumentId: r.instrument.id, value: r.value })),
            targets
          )
        : null,
  };
}
