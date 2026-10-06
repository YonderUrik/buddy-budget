import { periodStartKey } from "@/lib/calc/investments";
import { toDateKey } from "@/lib/calc/net-worth";
import { computePortfolioReturns } from "@/lib/calc/returns";

type ReturnInputs = Parameters<typeof computePortfolioReturns>[0];
export interface CostTotals { fees: number; taxes: number; total: number }
export interface CostImpact {
  from: string | null;
  to: string;
  period: CostTotals;
  lifetime: CostTotals;
  grossReturn: number | null;
  netReturn: number | null;
  feeImpact: number | null;
  taxImpact: number | null;
  totalImpact: number | null;
}

/** Recorded transaction charges are already in user currency. Compare identical holdings with charges removed, never deduct them twice. */
export function computeCostImpact(params: ReturnInputs, netReturn: number | null, unpriced: boolean): CostImpact {
  const to = toDateKey(params.today);
  const from = periodStartKey(params.transactions, params.period, params.today);
  const eligible = params.transactions.filter((t) => t.date <= to && t.type !== "split" && t.type !== "rettifica");
  const sum = (rows: typeof eligible): CostTotals => {
    const fees = rows.reduce((total, t) => total + Number(t.fees), 0);
    const taxes = rows.reduce((total, t) => total + Number(t.taxes), 0);
    return { fees, taxes, total: fees + taxes };
  };
  const period = sum(eligible.filter((t) => from !== null && t.date >= from));
  const lifetime = sum(eligible);
  const result: CostImpact = { from, to, period, lifetime, grossReturn: null, netReturn: null, feeImpact: null, taxImpact: null, totalImpact: null };
  if (unpriced || netReturn === null || from === null || from > to) return result;
  const simulate = (removeFees: boolean) => computePortfolioReturns({
    ...params, benchmark: null, inflation: null,
    transactions: params.transactions.map((t) => t.date >= from && t.date <= to
      ? { ...t, fees: removeFees ? "0" : t.fees, taxes: "0" } : t),
  })?.twr ?? null;
  const afterFees = simulate(false);
  const gross = simulate(true);
  if (gross === null || afterFees === null || ![gross, afterFees, netReturn].every(Number.isFinite)) return result;
  return { ...result, grossReturn: gross, netReturn,
    feeImpact: afterFees - gross, taxImpact: netReturn - afterFees, totalImpact: netReturn - gross };
}
