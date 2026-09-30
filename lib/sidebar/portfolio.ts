/**
 * Riepilogo del portafoglio per la sidebar: totale, variazione del giorno, guadagno e posizioni. Puro: riceve i dati
 * già letti e riusa il calcolo della pagina Investimenti, così i numeri coincidono con quelli delle schede.
 */

import { buildFxTable, type FxRateInput } from "@/lib/calc/fx";
import {
  buildPriceIndex,
  computePortfolioSummary,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type ManualPriceInput,
  type PriceInput,
} from "@/lib/calc/investments";
import type { SidebarHolding, SidebarPortfolio } from "./types";

/** Segnali per strumento già calcolati altrove (elenco titoli): variazione, linea, avvisi, sigla. */
export interface HoldingSignal {
  label: string;
  dayChangePct: number | null;
  spark: number[];
  triggeredAlerts: number;
}

export interface BuildSidebarPortfolioInput {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  prices: PriceInput[];
  manualPrices: ManualPriceInput[];
  fxRates: FxRateInput[];
  userCurrency: string;
  todayKey: string;
  signals: Map<string, HoldingSignal>;
}

/** Portafoglio della sidebar, o null se non ci sono posizioni aperte. */
export function buildSidebarPortfolio(input: BuildSidebarPortfolioInput): SidebarPortfolio | null {
  const summary = computePortfolioSummary({
    transactions: input.transactions,
    instruments: input.instruments,
    priceIndex: buildPriceIndex(input.prices, input.manualPrices, input.transactions),
    fx: buildFxTable(input.fxRates),
    userCurrency: input.userCurrency,
    todayKey: input.todayKey,
  });
  if (summary.rows.length === 0) return null;
  const holdings: SidebarHolding[] = summary.rows.map((row) => {
    const signal = input.signals.get(row.instrument.id);
    return {
      instrumentId: row.instrument.id,
      label: signal?.label ?? row.instrument.name,
      name: row.instrument.name,
      value: row.value,
      dayChangePct: signal?.dayChangePct ?? null,
      spark: signal?.spark ?? [],
      triggeredAlerts: signal?.triggeredAlerts ?? 0,
    };
  });
  return {
    totalValue: summary.totalValue,
    dayChange: summary.dayChange,
    dayChangePct: summary.dayChangePct,
    totalGain: summary.totalGain,
    totalGainPct: summary.totalGainPct,
    holdings,
  };
}
