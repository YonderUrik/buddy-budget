import * as D from "@/lib/financial-planning";
import { germanPlanSchema, taxProfileSchema, pensionPlanSchema } from "@/lib/financial-planning/schema";
import { writeFileSync } from "node:fs";
const out = process.argv[2];
const vectors: any[] = [];
const v = (id: string, fn: string, input: any, expected: any, tolerance: number | null = 1e-9, notes = "") => vectors.push({ id, function: fn, input, expected, tolerance, notes });
const prof = (o: any = {}) => taxProfileSchema.parse(o);
for (const k of ["unknown", "equity", "mixed", "property", "foreign-property", "other"] as const) v(`fundTaxableShare-${k}`, "fundTaxableShare", { kind: k }, D.fundTaxableShare(k), 1e-12);
const ct: [string, any, number, number, string][] = [
  ["below-allowance", {}, 0, 800, "800 < 1000 allowance → 0 tax"],
  ["single-basic", {}, 3000, 2000, "taxable 4000; KapESt 1000; Soli 55"],
  ["church9", { churchRate: 0.09 }, 3000, 2000, "church reduces KapESt: (taxable)/(4+0.09)"],
  ["joint-losses", { joint: true, shareLosses: 5000, generalLosses: 500 }, 3000, 4000, "share losses offset only share gains; remaining 2000 share losses carried"],
  ["foreign-credit", { verifiedForeignCredit: 300, allowanceUsedElsewhere: 200 }, 0, 5000, "credit capped at 25% of taxable"],
];
for (const [id, o, s, g, n] of ct) v(`germanCapitalTax-${id}`, "germanCapitalTax", { profile: o, shareGains: s, generalIncome: g }, D.germanCapitalTax(prof(o), s, g), 1e-9, n);
for (const x of [0, 12348, 15000, 17799, 40000, 69878, 100000, 300000]) v(`germanIncomeTax-${x}`, "germanIncomeTax", { taxableIncome: x, joint: false }, D.germanIncomeTax(x), 0, "2026 tariff §32a, floor to whole euro");
v("germanIncomeTax-joint-80000", "germanIncomeTax", { taxableIncome: 80000, joint: true }, D.germanIncomeTax(80000, true), 0, "splitting: 2 × tax(floor(x/2))");
const fa = [{ kind: "equity", startValue: 10000, endValue: 11000, distributions: 0, acquisitionMonth: 1 }, { kind: "equity", startValue: 10000, endValue: 10100, distributions: 50, acquisitionMonth: 1 }, { kind: "unknown", startValue: 20000, endValue: 22000, distributions: 0, acquisitionMonth: 7 }, { kind: "mixed", startValue: 10000, endValue: 9000, distributions: 0, acquisitionMonth: 1 }];
fa.forEach((f, i) => v(`germanFundAdvance-${i}`, "germanFundAdvance", f, D.germanFundAdvance(f as any), 1e-9, "base = min(start×0.032×0.7, max(0,end−start+distr)); gross = max(0, base−distr) × (13−month)/12"));
const plan = (o: any) => germanPlanSchema.parse(o);
v("germanCrypto-mixed", "germanCrypto", { tax: { joint: false }, otherTaxableIncome: 40000, crypto: [{ id: "1", name: "BTC", acquired: "2025-03-01", sold: "2026-02-01", proceeds: 5000, cost: 3000, fees: 20 }, { id: "2", name: "ETH", acquired: "2024-01-01", sold: "2026-05-01", proceeds: 4000, cost: 1000, fees: 0 }] }, D.germanCrypto(plan({ otherTaxableIncome: 40000, crypto: [{ id: "1", name: "BTC", acquired: "2025-03-01", sold: "2026-02-01", proceeds: 5000, cost: 3000, fees: 20 }, { id: "2", name: "ETH", acquired: "2024-01-01", sold: "2026-05-01", proceeds: 4000, cost: 1000, fees: 0 }] })), 0, "held >1y exempt; short-term ≥1000 fully taxable (threshold, not allowance)");
v("germanCrypto-under-threshold", "germanCrypto", { otherTaxableIncome: 40000, crypto: [{ id: "1", name: "BTC", acquired: "2026-01-01", sold: "2026-02-01", proceeds: 1900, cost: 1000, fees: 0 }], cryptoLossCarryforward: 300 }, D.germanCrypto(plan({ otherTaxableIncome: 40000, crypto: [{ id: "1", name: "BTC", acquired: "2026-01-01", sold: "2026-02-01", proceeds: 1900, cost: 1000, fees: 0 }], cryptoLossCarryforward: 300 })), 0);
v("germanCrypto-loss", "germanCrypto", { crypto: [{ id: "1", name: "X", acquired: "2026-01-01", sold: "2026-03-01", proceeds: 500, cost: 1500, fees: 0 }], cryptoLossCarryforward: 100 }, D.germanCrypto(plan({ crypto: [{ id: "1", name: "X", acquired: "2026-01-01", sold: "2026-03-01", proceeds: 500, cost: 1500, fees: 0 }], cryptoLossCarryforward: 100 })), 0);
for (const y of [2005, 2010, 2021, 2026, 2058, 2070]) v(`germanPensionTaxableShare-${y}`, "germanPensionTaxableShare", { startYear: y }, D.germanPensionTaxableShare(y), 1e-12);
for (const a of [60, 65, 67, 70, 97]) v(`germanAnnuityShare-${a}`, "germanAnnuityShare", { age: a }, D.germanAnnuityShare(a), 1e-12);
for (const [t, j, c] of [[5000, false, 0], [25000, false, 0.09], [30000, false, 0], [50000, true, 0.08]] as const) v(`germanProgressiveSurcharges-${t}-${j}`, "germanProgressiveSurcharges", { tax: t, joint: j, churchRate: c }, D.germanProgressiveSurcharges(t, j, c), 1e-9);
const pp = (o: any) => pensionPlanSchema.parse({ id: "p", name: "P", kind: "private", ...o });
const avdP = pp({ kind: "avd", monthlyContribution: 150, yearsUntilPayment: 30, nominalReturn: 0.05, capital: 0, avd: { enabled: true, contributionStartYear: 2027, eligibility: "direct", childAllowanceYears: [10, 3], starterBonus: true, ageAtStart: 24, taxableIncomeBeforeDeduction: 50000, payout: "drawdown", payoutStartAge: 67, payoutEndAge: 85, lumpSumRate: 0.3, payoutReturn: 0.02 } });
v("germanAvdAllowance-direct", "germanAvdAllowance", { plan: "avdP", contributionYear: 0 }, D.germanAvdAllowance(avdP, 0), 1e-9, "annual 1800 → basic 360×0.5 + (1800−360)×0.25 = 540; children 2×300; starter 200");
v("germanAvdAllowance-year5", "germanAvdAllowance", { plan: "avdP", contributionYear: 5 }, D.germanAvdAllowance(avdP, 5), 1e-9, "child with 3 years left drops out");
const ind = pp({ kind: "avd", monthlyContribution: 50, avd: { enabled: true, eligibility: "indirect", spouseAnnualContribution: 1200 } });
v("germanAvdAllowance-indirect", "germanAvdAllowance", { plan: { monthlyContribution: 50, avd: { eligibility: "indirect", spouseAnnualContribution: 1200 } } }, D.germanAvdAllowance(ind, 0), 1e-9, "indirect capped at 175");
v("germanAvdTaxBenefit", "germanAvdTaxBenefit", { plan: "avdP", joint: false }, D.germanAvdTaxBenefit(avdP, false), 1e-9);
v("projectGermanAvd", "projectGermanAvd", { plan: "avdP", referenceYear: 2026 }, D.projectGermanAvd(avdP, 2026), 1e-6, "monthly in arrears, grants at year end; delay = contributionStartYear − referenceYear = 1 year");
const st = pp({ kind: "statutory", points: 30, annualPoints: 1, yearsUntilPayment: 20, accessFactor: 1 });
v("projectGermanPension-statutory", "projectGermanPension", { plan: { kind: "statutory", points: 30, annualPoints: 1, yearsUntilPayment: 20, accessFactor: 1 } }, D.projectGermanPension(st), 1e-9, "(30+20×1)×42.52");
const occ = pp({ kind: "occupational", capital: 20000, monthlyContribution: 200, yearsUntilPayment: 25, nominalReturn: 0.04, paymentMode: "capital", taxTreatment: "funded" });
v("projectGermanPension-occ-capital", "projectGermanPension", { plan: { kind: "occupational", capital: 20000, monthlyContribution: 200, yearsUntilPayment: 25, nominalReturn: 0.04, paymentMode: "capital" } }, D.projectGermanPension(occ), 1e-6);
const priv0 = pp({ kind: "private", capital: 1000, monthlyContribution: 100, yearsUntilPayment: 10, nominalReturn: 0, paymentMode: "income", monthlyGross: 300 });
v("projectGermanPension-zeroReturn", "projectGermanPension", { plan: { kind: "private", capital: 1000, monthlyContribution: 100, yearsUntilPayment: 10, nominalReturn: 0, paymentMode: "income", monthlyGross: 300 } }, D.projectGermanPension(priv0), 1e-9);
const retPlan = plan({ retirement: { liquidCapital: 200000, annualSaving: 20000, annualSpending: 36000, yearsUntilRetirement: 15, realReturn: 0.03, withdrawalRate: 0.035, inflation: 0.02, pensionDeductionRate: 0.25, withdrawalTaxShare: 0.1 }, pensions: [{ ...st, id: "s", yearsUntilPayment: 20 }] });
const rr = D.germanRetirement(retPlan);
v("germanRetirement-manual", "germanRetirement", { retirement: retPlan.retirement, pensions: [{ id: "s", kind: "statutory", points: 30, annualPoints: 1, yearsUntilPayment: 20, accessFactor: 1 }], pensionTax: { mode: "manual" } }, { atRetirement: rr.atRetirement, currentTarget: rr.currentTarget, depletedAfter: rr.depletedAfter, issues: rr.issues, rows0to6: rr.rows.slice(0, 7), row49: rr.rows[49] }, 1e-6, "50 yearly rows; beginning-of-year withdrawal; pension enters at yearsUntilPayment (5 years after retirement)");
const net = D.germanPensionNet([{ plan: { ...st, id: "s", pensionStartYear: 2046 } as any, annual: 25510 * 0 + 50 * 42.52 * 12, lumpSum: 0, occupationalMonthlyEquivalent: 0 }], plan({ pensionTax: { mode: "rules", insurance: "kvdr", additionalHealthRate: 0.029 }, }));
v("germanPensionNet-kvdr", "germanPensionNet", { payments: [{ plan: { kind: "statutory", pensionStartYear: 2046 }, annual: 25512, lumpSum: 0 }], pensionTax: { mode: "rules", insurance: "kvdr", additionalHealthRate: 0.029 }, tax: { joint: false, churchRate: 0 } }, net, 1e-9, "taxable share 2046 = min(1, 0.82+24×0.005)=0.94; health = half of (14.6%+2.9%); care 3.6%; €102 allowance");
writeFileSync(out, JSON.stringify({ topic: "financial-planning-de", source: "lib/financial-planning/**", generatedWith: "npx tsx (Node, V8 doubles)", vectors }, null, 2));
console.log(vectors.length);
