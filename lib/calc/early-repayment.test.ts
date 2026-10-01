import { describe, expect, it } from "vitest";
import { compareEarlyRepayment, simulateRecurringExtra } from "./early-repayment";
import { buildLoanPlan, type DebtTerms } from "./debt-plan";

const terms: DebtTerms = { startMode: "nuovo", principal: 12000, annualRate: 6, installments: 24, firstInstallmentDate: "2026-03-05" };
const TODAY = "2026-02-01";

describe("estinzione anticipata nel piano", () => {
  const base = buildLoanPlan(terms, [], TODAY);
  it("riduci la durata: stessa rata, finisce prima, rate precedenti congelate", () => {
    const plan = buildLoanPlan(terms, [{ type: "early_repayment", date: "2026-08-10", amount: 3000, penalty: 0, effect: "reduce_duration" }], TODAY);
    expect(plan.rows.slice(0, 6)).toEqual(base.rows.slice(0, 6));
    expect(plan.rows.length).toBeLessThan(24);
    expect(plan.rows[6].installment).toBe(base.rows[6].installment);
    expect(plan.rows.at(-1)!.residual).toBe(0);
    expect(plan.totals.interestRemaining).toBeLessThan(base.totals.interestRemaining);
  });
  it("riduci la rata: stesse rate, rata più bassa", () => {
    const plan = buildLoanPlan(terms, [{ type: "early_repayment", date: "2026-08-10", amount: 3000, penalty: 0, effect: "reduce_installment" }], TODAY);
    expect(plan.rows).toHaveLength(24);
    expect(plan.rows[6].installment).toBeLessThan(base.rows[6].installment);
    expect(plan.rows[6].number).toBe(7);
    expect(plan.rows.at(-1)!.residual).toBe(0);
  });
  it("il residuo dopo l'estinzione è quello prima meno l'importo", () => {
    const plan = buildLoanPlan(terms, [{ type: "early_repayment", date: "2026-08-10", amount: 3000, penalty: 0, effect: "reduce_duration" }], TODAY);
    expect(plan.earlyRepayments[0].residualAfter).toBeCloseTo(base.rows[5].residual - 3000, 2);
    expect(plan.residualSeries.some((p) => p.date === "2026-08-10")).toBe(true);
  });
  it("un importo pari al residuo chiude il debito", () => {
    const plan = buildLoanPlan(terms, [{ type: "early_repayment", date: "2026-08-10", amount: 99999, penalty: 100, effect: "reduce_duration" }], "2026-09-01");
    expect(plan.totals.closedOn).toBe("2026-08-10");
    expect(plan.totals.finished).toBe(true);
    expect(plan.totals.residual).toBe(0);
    expect(plan.totals.endDate).toBe("2026-08-10");
    expect(plan.totals.penaltiesPaid).toBe(100);
    expect(plan.rows).toHaveLength(6);
  });
  it("il residuo di oggi tiene conto di un'estinzione già avvenuta dopo l'ultima rata", () => {
    const plan = buildLoanPlan(terms, [{ type: "early_repayment", date: "2026-08-10", amount: 3000, penalty: 0, effect: "reduce_duration" }], "2026-08-20");
    expect(plan.totals.residual).toBeCloseTo(base.rows[5].residual - 3000, 2);
  });
  it("le penali contano solo per le estinzioni già avvenute", () => {
    const plan = buildLoanPlan(terms, [{ type: "early_repayment", date: "2026-08-10", amount: 1000, penalty: 20, effect: "reduce_duration" }], TODAY);
    expect(plan.totals.penaltiesPaid).toBe(0);
  });
  it("combinata con un cambio tasso successivo resta coerente", () => {
    const plan = buildLoanPlan(
      terms,
      [
        { type: "early_repayment", date: "2026-08-10", amount: 3000, penalty: 0, effect: "reduce_duration" },
        { type: "rate_change", date: "2026-12-01", rate: 8 },
      ],
      TODAY
    );
    expect(plan.rows.at(-1)!.residual).toBe(0);
  });
});

describe("compareEarlyRepayment", () => {
  const cmp = compareEarlyRepayment(terms, [], TODAY, { date: "2026-08-10", amount: 3000, penalty: 30 });
  it("riduci durata risparmia più interessi di riduci rata", () => {
    expect(cmp.reduceDuration.interestSaved).toBeGreaterThan(cmp.reduceInstallment.interestSaved);
    expect(cmp.reduceDuration.monthsSaved).toBeGreaterThan(0);
    expect(cmp.reduceInstallment.monthsSaved).toBe(0);
  });
  it("riduci rata abbassa la rata, riduci durata la lascia", () => {
    expect(cmp.reduceInstallment.nextInstallment).toBeLessThan(cmp.baselineInstallment);
    expect(cmp.reduceDuration.nextInstallment).toBe(cmp.baselineInstallment);
  });
  it("il beneficio netto sottrae la penale", () => {
    expect(cmp.reduceDuration.netBenefit).toBeCloseTo(cmp.reduceDuration.interestSaved - 30, 2);
  });
});

describe("simulateRecurringExtra", () => {
  it("un extra mensile accorcia il debito e fa risparmiare interessi", () => {
    const r = simulateRecurringExtra(terms, [], TODAY, 100);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.endDate < r.baselineEndDate).toBe(true);
    expect(r.extraPaid).toBeGreaterThan(0);
  });
});
