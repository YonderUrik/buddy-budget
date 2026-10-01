import { describe, expect, it } from "vitest";
import { buildLoanPlan, type DebtTerms } from "./debt-plan";

const base: DebtTerms = {
  startMode: "nuovo",
  principal: 12000,
  annualRate: 6,
  installments: 12,
  firstInstallmentDate: "2026-03-05",
};

describe("buildLoanPlan: debito nuovo", () => {
  const plan = buildLoanPlan(base, [], "2026-02-01");
  it("ha tutte le rate da pagare e nessuna scaduta", () => {
    expect(plan.rows).toHaveLength(12);
    expect(plan.rows.every((r) => r.status === "da_pagare")).toBe(true);
    expect(plan.totals.overdueCount).toBe(0);
  });
  it("il residuo di oggi è il capitale e gli interessi sono tutti futuri", () => {
    expect(plan.totals.residual).toBe(12000);
    expect(plan.totals.interestToDate).toBe(0);
    expect(plan.totals.interestRemaining).toBeGreaterThan(300);
    expect(plan.totals.remainingInstallments).toBe(12);
    expect(plan.totals.endDate).toBe("2027-02-05");
    expect(plan.totals.finished).toBe(false);
  });
  it("la serie del residuo parte dal capitale un mese prima della prima rata e finisce a zero", () => {
    expect(plan.residualSeries[0]).toEqual({ date: "2026-02-05", residual: 12000 });
    expect(plan.residualSeries[plan.residualSeries.length - 1].residual).toBe(0);
  });
});

describe("buildLoanPlan: rate passate", () => {
  it("in modalità origine le rate passate non pagate sono da confermare e il residuo segue il piano", () => {
    const plan = buildLoanPlan({ ...base, startMode: "origine" }, [], "2026-06-10");
    expect(plan.rows.filter((r) => r.status === "da_confermare")).toHaveLength(4);
    expect(plan.totals.unconfirmedCount).toBe(4);
    expect(plan.totals.residual).toBe(plan.rows[3].residual);
    expect(plan.totals.interestToDate).toBeGreaterThan(0);
  });
  it("in modalità nuovo una rata passata non pagata è scaduta", () => {
    const plan = buildLoanPlan(base, [], "2026-04-10");
    expect(plan.totals.overdueCount).toBe(2);
    expect(plan.totals.nextDueDate).toBe("2026-03-05");
  });
  it("le rate pagate hanno stato pagata, importo reale e non contano come scadute", () => {
    const plan = buildLoanPlan(
      base,
      [
        { type: "payment", installmentNumber: 1, date: "2026-03-05", amount: 1035.5 },
        { type: "payment", installmentNumber: 2, date: "2026-04-06", amount: 1036 },
      ],
      "2026-04-10"
    );
    expect(plan.rows[0].status).toBe("pagata");
    expect(plan.rows[0].payment?.amount).toBe(1035.5);
    expect(plan.totals.overdueCount).toBe(0);
    expect(plan.totals.paidTotal).toBe(2071.5);
    expect(plan.totals.nextDueDate).toBe("2026-05-05");
  });
});

describe("buildLoanPlan: fotografia di oggi", () => {
  it("parte dal residuo e dalle rate rimanenti senza righe precedenti", () => {
    const plan = buildLoanPlan(
      { startMode: "fotografia", principal: 5000, annualRate: 5, installments: 10, firstInstallmentDate: "2026-10-15", installment: 512.5 },
      [],
      "2026-09-30"
    );
    expect(plan.rows).toHaveLength(10);
    expect(plan.rows[0].number).toBe(1);
    expect(plan.totals.residual).toBe(5000);
    expect(plan.rows[0].installment).toBe(512.5);
    expect(plan.rows[9].residual).toBe(0);
  });
});

