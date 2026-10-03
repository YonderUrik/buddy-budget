import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex } from "@/lib/calc/investments";
import { computeMonthlySeries, type CashflowMonthlyEntry } from "@/lib/calc/cashflow";
import { addMonths, effectiveAmount, endOfMonth, isExpense, parseDateOnly, startOfMonth } from "@/lib/calc/expenses";
import type { CostPosition } from "@/lib/calc/costs";
import type { GrowthSplitPoint } from "@/lib/calc/growth-split";
import type { LiquidationPosition } from "@/lib/calc/liquidation";
import { buildNetWorthSeries, restrictSeriesToClasses, toDateKey } from "@/lib/calc/net-worth";
import { observedPrices } from "@/lib/calc/risk";
import {
  annualizedReturn,
  calmarRatio,
  concentration,
  historicalTailRisk,
  riskContributions,
  sortinoRatio,
  type Concentration,
  type RiskContribution,
  type TailRisk,
} from "@/lib/calc/risk-extras";
import type { Category } from "@/lib/db/schema/categories";
import type { NetWorthSnapshot } from "@/lib/db/schema/net-worth-snapshots";
import type { Transaction } from "@/lib/db/schema/transactions";
import { categoryGroupKey } from "@/lib/categories/groups";
import { toTaxInstruments } from "@/lib/investments/tax-settings";
import type { InvestmentData } from "@/lib/investments/data";
import { buildInvestmentsView, toTransactionInputs } from "@/lib/investments/view";
import { pensionTotalOn } from "@/lib/net-worth/pension-history";
import type { PensionFundData } from "@/lib/pension/types";

/** Mesi di transazioni letti: 12 per la spesa annua più uno per il mese in corso (parziale). */
export const ANALYTICS_HISTORY_MONTHS = 13;
/** Posizioni considerate nel contributo al rischio (le più grandi), per tenere leggero il calcolo. */
export const MAX_RISK_POSITIONS = 8;
/** Giorni in comune minimi tra le serie per calcolare il contributo al rischio. */
const MIN_COMMON_DAYS = 60;
/** Gruppi di spesa che formano la spesa "lean": il necessario e le spese rare ma inevitabili. */
const LEAN_GROUPS = new Set(["dovuta", "saltuaria"]);

export interface AnalyticsBaseInput {
  today: Date;
  currency: string;
  liquidity: number;
  transactions: Transaction[];
  categories: Category[];
  investments: InvestmentData | null | undefined;
  pensionFunds: PensionFundData[];
  debtsTotal: number;
  snapshots: NetWorthSnapshot[];
}

/** Misure di rischio del portafoglio (null senza abbastanza dati). */
export interface AnalyticsRisk {
  observations: number;
  fewData: boolean;
  volatility: number | null;
  maxDrawdown: number | null;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  annualReturn: number | null;
  tail: TailRisk | null;
  concentration: Concentration | null;
}

export interface AnalyticsBase {
  currency: string;
  wealth: { liquidity: number; investments: number; pension: number; debts: number };
  cashflow: {
    /** Mesi interi usati (gli ultimi 12 completi, escluso il corrente). */
    months: CashflowMonthlyEntry[];
    annualIncome: number;
    annualSpending: number;
    annualSavings: number;
    savingsRate: number | null;
    /** Spesa annua "lean" (Dovute + Saltuarie), null se le spese non sono categorizzate abbastanza. */
    leanSpending: number | null;
    /** Mesi interi con dati, per dire quanto è affidabile la media. */
    monthsWithData: number;
  };
  positions: (CostPosition & LiquidationPosition)[];
  growthPoints: GrowthSplitPoint[];
  risk: AnalyticsRisk | null;
  riskContribution: RiskContribution[] | null;
  /** Nomi per id, per etichettare i contributi al rischio. */
  names: Record<string, string>;
}

function fullMonthsRange(today: Date): { from: Date; to: Date } {
  const lastFull = addMonths(today, -1);
  return { from: startOfMonth(addMonths(lastFull, -11)), to: endOfMonth(lastFull) };
}

function leanShare(transactions: Transaction[], categories: Category[], range: { from: Date; to: Date }): number | null {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let total = 0;
  let lean = 0;
  let uncategorized = 0;
  for (const t of transactions) {
    const date = parseDateOnly(t.date);
    if (!isExpense(t) || date < range.from || date > range.to) continue;
    const amount = Math.abs(effectiveAmount(t));
    const category = t.categoryId ? byId.get(t.categoryId) : undefined;
    const group = category ? categoryGroupKey(category) : "daCategorizzare";
    total += amount;
    if (group === "daCategorizzare") uncategorized += amount;
    else if (group && LEAN_GROUPS.has(group)) lean += amount;
  }
  // Se più di un quarto della spesa non è categorizzato, la quota lean non è affidabile.
  return total > 0 && uncategorized / total <= 0.25 ? lean / total : null;
}

function commonReturns(series: Map<string, number>[]): number[][] | null {
  if (series.length === 0) return null;
  let dates = [...series[0].keys()];
  for (const s of series.slice(1)) dates = dates.filter((d) => s.has(d));
  dates.sort();
  if (dates.length < MIN_COMMON_DAYS + 1) return null;
  return series.map((s) => dates.slice(1).map((d, i) => (s.get(d) ?? 0) / (s.get(dates[i]) ?? 1) - 1));
}

