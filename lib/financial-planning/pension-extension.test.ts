import { describe, expect, it } from "vitest";
import { germanPlanSchema, pensionPlanSchema, germanAvdAllowance, germanAvdTaxBenefit, projectGermanPension, germanRetirement, germanPensionNet, germanPensionTaxableShare, germanAnnuityShare, germanIncomeTax, germanProgressiveSurcharges } from "./index";
const avd = (contribution = 150) => pensionPlanSchema.parse({ id: "avd", name: "AVD", kind: "avd", monthlyContribution: contribution, yearsUntilPayment: 2, avd: { enabled: true, eligibility: "direct", ageAtStart: 66 } });
describe("approved AVD reform", () => {
  it.each([[0,0],[9.99,0],[10,60],[25,150],[30,180],[100,390],[150,540],[570,540]])("grants for monthly contribution %s", (monthly, expected) => expect(germanAvdAllowance(avd(monthly)).base).toBe(expected));
  it("requires confirmed eligibility, including the spouse minimum", () => {
    const p = avd(); p.avd.eligibility = "none"; expect(germanAvdAllowance(p).total).toBe(0);
    p.avd.eligibility = "indirect"; expect(germanAvdAllowance(p).total).toBe(0);
    p.avd.spouseAnnualContribution = 1800; expect(germanAvdAllowance(p).base).toBe(175);
  });
  it("expires each child allowance and pays the starter bonus once", () => {
    const p = avd(25); p.avd.childAllowanceYears = [1,2]; p.avd.starterBonus = true; p.avd.ageAtStart = 24;
    expect(germanAvdAllowance(p, 0).total).toBe(950);
    expect(germanAvdAllowance(p, 1).total).toBe(450);
    expect(germanAvdAllowance(p, 2).total).toBe(150);
    p.avd.ageAtStart = 25; expect(germanAvdAllowance(p).bonus).toBe(0);
  });
  it("subtracts grants from the additional tax benefit, and excludes the refund from capital", () => {
    const p = avd(); p.avd.taxableIncomeBeforeDeduction = 60000;
    expect(germanAvdTaxBenefit(p, false).extraRefund).toBe(germanIncomeTax(60000) - germanIncomeTax(57660) - 540);
    expect(projectGermanPension(p).projectedCapital).toBe(2340); // 2026: no contribution; 2027: 1800 + 540
  });
  it("honours contribution start, caps, and does not retroactively grant subsidies", () => {
    const p = avd(); p.avd.contributionStartYear = 2028;
    expect(projectGermanPension(p).projectedCapital).toBe(0);
    expect(pensionPlanSchema.safeParse({ ...p, monthlyContribution: 571 }).success).toBe(false);
    expect(germanPlanSchema.safeParse({ pensions: [p] }).success).toBe(false);
    expect(germanPlanSchema.safeParse({ pensions: [avd(), { ...avd(), id: "second" }] }).success).toBe(false);
  });
  it("draws down capital after an initial lump sum and ends income at the selected age", () => {
    const p = avd(0); p.capital = 120000; p.avd.payout = "drawdown"; p.avd.payoutStartAge = 65; p.avd.ageAtStart = 64; p.avd.payoutEndAge = 85; p.avd.lumpSumRate = .3;
    const result = projectGermanPension(p); expect(result.lumpSum).toBe(36000); expect(result.monthlyGross).toBe(350);
    const plan = germanPlanSchema.parse({ pensions: [p], retirement: { yearsUntilRetirement: 2, inflation: 0, realReturn: 0, pensionDeductionRate: 0 } });
    const rows = germanRetirement(plan).rows; expect(rows[19].pension).toBe(4200); expect(rows[20].pension).toBe(0); expect(rows[0].capital).toBe(36000);
  });
  it("rejects invalid drawdown periods", () => {
    const p = avd(); p.avd.payout = "drawdown"; p.avd.payoutStartAge = 90; p.avd.payoutEndAge = 85;
    expect(pensionPlanSchema.safeParse(p).success).toBe(false);
  });
});
describe("German pension assessment", () => {
  it.each([[2005,.5],[2020,.8],[2022,.82],[2026,.84],[2027,.845],[2058,1],[2090,1]])("uses the statutory cohort %s", (year, share) => expect(germanPensionTaxableShare(year)).toBeCloseTo(share));
  it.each([[60,.22],[65,.18],[67,.17],[85,.05],[100,.01]])("uses private lifetime annuity age %s", (age, share) => expect(germanAnnuityShare(age)).toBe(share));
  const plan = () => germanPlanSchema.parse({ pensionTax: { mode: "rules", additionalHealthRate: .029 } });
  const payment = (kind: string, annual: number, patch = {}) => ({ plan: pensionPlanSchema.parse({ id: "p", name: "P", kind, ...patch }), annual, lumpSum: 0, occupationalMonthlyEquivalent: 0 });
  it("halves the statutory health contribution but not care contributions", () => {
    const result = germanPensionNet([payment("statutory", 24000)], plan());
    expect(result.health).toBeCloseTo(2100); expect(result.care).toBeCloseTo(864);
    expect(result.taxable).toBeCloseTo(20160);
    expect(result.incomeTax).toBe(germanIncomeTax(20160 - 2100 - 864 - 102));
  });
  it("applies one bAV health exemption and care threshold across contracts", () => {
    const p = plan(), a = payment("occupational", 1200, { taxTreatment: "funded" });
    expect(germanPensionNet([a], p).care).toBe(0);
    const result = germanPensionNet([a, { ...a, plan: { ...a.plan, id: "b" } }], p);
    expect(result.health).toBeCloseTo((200 - 197.75) * .175 * 12);
    expect(result.care).toBeCloseTo(2400 * .036);
  });
  it("keeps the statutory tax-free amount fixed across pension increases", () => {
    expect(germanPensionNet([payment("statutory", 30000, { taxFreeAnnualAmount: 3840 })], plan()).taxable).toBe(26160);
  });
  it("requires tax classification and does not call mixed AVD contributions fully funded", () => {
    expect(germanPensionNet([payment("private", 12000)], plan()).net).toBeNull();
    const p = avd(200); p.taxTreatment = "funded";
    expect(germanPensionNet([{ plan: p, annual: 12000, lumpSum: 0, occupationalMonthlyEquivalent: 0 }], plan()).net).toBeNull();
  });
  it("taxes private annuity earnings only and does not charge KVdR on private income", () => {
    const result = germanPensionNet([payment("private", 12000, { taxTreatment: "private-annuity", ageAtPayment: 67 })], plan());
    expect(result.taxable).toBeCloseTo(2040); expect(result.health).toBe(0); expect(result.care).toBe(0);
  });
  it("handles private premiums and their separately deductible amount", () => {
    const p = plan(); p.pensionTax = { ...p.pensionTax, insurance: "private", annualPrivatePremium: 6000, annualDeductiblePremium: 5000 };
    const result = germanPensionNet([payment("statutory", 48000)], p);
    expect(result.health).toBe(6000); expect(result.incomeTax).toBe(germanIncomeTax(40320 - 5000 - 102));
  });
  it("caps combined health/care bases and applies childless or multi-child rates", () => {
    const p = plan(); p.pensionTax.childless = true;
    const result = germanPensionNet([payment("statutory", 120000), payment("occupational", 12000, { taxTreatment: "funded" })], p);
    expect(result.health).toBeCloseTo(69750 * .175 / 2); expect(result.care).toBeCloseTo(69750 * .042);
    p.pensionTax.childless = false; p.pensionTax.childrenUnder25 = 5;
    expect(germanPensionNet([payment("statutory", 120000)], p).care).toBeCloseTo(69750 * .026);
  });
  it("uses solidarity exemption and mitigation rather than a flat surcharge", () => {
    expect(germanProgressiveSurcharges(20350, false, 0).solidarity).toBe(0);
    expect(germanProgressiveSurcharges(20450, false, 0).solidarity).toBe(11.9);
    expect(germanProgressiveSurcharges(40700, true, .09).solidarity).toBe(0);
  });
  it("uses the voluntary minimum even before pension income starts", () => {
    const p = plan(); p.pensionTax.insurance = "voluntary";
    const result = germanPensionNet([], p);
    expect(result.health).toBeCloseTo(1318.33 * (.14 + .029) * 12);
    expect(result.care).toBeCloseTo(1318.33 * .036 * 12);
    expect(result.net).toBeLessThan(0);
  });
  it("combines voluntary general/reduced bases and subtracts only a confirmed pension subsidy", () => {
    const p = plan(); p.pensionTax.insurance = "voluntary"; p.pensionTax.otherInsuranceIncome = 6000;
    const payments = [payment("statutory", 24000), payment("occupational", 12000, { taxTreatment: "funded" }), payment("private", 6000, { taxTreatment: "private-annuity" })];
    const before = germanPensionNet(payments, p);
    expect(before.health).toBeCloseTo((3000 * .175 + 1000 * .169) * 12);
    p.pensionTax.voluntarySubsidy = true;
    expect(germanPensionNet(payments, p).health).toBeCloseTo(before.health! - 24000 * .175 / 2);
    expect(before.care).toBeCloseTo(48000 * .036);
  });
  it("does not grant the KVdR occupational exemption to voluntary members and respects the ceiling", () => {
    const p = plan(); p.pensionTax.insurance = "voluntary";
    const result = germanPensionNet([payment("occupational", 12000, { taxTreatment: "funded" })], p);
    expect(result.health).toBeCloseTo((1000 * .175 + 318.33 * .169) * 12);
    p.pensionTax.otherInsuranceIncome = 120000;
    expect(germanPensionNet([], p).health).toBeCloseTo(5812.5 * .169 * 12);
  });
  it("blocks unassessed private lump sums in voluntary insurance", () => {
    const p = plan(); p.pensionTax.insurance = "voluntary";
    const entry = payment("avd", 10000, { taxTreatment: "funded" }); entry.lumpSum = 10000;
    expect(germanPensionNet([entry], p).net).toBeNull();
  });
  it("blocks the retirement result until all relevant contracts are classified", () => {
    const p = plan(); p.pensions = [pensionPlanSchema.parse({ id: "unknown", name: "Private", kind: "private", monthlyGross: 1000 })];
    expect(germanRetirement(p).rows).toEqual([]); expect(germanRetirement(p).issues).toEqual(["unknown"]);
  });
});
