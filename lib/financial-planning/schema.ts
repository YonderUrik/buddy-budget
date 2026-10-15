import { z } from "zod";

const money = z.number().finite().min(0).max(1e12);
const signedMoney = z.number().finite().min(-1e12).max(1e12);
const rate = z.number().finite().min(0).max(1);
export const fundKinds = ["unknown", "equity", "mixed", "property", "foreign-property", "other"] as const;
export const pensionKinds = ["statutory", "occupational", "riester", "ruerup", "private", "avd"] as const;
const date = z.iso.date();
/** German tax-year inputs. Amounts are EUR, losses are positive balances, never Italian carryforwards. */
export const taxProfileSchema = z.object({
  year: z.literal(2026).default(2026),
  futureForecast: z.enum(["verified", "constant-2026"]).default("verified"),
  joint: z.boolean().default(false),
  churchRate: z.union([z.literal(0), z.literal(0.08), z.literal(0.09)]).default(0),
  allowanceUsedElsewhere: money.default(0),
  shareLosses: money.default(0), generalLosses: money.default(0),
  otherCapitalIncome: money.default(0),
  verifiedForeignCredit: money.default(0),
  historyConfirmed: z.boolean().default(false),
  fundKinds: z.record(z.string().max(100), z.enum(fundKinds)).default({}),
  // Gross advance amounts attributed to disposed shares, from broker records, before partial exemption.
  priorAdvancesBySale: z.record(z.string().max(100), money).default({}),
  fundHistoryConfirmed: z.boolean().default(false),
}).strict();
export const fundScenarioSchema = z.object({
  kind: z.enum(fundKinds).default("unknown"), startValue: money.default(0), endValue: money.default(0),
  distributions: money.default(0), acquisitionMonth: z.number().int().min(1).max(12).default(1),
}).strict();
/** Explicit AVD assumptions: no grant is inferred from a product name. */
export const avdSchema = z.object({
  enabled: z.boolean().default(false),
  contributionStartYear: z.number().int().min(2027).max(2100).default(2027),
  eligibility: z.enum(["none", "direct", "indirect"]).default("none"),
  spouseAnnualContribution: money.max(6840).default(0),
  childAllowanceYears: z.array(z.number().int().min(0).max(30)).max(20).default([]),
  starterBonus: z.boolean().default(false), ageAtStart: z.number().int().min(18).max(100).default(40),
  taxableIncomeBeforeDeduction: money.default(0),
  payout: z.enum(["provider", "drawdown"]).default("provider"),
  payoutStartAge: z.number().int().min(65).max(70).default(67),
  payoutEndAge: z.number().int().min(85).max(120).default(85),
  lumpSumRate: rate.max(0.3).default(0),
  payoutReturn: z.number().finite().min(-0.5).max(0.3).default(0),
}).strict().refine(v => v.payout !== "drawdown" || v.payoutEndAge > v.payoutStartAge, { message: "Payout must end after it starts", path: ["payoutEndAge"] });
/** Household net-pension scenario. Unknown contract tax treatment must be confirmed. */
export const pensionTaxSchema = z.object({
  mode: z.enum(["manual", "rules"]).default("manual"),
  insurance: z.enum(["kvdr", "private"]).default("kvdr"),
  additionalHealthRate: rate.max(0.1).default(0.029),
  childless: z.boolean().default(false), childrenUnder25: z.number().int().min(0).max(20).default(0),
  annualPrivatePremium: money.default(0), annualDeductiblePremium: money.default(0),
  surchargeChildAllowance: money.default(0),
  otherTaxableIncome: money.default(0), otherDeductions: money.default(0),
}).strict();
export const pensionPlanSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100), kind: z.enum(pensionKinds),
  capital: money.default(0), monthlyContribution: money.default(0), monthlyGross: money.default(0),
  yearsUntilPayment: z.number().int().min(0).max(80).default(0),
  nominalReturn: z.number().finite().min(-0.5).max(0.3).default(0),
  points: money.max(1000).default(0), annualPoints: money.max(10).default(0),
  accessFactor: z.number().finite().min(0).max(2).default(1),
  taxTreatment: z.enum(["unknown", "funded", "private-annuity", "statement"]).default("unknown"),
  taxableAnnualFromStatement: money.default(0),
  pensionStartYear: z.number().int().min(1900).max(2200).nullable().default(null),
  taxFreeAnnualAmount: money.nullable().default(null),
  ageAtPayment: z.number().int().min(0).max(120).default(67),
  avd: avdSchema.default(() => avdSchema.parse({})),
  paymentMode: z.enum(["income", "capital"]).default("income"),
}).strict().refine(p => p.kind !== "avd" || !p.avd.enabled || p.monthlyContribution * 12 <= 6840, { message: "AVD annual contribution exceeds limit", path: ["monthlyContribution"] }).refine(p => !["statutory", "ruerup", "riester", "avd"].includes(p.kind) || p.paymentMode === "income", { message: "This product requires an income payout", path: ["paymentMode"] });
export const retirementSchema = z.object({
  liquidCapital: money.default(0), annualSaving: money.default(0), annualSpending: money.default(0),
  yearsUntilRetirement: z.number().int().min(0).max(80).default(0),
  realReturn: z.number().finite().min(-0.5).max(0.3).default(0.02),
  withdrawalRate: z.number().finite().min(0.005).max(0.2).default(0.035),
  inflation: z.number().finite().min(0).max(0.2).default(0.02),
  pensionDeductionRate: rate.default(0.25), withdrawalTaxShare: rate.max(0.9).default(0),
}).strict();
export const cryptoSaleSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100),
  acquired: date, sold: date, proceeds: money, cost: money, fees: money.default(0),
}).strict().refine(v => v.sold >= v.acquired, { message: "Sale must follow acquisition", path: ["sold"] }).refine(v => v.sold.startsWith("2026-"), { message: "Only tax year 2026 is supported", path: ["sold"] });
/** Versioned country-specific document, stored separately from Italian assumptions and portfolio records. */
export const germanPlanSchema = z.object({
  version: z.literal(1).default(1), country: z.literal("DE").default("DE"),
  tax: taxProfileSchema.default(() => taxProfileSchema.parse({})),
  fund: fundScenarioSchema.default(() => fundScenarioSchema.parse({})),
  pensions: z.array(pensionPlanSchema).max(100).default([]),
  pensionTax: pensionTaxSchema.default(() => pensionTaxSchema.parse({})),
  retirement: retirementSchema.default(() => retirementSchema.parse({})),
  crypto: z.array(cryptoSaleSchema).max(1000).default([]),
  cryptoOtherGains: signedMoney.default(0), cryptoLossCarryforward: money.default(0),
  otherTaxableIncome: money.default(0),
}).strict().superRefine((plan, ctx) => {
  const activeAvd = plan.pensions.filter(p => p.kind === "avd" && p.avd.enabled);
  if (activeAvd.length > 1) ctx.addIssue({ code: "custom", message: "Use one combined AVD scenario per person to avoid duplicate allowances", path: ["pensions"] });
  for (const p of activeAvd) {
    if (p.yearsUntilPayment !== p.avd.payoutStartAge - p.avd.ageAtStart + p.avd.contributionStartYear - plan.tax.year) ctx.addIssue({ code: "custom", message: "AVD dates and ages must agree", path: ["pensions"] });
    if (plan.tax.year + p.yearsUntilPayment <= p.avd.contributionStartYear) ctx.addIssue({ code: "custom", message: "AVD payout must follow contribution start", path: ["pensions"] });
  }
  if (plan.pensionTax.childless && plan.pensionTax.childrenUnder25 > 0) ctx.addIssue({ code: "custom", message: "Inconsistent care-insurance children", path: ["pensionTax"] });
  for (const key of ["pensions", "crypto"] as const) {
    const ids = new Set<string>();
    plan[key].forEach((item, index) => {
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", message: "Duplicate entry", path: [key, index, "id"] });
      ids.add(item.id);
    });
  }
});
export type GermanPlan = z.infer<typeof germanPlanSchema>;
export type TaxProfile = GermanPlan["tax"];
export type PensionPlan = GermanPlan["pensions"][number];
export type FundKind = (typeof fundKinds)[number];
export type PlanningSection = "tax" | "income" | "pension" | "retirement";
