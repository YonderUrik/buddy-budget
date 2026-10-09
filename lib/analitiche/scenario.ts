import { fireNumber, fireNumberAfterTax, yearsToTarget } from "@/lib/calc/fire";
import type { AnalyticsAssumptions } from "./assumptions";
import type { AnalyticsPlan } from "./plan";

/** Le quattro ipotesi che si muovono con i cursori della pagina Analitiche. */
export type ScenarioField = "annualSavings" | "annualSpending" | "expectedReturn" | "withdrawalRate";

/** Valori provati con i cursori («e se…»): non vengono salvati finché l'utente non lo chiede. */
export type ScenarioOverrides = Partial<Record<ScenarioField, number>>;

export const SCENARIO_FIELDS: readonly ScenarioField[] = ["annualSavings", "annualSpending", "expectedReturn", "withdrawalRate"];

/** Estremi e passo di un cursore. */
export interface SliderSpec {
  min: number;
  max: number;
  step: number;
}

/** Passo dei cursori in euro e minimo dell'estremo alto, per non avere cursori microscopici con cifre piccole. */
const MONEY_STEP = 100;
const MONEY_MIN_CEILING = 12_000;
const PERCENT_STEP = 0.001;
const RETURN_RANGE = { min: 0, max: 0.08 };
const WITHDRAWAL_RANGE = { min: 0.02, max: 0.06 };

const roundUp = (v: number, to: number) => Math.ceil(v / to) * to;
const roundDown = (v: number, to: number) => Math.floor(v / to) * to;

/** Cursore di un'ipotesi dato il valore di partenza; null se la cifra manca (spesa o risparmio non noti) e il cursore non ha senso. */
export function scenarioSlider(field: ScenarioField, baseline: number | null): SliderSpec | null {
  switch (field) {
    case "expectedReturn":
      return { ...RETURN_RANGE, step: PERCENT_STEP };
    case "withdrawalRate":
      return { ...WITHDRAWAL_RANGE, step: PERCENT_STEP };
    case "annualSpending":
      return baseline === null ? null : { min: 0, max: roundUp(Math.max(baseline * 2, MONEY_MIN_CEILING), MONEY_STEP * 5), step: MONEY_STEP };
    case "annualSavings":
      return baseline === null
        ? null
        : { min: baseline < 0 ? roundDown(baseline * 2, MONEY_STEP * 5) : 0, max: roundUp(Math.max(Math.abs(baseline) * 2, MONEY_MIN_CEILING), MONEY_STEP * 5), step: MONEY_STEP };
  }
}

/** Ipotesi con i valori dei cursori sopra. */
export function applyScenario(assumptions: AnalyticsAssumptions, overrides: ScenarioOverrides): AnalyticsAssumptions {
  return { ...assumptions, ...overrides };
}

/** Vero se almeno un cursore è stato mosso dal valore di partenza. */
export function hasScenario(overrides: ScenarioOverrides): boolean {
  return SCENARIO_FIELDS.some((f) => overrides[f] !== undefined);
}

/**
 * Anni al traguardo con una o più ipotesi cambiate, a patrimonio e imposte latenti invariati. Serve a mostrare quanto
 * guadagna ogni cursore da solo, senza rifare tutto il piano. Null se non si arriva entro l'orizzonte o manca la spesa.
 */
export function yearsToFireWith(plan: AnalyticsPlan, assumptions: AnalyticsAssumptions, overrides: ScenarioOverrides): number | null {
  const spending = overrides.annualSpending ?? plan.spending;
  if (spending === null) return null;
  const gross = fireNumber(spending, overrides.withdrawalRate ?? assumptions.withdrawalRate);
  const target = gross === null ? null : fireNumberAfterTax(gross, plan.taxShare);
  if (target === null) return null;
  return yearsToTarget(
    { current: plan.wealth, annualSaving: overrides.annualSavings ?? plan.savings ?? 0, realReturn: overrides.expectedReturn ?? assumptions.expectedReturn },
    target
  );
}
