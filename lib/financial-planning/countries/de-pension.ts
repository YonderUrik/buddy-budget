import type { GermanPlan, PensionPlan } from "../schema";
import { germanIncomeTax } from "./de";

/** 2026 social-insurance parameters, not automatically rolled forward.
 * BMAS Sozialversicherungsrechengrößen-Verordnung 2026; SGB V §§226,229,249a; SGB XI §55.
 */
export const DE_PENSION_2026 = { monthlyCeiling: 5812.50, occupationalExemption: 3955 / 20,
  healthRate: .146, careRate: .036, childlessExtra: .006, childDiscount: .0025,
  solidarityThreshold: 20350 } as const;
export function germanPensionTaxableShare(startYear: number) {
  return startYear <= 2005 ? .5 : startYear <= 2020 ? .5 + (startYear - 2005) * .02 : startYear <= 2022 ? .8 + (startYear - 2020) * .01 : Math.min(1, .82 + (startYear - 2022) * .005);
}
/** Lifetime private annuity earnings share, EStG §22(1)(a)(bb). */
export function germanAnnuityShare(age: number) {
  const bands = [[1,59],[3,58],[5,57],[8,56],[10,55],[12,54],[14,53],[16,52],[18,51],[20,50],[22,49],[24,48],[26,47],[27,46],[29,45],[31,44],[32,43],[34,42],[35,41],[37,40],[38,39],[40,38],[41,37],[42,36],[44,35],[45,34],[47,33],[48,32],[49,31],[50,30],[52,29],[53,28],[54,27],[56,26],[57,25],[58,24],[59,23],[61,22],[62,21],[63,20],[64,19],[66,18],[67,17],[68,16],[70,15],[71,14],[73,13],[74,12],[75,11],[77,10],[79,9],[80,8],[82,7],[84,6],[87,5],[91,4],[93,3],[96,2],[120,1]];
  return (bands.find(([max]) => age <= max)?.[1] ?? 1) / 100;
}
export function germanProgressiveSurcharges(tax: number, joint: boolean, churchRate: number) {
  const threshold = DE_PENSION_2026.solidarityThreshold * (joint ? 2 : 1);
  const solidarity = Math.floor((Math.max(0, Math.min(tax * .055, (tax - threshold) * .119)) + 1e-9) * 100) / 100;
  return { solidarity, church: Math.round(tax * churchRate * 100) / 100 };
}
export interface PensionPayment { plan: PensionPlan; annual: number; lumpSum: number; occupationalMonthlyEquivalent: number }
/** One person's pension receipts, combined income-tax assessment where selected.
 * Child tax allowances/church-tax deductions should already be reflected in the supplied taxable-income base.
 * bAV supports funded §22 contracts; statement mode is required for other arrangements.
 */
export function germanPensionNet(payments: PensionPayment[], plan: GermanPlan) {
  const settings = plan.pensionTax, rules = DE_PENSION_2026;
  let gross = 0, taxable = 0, statutory = 0, occupational = 0;
  const issues: string[] = [];
  for (const payment of payments) {
    const p = payment.plan, total = payment.annual + payment.lumpSum;
    gross += total;
    if (p.kind === "statutory") statutory += payment.annual / 12;
    if (p.kind === "occupational") occupational += payment.annual / 12 + payment.occupationalMonthlyEquivalent;
    if (total === 0) continue;
    if (p.taxTreatment === "statement") taxable += Math.min(total, p.taxableAnnualFromStatement);
    else if (p.kind === "statutory" || p.kind === "ruerup") {
      const exempt = p.taxFreeAnnualAmount ?? payment.annual * (1 - germanPensionTaxableShare(p.pensionStartYear ?? plan.tax.year + p.yearsUntilPayment));
      taxable += Math.max(0, total - exempt);
    } else if (p.taxTreatment === "funded" && ["avd", "riester", "occupational"].includes(p.kind)) {
      if (p.kind === "avd" && p.avd.enabled && (p.monthlyContribution * 12 > 1800 || p.avd.eligibility === "none")) issues.push(p.id);
      else taxable += total;
    }
    else if (p.taxTreatment === "private-annuity" && p.kind === "private" && payment.lumpSum === 0) taxable += payment.annual * germanAnnuityShare(p.ageAtPayment);
    else issues.push(p.id);
  }
  if (issues.length) return { gross, taxable: null, health: null, care: null, incomeTax: null, solidarity: null, church: null, net: null, issues };
  let health = 0, care = 0;
  if (settings.insurance === "kvdr") {
    const statutoryBase = Math.min(statutory, rules.monthlyCeiling);
    const remaining = Math.max(0, rules.monthlyCeiling - statutoryBase);
    // One shared exemption across all bAV contracts; care uses a threshold, NOT a deduction.
    const occupationalHealth = Math.min(remaining, Math.max(0, occupational - rules.occupationalExemption));
    const occupationalCare = occupational > rules.occupationalExemption ? Math.min(remaining, occupational) : 0;
    const careRate = rules.careRate + (settings.childless ? rules.childlessExtra : 0) - Math.min(4, Math.max(0, settings.childrenUnder25 - 1)) * rules.childDiscount;
    health = 12 * (statutoryBase * (rules.healthRate + settings.additionalHealthRate) / 2 + occupationalHealth * (rules.healthRate + settings.additionalHealthRate));
    care = 12 * (statutoryBase + occupationalCare) * careRate;
  } else health = settings.annualPrivatePremium;
  const deductible = settings.insurance === "kvdr" ? health + care : Math.min(health, settings.annualDeductiblePremium);
  const base = Math.max(0, settings.otherTaxableIncome - settings.otherDeductions);
  // €102 expense allowance is applied once across pensions, not once per contract.
  const incomeTax = germanIncomeTax(Math.max(0, base + taxable - deductible - (taxable > 0 ? 102 : 0)), plan.tax.joint);
  const baseTax = germanIncomeTax(base, plan.tax.joint);
  const charges = germanProgressiveSurcharges(germanIncomeTax(Math.max(0, base + taxable - deductible - (taxable > 0 ? 102 : 0) - settings.surchargeChildAllowance), plan.tax.joint), plan.tax.joint, plan.tax.churchRate);
  const before = germanProgressiveSurcharges(germanIncomeTax(Math.max(0, base - settings.surchargeChildAllowance), plan.tax.joint), plan.tax.joint, plan.tax.churchRate);
  const incrementalTax = incomeTax - baseTax, solidarity = charges.solidarity - before.solidarity, church = charges.church - before.church;
  return { gross, taxable, health, care, incomeTax: incrementalTax, solidarity, church, net: gross - health - care - incrementalTax - solidarity - church, issues };
}
