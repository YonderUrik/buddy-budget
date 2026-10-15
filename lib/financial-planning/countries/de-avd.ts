import type { PensionPlan } from "../schema";
import { germanIncomeTax } from "./de";

/** Enacted reform effective 2027; kept separate from the 2026 income-tax benchmark.
 * https://www.bundesregierung.de/breg-de/aktuelles/reform-private-altersvorsorge-2400072
 * https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge
 */
export const DE_AVD_2027 = { effectiveFrom: 2027, minimum: 120, contributionCap: 6840, supportedCap: 1800,
  firstBand: 360, firstRate: .5, secondRate: .25, childCap: 300, indirectCap: 175, starterBonus: 200 } as const;
const round = (n: number) => Math.round(n * 100) / 100;
export function germanAvdAllowance(plan: PensionPlan, contributionYear = 0) {
  const a = plan.avd, r = DE_AVD_2027, contribution = plan.monthlyContribution * 12;
  const eligible = contribution >= r.minimum && a.eligibility !== "none" && (a.eligibility !== "indirect" || a.spouseAnnualContribution >= r.minimum);
  const basis = a.eligibility === "indirect" ? a.spouseAnnualContribution : contribution;
  const basic = eligible ? Math.min(basis, r.firstBand) * r.firstRate + Math.max(0, Math.min(basis, r.supportedCap) - r.firstBand) * r.secondRate : 0;
  const base = a.eligibility === "indirect" ? Math.min(r.indirectCap, basic) : basic;
  const children = eligible ? a.childAllowanceYears.filter(years => years > contributionYear).length * Math.min(basis, r.childCap) : 0;
  const bonus = eligible && a.eligibility === "direct" && a.starterBonus && a.ageAtStart < 25 && contributionYear === 0 ? r.starterBonus : 0;
  const total = round(base + children + bonus);
  const deduction = a.eligibility === "direct" ? Math.min(contribution, r.supportedCap) + total : 0;
  return { base: round(base), children: round(children), bonus, total, deduction };
}
/** Additional refund, not total deduction benefit: grants must not be counted twice.
 * This is explicitly a constant-2026-tariff comparison, NOT a 2027 tax assessment.
 */
export function germanAvdTaxBenefit(plan: PensionPlan, joint: boolean) {
  const grant = germanAvdAllowance(plan);
  const income = plan.avd.taxableIncomeBeforeDeduction;
  const saving = germanIncomeTax(income, joint) - germanIncomeTax(Math.max(0, income - grant.deduction), joint);
  return { ...grant, extraRefund: Math.max(0, saving - grant.total) };
}
/** Contributions monthly in arrears, grants at year end; refunds remain outside the contract. */
export function projectGermanAvd(plan: PensionPlan, referenceYear: number) {
  const a = plan.avd;
  let capital = plan.capital, grants = 0;
  const monthly = (1 + plan.nominalReturn) ** (1 / 12) - 1;
  const delay = Math.max(0, a.contributionStartYear - referenceYear);
  for (let year = 0; year < plan.yearsUntilPayment; year++) {
    const active = year >= delay;
    for (let month = 0; month < 12; month++) capital = capital * (1 + monthly) + (active ? plan.monthlyContribution : 0);
    const grant = active ? germanAvdAllowance(plan, year - delay).total : 0;
    capital += grant; grants += grant;
  }
  const lumpSum = capital * a.lumpSumRate;
  const months = (a.payoutEndAge - a.payoutStartAge) * 12;
  const payoutRate = (1 + a.payoutReturn) ** (1 / 12) - 1;
  const monthlyGross = a.payout === "provider" ? plan.monthlyGross : Math.abs(payoutRate) < 1e-12 ? (capital - lumpSum) / months : (capital - lumpSum) * payoutRate / (1 - (1 + payoutRate) ** -months);
  return { currentCapital: plan.capital, projectedCapital: capital, monthlyGross, lumpSum,
    paymentYears: a.payout === "drawdown" ? months / 12 : null, grants };
}
