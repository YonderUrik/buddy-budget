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
export const pensionPlanSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100), kind: z.enum(pensionKinds),
  capital: money.default(0), monthlyContribution: money.default(0), monthlyGross: money.default(0),
  yearsUntilPayment: z.number().int().min(0).max(80).default(0),
  nominalReturn: z.number().finite().min(-0.5).max(0.3).default(0),
  points: money.max(1000).default(0), annualPoints: money.max(10).default(0),
  accessFactor: z.number().finite().min(0).max(2).default(1),
  paymentMode: z.enum(["income", "capital"]).default("income"),
}).strict().refine(p => !["statutory", "ruerup", "riester", "avd"].includes(p.kind) || p.paymentMode === "income", { message: "This product requires an income payout", path: ["paymentMode"] });
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
  retirement: retirementSchema.default(() => retirementSchema.parse({})),
  crypto: z.array(cryptoSaleSchema).max(1000).default([]),
  cryptoOtherGains: signedMoney.default(0), cryptoLossCarryforward: money.default(0),
  otherTaxableIncome: money.default(0),
}).strict().superRefine((plan, ctx) => {
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
