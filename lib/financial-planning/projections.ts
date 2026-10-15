import { wealthAfterYears } from "@/lib/calc/fire";
import type { GermanPlan, PensionPlan } from "./schema";
import { projectGermanAvd } from "./countries/de-avd";
import { germanPensionNet, type PensionPayment } from "./countries/de-pension";
import { DE_2026 } from "./countries/de";

/** Pension assets and future income stay separate; no capitalization of statutory entitlements. */
export function projectGermanPension(plan: PensionPlan, referenceYear = 2026) {
  if (plan.kind === "avd" && plan.avd.enabled) return projectGermanAvd(plan, referenceYear);
  const years = plan.yearsUntilPayment;
  const monthlyRate = (1 + plan.nominalReturn) ** (1 / 12) - 1;
  const months = years * 12;
  const projectedCapital = plan.capital * (1 + monthlyRate) ** months + (Math.abs(monthlyRate) < 1e-12 ? plan.monthlyContribution * months : plan.monthlyContribution * ((1 + monthlyRate) ** months - 1) / monthlyRate);
  const statutory = plan.kind === "statutory";
  const monthlyGross = statutory ? (plan.points + years * plan.annualPoints) * DE_2026.pensionPointValue * plan.accessFactor : plan.paymentMode === "income" ? plan.monthlyGross : 0;
  return { currentCapital: statutory ? 0 : plan.capital, projectedCapital: statutory ? 0 : projectedCapital, monthlyGross,
    paymentYears: null as number | null, grants: 0,
    lumpSum: !statutory && plan.paymentMode === "capital" ? projectedCapital : 0 };
}
/** Retirement bridge in today's euros, with individually timed pension payments and explicit deduction assumptions. */
export function germanRetirement(plan: GermanPlan) {
  const r = plan.retirement;
  const pensions = plan.pensions.map(p => ({ plan: p, result: projectGermanPension(p, plan.tax.year) }));
  // Start with liquid funds only. Restricted pension capital enters at its payment date, never at today's value.
  let atRetirement = wealthAfterYears({ current: r.liquidCapital, annualSaving: r.annualSaving, realReturn: r.realReturn }, r.yearsUntilRetirement);
  const lumpYears = [...new Set(pensions.filter(p => p.result.lumpSum > 0 && p.plan.yearsUntilPayment < r.yearsUntilRetirement).map(p => p.plan.yearsUntilPayment))];
  for (const year of lumpYears) {
    const payments = pensions.map(entry => ({ plan: entry.plan,
      annual: entry.plan.yearsUntilPayment <= year && (entry.result.paymentYears === null || year < entry.plan.yearsUntilPayment + entry.result.paymentYears) ? entry.result.monthlyGross * 12 : 0,
      lumpSum: entry.plan.yearsUntilPayment === year ? entry.result.lumpSum : 0,
      occupationalMonthlyEquivalent: entry.plan.yearsUntilPayment <= year && year < entry.plan.yearsUntilPayment + 10 ? entry.result.lumpSum / 120 : 0 }));
    const grossLump = payments.reduce((sum, p) => sum + p.lumpSum, 0);
    let netLump = grossLump * (1 - r.pensionDeductionRate);
    if (plan.pensionTax.mode === "rules") {
      const withLump = germanPensionNet(payments, plan), withoutLump = germanPensionNet(payments.map(entry => ({ ...entry, lumpSum: 0 })), plan);
      if (withLump.net === null || withoutLump.net === null) return { atRetirement, currentTarget: null, rows: [], depletedAfter: null, issues: [...withLump.issues, ...withoutLump.issues] };
      netLump = withLump.net - withoutLump.net;
    }
    atRetirement += netLump / (1 + r.inflation) ** year * (1 + r.realReturn) ** (r.yearsUntilRetirement - year);
  }
  const rows: { year: number; capital: number; pension: number; withdrawal: number }[] = [];
  const issues = new Set<string>();
  let capital = atRetirement;
  let depletedAfter: number | null = null;
  for (let y = 0; y < 50; y++) {
    const fromToday = r.yearsUntilRetirement + y;
    let pension = 0;
    for (const p of pensions) {
      if (p.plan.yearsUntilPayment <= fromToday && (p.result.paymentYears === null || fromToday < p.plan.yearsUntilPayment + p.result.paymentYears)) pension += p.result.monthlyGross * 12 * (1 - r.pensionDeductionRate) / (1 + r.inflation) ** fromToday;
      if (p.plan.yearsUntilPayment === fromToday) capital += p.result.lumpSum * (1 - r.pensionDeductionRate) / (1 + r.inflation) ** fromToday;
    }
    if (plan.pensionTax.mode === "rules") {
      const payments: PensionPayment[] = pensions.map(p => ({ plan: p.plan,
        annual: p.plan.yearsUntilPayment <= fromToday && (p.result.paymentYears === null || fromToday < p.plan.yearsUntilPayment + p.result.paymentYears) ? p.result.monthlyGross * 12 : 0,
        lumpSum: p.plan.yearsUntilPayment === fromToday ? p.result.lumpSum : 0,
        occupationalMonthlyEquivalent: p.plan.yearsUntilPayment <= fromToday && fromToday < p.plan.yearsUntilPayment + 10 ? p.result.lumpSum / 120 : 0,
      }));
      // Undo the legacy lump-sum addition: net cash now comes from the combined assessment.
      for (const p of pensions) if (p.plan.yearsUntilPayment === fromToday) capital -= p.result.lumpSum * (1 - r.pensionDeductionRate) / (1 + r.inflation) ** fromToday;
      const net = germanPensionNet(payments, plan);
      net.issues.forEach(id => issues.add(id));
      if (net.net === null) return { atRetirement, currentTarget: null, rows: [], depletedAfter: null, issues: [...issues] };
      const lumpGross = payments.reduce((sum, p) => sum + p.lumpSum, 0);
      // Attribute lump-sum cash before spending, without applying tax twice.
      capital += lumpGross / (1 + r.inflation) ** fromToday;
      pension = (net.net - lumpGross) / (1 + r.inflation) ** fromToday;
    }
    const withdrawal = Math.max(0, r.annualSpending - pension) / (1 - r.withdrawalTaxShare);
    // Conservative beginning-of-year withdrawal.
    capital = (capital - withdrawal) * (1 + r.realReturn);
    if (capital < 0 && depletedAfter === null) depletedAfter = y;
    capital = Math.max(0, capital);
    rows.push({ year: y, capital, pension, withdrawal });
  }
  const currentTarget = r.annualSpending / (1 - r.withdrawalTaxShare) / r.withdrawalRate;
  return { atRetirement, currentTarget, rows, depletedAfter, issues: [...issues] };
}