/** Mette insieme i dati già caricati dalle altre sezioni nelle cifre di partenza di Analitiche. Nessuna chiamata di rete. */
export function buildAnalyticsBase(input: AnalyticsBaseInput): AnalyticsBase {
  const { today, investments } = input;
  const todayKey = toDateKey(today);
  const range = fullMonthsRange(today);
  const months = computeMonthlySeries(input.transactions, range);
  const monthsWithData = months.filter((m) => m.entrate > 0 || m.uscite > 0).length;
  const annualIncome = months.reduce((s, m) => s + m.entrate, 0);
  const annualSpending = months.reduce((s, m) => s + m.uscite, 0);
  const share = leanShare(input.transactions, input.categories, range);

  let positions: AnalyticsBase["positions"] = [];
  let riskContribution: RiskContribution[] | null = null;
  let risk: AnalyticsRisk | null = null;
  const names: Record<string, string> = {};
  let investmentsValue = 0;
  if (investments && investments.transactions.length > 0) {
    const view = buildInvestmentsView(investments, "max", today);
    investmentsValue = view.summary.totalValue;
    const taxById = new Map(toTaxInstruments(investments.instruments, investments.instrumentSettings).map((i) => [i.id, i]));
    positions = view.summary.rows
      .filter((r) => r.value !== null && r.value > 0)
      .map((r) => {
        const id = r.instrument.id;
        const instrument = view.instrumentsById.get(id);
        names[id] = instrument?.name ?? id;
        return {
          id,
          name: instrument?.name ?? id,
          value: r.value ?? 0,
          ter: null,
          subjectToBollo: instrument?.type !== "crypto",
          unrealizedGain: r.unrealizedGain ?? 0,
          taxRate: taxById.get(id)?.taxRate ?? 0.26,
        };
      });

    const base = view.analysis.risk;
    if (base && base.observations > 0 && base.perYear !== null) {
      const annualReturn = annualizedReturn(base.returns, base.perYear);
      const maxDrawdown = base.drawdown ? -base.drawdown.depth : null;
      risk = {
        observations: base.observations,
        fewData: base.fewData,
        volatility: base.volatility,
        maxDrawdown,
        sharpe: base.sharpe,
        sortino: sortinoRatio(base.returns, base.perYear, base.riskFreeRate ?? 0),
        calmar: calmarRatio(annualReturn, maxDrawdown),
        annualReturn,
        tail: historicalTailRisk(base.returns),
        concentration: concentration(positions.map((p) => p.value)),
      };
    }

    const top = [...positions].sort((a, b) => b.value - a.value).slice(0, MAX_RISK_POSITIONS);
    if (top.length >= 2) {
      const transactions = toTransactionInputs(investments);
      const first = transactions.map((t) => t.date).sort()[0];
      const priceIndex = buildPriceIndex(investments.prices, investments.manualPrices, transactions);
      const fx = buildFxTable(investments.fxRates);
      const series = top.map((p) => {
        const instrument = view.instruments.find((i) => i.id === p.id);
        return instrument ? observedPrices(instrument, priceIndex, fx, investments.currency, first, todayKey) : new Map<string, number>();
      });
      const returns = commonReturns(series);
      if (returns) {
        const totalValue = top.reduce((s, p) => s + p.value, 0);
        riskContribution = riskContributions(top.map((p, i) => ({ id: p.id, weight: p.value / totalValue, returns: returns[i] })));
      }
    }
  }

  // Crescita: patrimonio finanziario (liquidità + investimenti) a fine mese contro il risparmio del mese.
  const todayByClass = { liquidita: input.liquidity, investimenti: investmentsValue };
  const monthly = restrictSeriesToClasses(buildNetWorthSeries(input.snapshots, todayByClass, "1anno", today), ["liquidita", "investimenti"]);
  const savingsByMonth = new Map(
    computeMonthlySeries(input.transactions, { from: startOfMonth(addMonths(today, -(ANALYTICS_HISTORY_MONTHS - 1))), to: endOfMonth(today) }).map((m) => [
      `${m.year}-${String(m.month + 1).padStart(2, "0")}`,
      m.entrate - m.uscite,
    ])
  );
  const growthPoints: GrowthSplitPoint[] = monthly.map((p) => ({
    month: p.date.slice(0, 7),
    netWorth: p.value,
    savings: savingsByMonth.get(p.date.slice(0, 7)) ?? 0,
  }));

  return {
    currency: input.currency,
    wealth: {
      liquidity: input.liquidity,
      investments: investmentsValue,
      pension: pensionTotalOn(input.pensionFunds, todayKey),
      debts: input.debtsTotal,
    },
    cashflow: {
      months,
      annualIncome,
      annualSpending,
      annualSavings: annualIncome - annualSpending,
      savingsRate: annualIncome > 0 ? (annualIncome - annualSpending) / annualIncome : null,
      leanSpending: share === null ? null : annualSpending * share,
      monthsWithData,
    },
    positions,
    growthPoints,
    risk,
    riskContribution,
    names,
  };
}
