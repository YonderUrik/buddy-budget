import type { TaxReport } from "@/lib/calc/taxes";
import { estimatedTaxCharges } from "./tax-report";
import { computeDailyPortfolioValues, periodStartKey, type PortfolioSeriesPoint } from "@/lib/calc/investments";
import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { parseDateOnly } from "@/lib/calc/expenses";
import { computeDailyReturns, toDailyFlows, type computePortfolioReturns } from "@/lib/calc/returns";

type ReturnInputs = Parameters<typeof computePortfolioReturns>[0];
export interface CostImpact {
  fees: number;
  taxes: number;
  estimatedTaxes: number;
  /** Saved charges invested at each day's close and grown at subsequent observed portfolio returns. */
  additions: Record<string, { fees: number; taxes: number; estimatedTaxes: number }>;
  available: boolean;
}

/** Reinvest recorded charges from their payment dates using actual daily portfolio performance, independently of the visible chart window. */
export function computeCostImpact(params: ReturnInputs, unpriced: boolean, report: TaxReport): CostImpact {
  const to = toDateKey(params.today);
  const transactions = params.transactions.filter((t) => t.date <= to);
  let estimatedTaxes = 0;
  const charges = new Map<string, { fees: number; taxes: number; estimatedTaxes: number }>();
  let fees = 0; let taxes = 0;
  for (const t of transactions) {
    if (t.type === "split" || t.type === "rettifica") continue;
    const day = charges.get(t.date) ?? { fees: 0, taxes: 0, estimatedTaxes: 0 };
    day.fees += Number(t.fees); day.taxes += Number(t.taxes);
    fees += Number(t.fees); taxes += Number(t.taxes);
    charges.set(t.date, day);
  }
  for (const estimate of estimatedTaxCharges(report, to)) {
    const day = charges.get(estimate.date) ?? { fees: 0, taxes: 0, estimatedTaxes: 0 };
    day.estimatedTaxes += estimate.amount;
    estimatedTaxes += estimate.amount;
    charges.set(estimate.date, day);
  }
  const result: CostImpact = { fees, taxes: taxes + estimatedTaxes, estimatedTaxes, additions: {}, available: false };
  const first = periodStartKey(transactions, "max", params.today);
  if (!first || unpriced) return result;
  const base = toDateKey(addDays(parseDateOnly(first), -1));
  const points = computeDailyPortfolioValues({ ...params, transactions, fromKey: base, toKey: to });
  const returns = computeDailyReturns(points[0].value, toDailyFlows(points));
  let savedFees = 0; let savedTaxes = 0; let savedEstimatedTaxes = 0;
  for (const day of returns) {
    // Without an invested portfolio there is no observed return: retain the saved amount as cash.
    const growth = 1 + (day.ret ?? 0);
    if (!Number.isFinite(growth) || growth < 0) return result;
    const paid = charges.get(day.date);
    savedFees = savedFees * growth + (paid?.fees ?? 0);
    savedTaxes = savedTaxes * growth + (paid?.taxes ?? 0);
    savedEstimatedTaxes = savedEstimatedTaxes * growth + (paid?.estimatedTaxes ?? 0);
    if (!Number.isFinite(savedEstimatedTaxes) || !Number.isFinite(savedFees) || !Number.isFinite(savedTaxes)) return result;
    result.additions[day.date] = { fees: savedFees, taxes: savedTaxes, estimatedTaxes: savedEstimatedTaxes };
  }
  result.available = true;
  return result;
}

/** Apply independent cost/tax switches to the same observed series without mutating actual balances. */
export function simulateCostExclusions(impact: CostImpact | undefined, series: PortfolioSeriesPoint[], value: number, includeFees: boolean, includeTaxes: boolean) {
  const active = !!impact?.available && (!includeFees || !includeTaxes);
  if (!active) return { active: false, series, value, extra: 0 };
  const addition = (day?: { fees: number; taxes: number; estimatedTaxes: number }) => (includeFees ? 0 : day?.fees ?? 0) + (includeTaxes ? 0 : (day?.taxes ?? 0) + (day?.estimatedTaxes ?? 0));
  const extra = addition(Object.values(impact.additions).at(-1));
  return { active: true, value: value + extra, extra,
    series: series.map((point) => ({ ...point, value: point.value + addition(impact.additions[point.date]) })) };
}
