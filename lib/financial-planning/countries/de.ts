import type { FundKind, GermanPlan, TaxProfile } from "../schema";

/** Validated 2026 rules for private German-resident investors; never reuse for other years. */
export const DE_2026 = {
  country: "DE", year: 2026, allowance: 1000, jointAllowance: 2000,
  capitalRate: 0.25, solidarityRate: 0.055, advanceBaseRate: 0.032,
  advanceFactor: 0.7, pensionPointValue: 42.52, pensionPointValueFrom: "2026-07-01",
  privateSaleThreshold: 1000,
  exemptions: { equity: 0.3, mixed: 0.15, property: 0.6, "foreign-property": 0.8, other: 0 },
  sources: [
    "https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Investmentsteuer/2026-01-13-basiszins-berechnung-vorabpauschale.pdf?__blob=publicationFile&v=1",
    "https://www.gesetze-im-internet.de/estg/__20.html",
    "https://www.gesetze-im-internet.de/estg/__32d.html",
    "https://www.gesetze-im-internet.de/solzg_1995/__4.html",
    "https://www.gesetze-im-internet.de/invstg_2018/__18.html",
    "https://www.gesetze-im-internet.de/invstg_2018/__19.html",
    "https://www.gesetze-im-internet.de/invstg_2018/__20.html",
    "https://www.gesetze-im-internet.de/rwbestv_2026/BJNR0B20A0026.html",
    "https://www.gesetze-im-internet.de/estg/__23.html",
    "https://www.gesetze-im-internet.de/estg/__32a.html",
  ],
} as const;
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Fail closed for tax years that have not been researched. */
export function germanRules(year: number) {
  if (year !== DE_2026.year) throw new Error("Unsupported German tax year");
  return DE_2026;
}
/** Taxable fraction for a verified private-investor fund classification; unknown is not zero exemption. */
export function fundTaxableShare(kind: FundKind): number | null {
  return kind === "unknown" ? null : 1 - DE_2026.exemptions[kind];
}
/** Annual assessment scenario: share losses cannot offset dividends; unused losses have no four-year expiry. */
export function germanCapitalTax(profile: TaxProfile, shareGains: number, generalIncome: number) {
  const r = germanRules(profile.year);
  const sharesAfterLoss = shareGains - profile.shareLosses;
  const remainingShareLosses = Math.max(0, -sharesAfterLoss);
  const pooled = Math.max(0, sharesAfterLoss) + generalIncome + profile.otherCapitalIncome - profile.generalLosses;
  const remainingGeneralLosses = Math.max(0, -pooled);
  const allowance = Math.max(0, (profile.joint ? r.jointAllowance : r.allowance) - profile.allowanceUsedElsewhere);
  const usedAllowance = Math.min(allowance, Math.max(0, pooled));
  const taxable = Math.max(0, pooled - usedAllowance);
  const foreignCredit = Math.min(profile.verifiedForeignCredit, taxable * r.capitalRate);
  const capitalTax = cents((taxable - foreignCredit / r.capitalRate) / (1 / r.capitalRate + profile.churchRate));
  const solidarity = Math.floor((capitalTax * r.solidarityRate + 1e-9) * 100) / 100;
  const church = cents(capitalTax * profile.churchRate);
  return { taxable, foreignCredit, usedAllowance, remainingAllowance: allowance - usedAllowance, capitalTax, solidarity, church,
    total: cents(capitalTax + solidarity + church), remainingShareLosses, remainingGeneralLosses };
}
/** 2026 fund advance scenario, taxable in 2027 (no unverified 2027 tax rate applied). Held through year-end. */
export function germanFundAdvance(input: GermanPlan["fund"]) {
  const growthCap = Math.max(0, input.endValue - input.startValue + input.distributions);
  const base = Math.min(input.startValue * DE_2026.advanceBaseRate * DE_2026.advanceFactor, growthCap);
  const gross = Math.max(0, base - input.distributions) * (13 - input.acquisitionMonth) / 12;
  const share = fundTaxableShare(input.kind);
  return { gross: cents(gross), taxable: share === null ? null : cents(gross * share), receiptYear: 2027 };
}
/** German progressive income tax on taxable income, not gross salary; excludes surcharges and deductions. */
export function germanIncomeTax(taxableIncome: number, joint = false): number {
  const divisor = joint ? 2 : 1;
  const x = Math.floor(Math.max(0, taxableIncome) / divisor);
  const y = (x - 12348) / 10000;
  const z = (x - 17799) / 10000;
  const tax = x <= 12348 ? 0 : x <= 17799 ? (914.51 * y + 1400) * y : x <= 69878 ? (173.10 * z + 2397) * z + 1034.87 : x <= 277825 ? 0.42 * x - 11135.63 : 0.45 * x - 19470.38;
  return Math.floor(tax) * divisor;
}
/** Private spot-crypto disposal scenario. The €1,000 limit is a threshold, not a deduction. */
export function germanCrypto(plan: GermanPlan) {
  let shortTerm = plan.cryptoOtherGains;
  let exempt = 0;
  for (const sale of plan.crypto) {
    if (!sale.sold.startsWith(String(plan.tax.year))) continue;
    const anniversary = `${Number(sale.acquired.slice(0, 4)) + 1}${sale.acquired.slice(4)}`;
    const gain = sale.proceeds - sale.cost - sale.fees;
    if (sale.sold > anniversary) exempt += gain;
    else shortTerm += gain;
  }
  const taxable = shortTerm < DE_2026.privateSaleThreshold ? 0 : Math.max(0, shortTerm - plan.cryptoLossCarryforward);
  return { shortTerm, exempt, taxable,
    incomeTax: germanIncomeTax(plan.otherTaxableIncome + taxable, plan.tax.joint) - germanIncomeTax(plan.otherTaxableIncome, plan.tax.joint),
    remainingLoss: shortTerm < 0 ? plan.cryptoLossCarryforward - shortTerm : shortTerm < DE_2026.privateSaleThreshold ? plan.cryptoLossCarryforward : Math.max(0, plan.cryptoLossCarryforward - shortTerm) };
}