describe("buildLoanPlan: eventi di ancoraggio", () => {
  it("un cambio di tasso ricalcola la rata dalle rate successive e lascia intatte le precedenti", () => {
    const before = buildLoanPlan(base, [], "2026-02-01");
    const plan = buildLoanPlan(base, [{ type: "rate_change", date: "2026-06-20", rate: 9 }], "2026-02-01");
    expect(plan.rows.slice(0, 4)).toEqual(before.rows.slice(0, 4));
    expect(plan.rows[4].installment).toBeGreaterThan(before.rows[4].installment);
    expect(plan.rows[4].number).toBe(5);
    expect(plan.rows[11].residual).toBe(0);
    expect(plan.totals.interestRemaining).toBeGreaterThan(before.totals.interestRemaining);
  });
  it("una correzione del residuo impone il residuo dalla rata successiva", () => {
    const plan = buildLoanPlan(base, [{ type: "balance_correction", date: "2026-06-20", amount: 6500 }], "2026-02-01");
    // Le rate 1-4 (fino al 05/06) restano; la rata 5 riparte da 6.500 € su 8 rate.
    expect(plan.rows).toHaveLength(12);
    expect(plan.rows[4].capital + plan.rows[4].interest).toBeCloseTo(plan.rows[4].installment, 2);
    const residualAfterFifth = plan.rows[4].residual;
    expect(residualAfterFifth).toBeLessThan(6500);
    expect(plan.rows[11].residual).toBe(0);
  });
  it("più eventi si applicano in ordine di data, qualunque sia l'ordine in cui arrivano", () => {
    const a = buildLoanPlan(
      base,
      [
        { type: "rate_change", date: "2026-09-01", rate: 8 },
        { type: "rate_change", date: "2026-06-01", rate: 7 },
      ],
      "2026-02-01"
    );
    const b = buildLoanPlan(
      base,
      [
        { type: "rate_change", date: "2026-06-01", rate: 7 },
        { type: "rate_change", date: "2026-09-01", rate: 8 },
      ],
      "2026-02-01"
    );
    expect(a.rows).toEqual(b.rows);
  });
  it("un evento oltre l'ultima rata è ignorato con un avviso", () => {
    const plan = buildLoanPlan(base, [{ type: "rate_change", date: "2030-01-01", rate: 9 }], "2026-02-01");
    expect(plan.warnings[0]).toMatch(/oltre l'ultima rata/);
    expect(plan.rows).toEqual(buildLoanPlan(base, [], "2026-02-01").rows);
  });
});

describe("buildLoanPlan: difese", () => {
  it("ignora un pagamento su una rata inesistente o già pagata", () => {
    const plan = buildLoanPlan(
      base,
      [
        { type: "payment", installmentNumber: 99, date: "2026-03-05", amount: 1 },
        { type: "payment", installmentNumber: 1, date: "2026-03-05", amount: 1000 },
        { type: "payment", installmentNumber: 1, date: "2026-03-06", amount: 2000 },
      ],
      "2026-04-01"
    );
    expect(plan.warnings).toHaveLength(2);
    expect(plan.totals.paidTotal).toBe(1000);
  });
  it("a finanziamento concluso la rata corrente è zero", () => {
    const plan = buildLoanPlan(base, [], "2028-01-01");
    expect(plan.totals.finished).toBe(true);
    expect(plan.totals.currentInstallment).toBe(0);
    expect(plan.totals.residual).toBe(0);
  });
  it("i totali sono coerenti con le righe", () => {
    const plan = buildLoanPlan(base, [], "2026-08-10");
    const interest = plan.rows.reduce((s, r) => s + r.interest, 0);
    expect(plan.totals.interestToDate + plan.totals.interestRemaining).toBeCloseTo(interest, 2);
  });
});

describe("buildLoanPlan: scadenza di oggi", () => {
  it("una rata che scade oggi è ancora da pagare, non scaduta", () => {
    const plan = buildLoanPlan({ ...base, startMode: "fotografia", firstInstallmentDate: "2026-10-01" }, [], "2026-10-01");
    expect(plan.rows[0].status).toBe("da_pagare");
    expect(plan.totals.overdueCount).toBe(0);
    expect(plan.totals.nextDueDate).toBe("2026-10-01");
  });
});
