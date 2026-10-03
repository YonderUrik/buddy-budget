import { coastNumber, fireNumber, fireNumberAfterTax, yearsToTarget } from "@/lib/calc/fire";
import { computeLiquidation, type LiquidationResult } from "@/lib/calc/liquidation";
import type { AnalyticsAssumptions } from "./assumptions";
import type { AnalyticsBase } from "./base";

/** Orizzonti (anni) mostrati per il coast number: dal pensionamento tradizionale vicino a quello lontano. */
export const COAST_HORIZONS = [10, 15, 20, 25, 30];

/** Da dove viene un numero: scritto dall'utente nelle ipotesi o ricavato dai suoi dati. */
export type FigureSource = "ipotesi" | "dati" | "manca";

/** Cifre di partenza della sezione: le ipotesi dell'utente applicate ai suoi dati. */
export interface AnalyticsPlan {
  spending: number | null;
  spendingSource: FigureSource;
  /** Risparmio annuo (può essere negativo: si spende più di quanto si incassa). */
  savings: number | null;
  savingsSource: FigureSource;
  /** Patrimonio considerato: liquidità + investimenti (+ previdenza se scelto). */
  wealth: number;
  liquidation: LiquidationResult;
  /** Quota del patrimonio che se ne andrebbe in imposte vendendo tutto. */
  taxShare: number;
  fireNumberGross: number | null;
  /** Numero FIRE usato: al lordo delle imposte latenti se l'utente l'ha scelto. */
  target: number | null;
  /** Patrimonio / numero FIRE (può superare 1). */
  progress: number | null;
  yearsToFire: number | null;
  coast: { years: number; number: number }[];
}

/** Applica le ipotesi ai dati. Pura: stessi input, stessi numeri. */
export function resolvePlan(base: AnalyticsBase, a: AnalyticsAssumptions): AnalyticsPlan {
  const dataSpending = base.cashflow.monthsWithData >= 3 && base.cashflow.annualSpending > 0 ? base.cashflow.annualSpending : null;
  const spending = a.annualSpending ?? dataSpending;
  const dataSavings = base.cashflow.monthsWithData >= 3 ? base.cashflow.annualSavings : null;
  const savings = a.annualSavings ?? dataSavings;

  const wealth = base.wealth.liquidity + base.wealth.investments + (a.includePensionFunds ? base.wealth.pension : 0);
  const liquidation = computeLiquidation(base.positions);
  const taxShare = a.includeLatentTax && wealth > 0 ? Math.min(liquidation.latentTax / wealth, 0.99) : 0;

  const gross = spending === null ? null : fireNumber(spending, a.withdrawalRate);
  const target = gross === null ? null : fireNumberAfterTax(gross, taxShare);
  const growth = { current: wealth, annualSaving: savings ?? 0, realReturn: a.expectedReturn };
  return {
    spending,
    spendingSource: a.annualSpending !== null ? "ipotesi" : dataSpending !== null ? "dati" : "manca",
    savings,
    savingsSource: a.annualSavings !== null ? "ipotesi" : dataSavings !== null ? "dati" : "manca",
    wealth,
    liquidation,
    taxShare,
    fireNumberGross: gross,
    target,
    progress: target && target > 0 ? wealth / target : null,
    yearsToFire: target === null ? null : yearsToTarget(growth, target),
    coast: target === null ? [] : COAST_HORIZONS.map((years) => ({ years, number: coastNumber(target, a.expectedReturn, years) })),
  };
}
