import { wealthAfterYears } from "@/lib/calc/fire";
import type { GermanPlan, PensionPlan } from "./schema";
import { DE_2026 } from "./countries/de";

/** Pension assets and future income stay separate; no capitalization of statutory entitlements. */
export function projectGermanPension(plan: PensionPlan) {
  const years = plan.yearsUntilPayment;
  const monthlyRate = (1 + plan.nominalReturn) ** (1 / 12) - 1;
  const months = years * 12;
  const projectedCapital = plan.capital * (1 + monthlyRate) ** months + (Math.abs(monthlyRate) < 1e-12 ? plan.monthlyContribution * months : plan.monthlyContribution * ((1 + monthlyRate) ** months - 1) / monthlyRate);
  const statutory = plan.kind === "statutory";
  const monthlyGross = statutory ? (plan.points + years * plan.annualPoints) * DE_2026.pensionPointValue * plan.accessFactor : plan.paymentMode === "income" ? plan.monthlyGross : 0;
  return { currentCapital: statutory ? 0 : plan.capital, projectedCapital: statutory ? 0 : projectedCapital, monthlyGross,
    lumpSum: !statutory && plan.paymentMode === "capital" ? projectedCapital : 0 };
}
/** Retirement bridge in today's euros, with individually timed pension payments and explicit deduction assumptions. */
export function germanRetirement(plan: GermanPlan) {
  const r = plan.retirement;
  const pensions = plan.pensions.map(p => ({ plan: p, result: projectGermanPension(p) }));
  // Start with liquid funds only. Restricted pension capital enters at its payment date, never at today's value.
  let atRetirement = wealthAfterYears({ current: r.liquidCapital, annualSaving: r.annualSaving, realReturn: r.realReturn }, r.yearsUntilRetirement);
  for (const p of pensions) {
    if (p.plan.yearsUntilPayment < r.yearsUntilRetirement) {
      const payment = p.result.lumpSum * (1 - r.pensionDeductionRate) / (1 + r.inflation) ** p.plan.yearsUntilPayment;
      atRetirement += payment * (1 + r.realReturn) ** (r.yearsUntilRetirement - p.plan.yearsUntilPayment);
    }
  }
  const rows: { year: number; capital: number; pension: number; withdrawal: number }[] = [];
  let capital = atRetirement;
  let depletedAfter: number | null = null;
  for (let y = 0; y < 50; y++) {
    const fromToday = r.yearsUntilRetirement + y;
    let pension = 0;
    for (const p of pensions) {
      if (p.plan.yearsUntilPayment <= fromToday) pension += p.result.monthlyGross * 12 * (1 - r.pensionDeductionRate) / (1 + r.inflation) ** fromToday;
      if (p.plan.yearsUntilPayment === fromToday) capital += p.result.lumpSum * (1 - r.pensionDeductionRate) / (1 + r.inflation) ** fromToday;
    }
    const withdrawal = Math.max(0, r.annualSpending - pension) / (1 - r.withdrawalTaxShare);
    // Conservative beginning-of-year withdrawal.
    capital = (capital - withdrawal) * (1 + r.realReturn);
    if (capital < 0 && depletedAfter === null) depletedAfter = y;
    capital = Math.max(0, capital);
    rows.push({ year: y, capital, pension, withdrawal });
  }
  const currentTarget = r.annualSpending / (1 - r.withdrawalTaxShare) / r.withdrawalRate;
  return { atRetirement, currentTarget, rows, depletedAfter };
}
