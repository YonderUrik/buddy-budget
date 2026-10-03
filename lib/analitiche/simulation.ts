import type { MonteCarloInput } from "@/lib/calc/monte-carlo";
import type { AnalyticsAssumptions } from "./assumptions";
import type { AnalyticsPlan } from "./plan";

/** Quando inizia la pensione nella simulazione: subito, o appena il patrimonio raggiunge il numero FIRE. */
export type RetireAt = "oggi" | "fire";

/** Anni di accumulo massimi simulati prima di considerare il traguardo irraggiungibile. */
const MAX_ACCUMULATION_YEARS = 40;

/** Input della simulazione dalle ipotesi e dalle cifre del piano; null se manca la spesa (niente da simulare). */
export function buildSimulationInput(
  plan: AnalyticsPlan,
  a: AnalyticsAssumptions,
  retireAt: RetireAt,
  rule: MonteCarloInput["rule"] = a.rule
): MonteCarloInput | null {
  if (plan.spending === null || plan.spending <= 0) return null;
  const accumulationYears = retireAt === "fire" && plan.yearsToFire !== null ? Math.min(Math.ceil(plan.yearsToFire), MAX_ACCUMULATION_YEARS) : 0;
  return {
    startingWealth: Math.max(0, plan.wealth),
    annualSavings: Math.max(0, plan.savings ?? 0),
    accumulationYears,
    retirementYears: a.retirementYears,
    annualSpending: plan.spending,
    expectedReturn: a.expectedReturn,
    volatility: a.volatility,
    inflation: a.inflation,
    rule,
    publicPension: a.publicPension ?? undefined,
  };
}
