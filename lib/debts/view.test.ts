import { describe, expect, it } from "vitest";
import type { Debt, DebtEvent } from "@/lib/db/schema/debts";
import { buildDebtsView } from "./view";

const now = new Date("2026-09-30T10:00:00Z");

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: "d1",
    userId: "u1",
    kind: "loan",
    name: "Prestito",
    startMode: "origine",
    principal: "12000.00",
    annualRate: "6.0000",
    installments: 12,
    firstInstallmentDate: "2026-03-05",
    installment: null,
    anchorDate: null,
    costs: [],
    creditLimit: null, spread: null, indexLabel: null, interestFrequency: null, dayCount: null, capitalizeInterest: null, alertThresholdType: null, alertThresholdValue: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function event(overrides: Partial<DebtEvent>): DebtEvent {
  return {
    id: crypto.randomUUID(),
    debtId: "d1",
    userId: "u1",
    type: "payment",
    date: "2026-03-05",
    amount: "1000.00",
    installmentNumber: 1,
    rate: null,
    penalty: null,
    effect: null,
    transactionId: null,
    note: null,
    createdAt: now,
    ...overrides,
  };
}

describe("buildDebtsView", () => {
  it("senza debiti la panoramica è vuota", () => {
    const view = buildDebtsView([], [], "2026-09-30");
    expect(view.debts).toEqual([]);
    expect(view.overview.openCount).toBe(0);
    expect(view.overview.debtFreeDate).toBeNull();
    expect(view.overview.totalResidual).toBe(0);
  });

  it("calcola residuo, rata e data di fine di un debito aperto", () => {
    const { overview, debts } = buildDebtsView([debt()], [], "2026-09-30");
    expect(overview.openCount).toBe(1);
    expect(overview.debtFreeDate).toBe("2027-02-05");
    expect(overview.totalResidual).toBe(debts[0].plan.totals.residual);
    expect(overview.monthlyPayment).toBeGreaterThan(1000);
  });

  it("un debito estinto non conta come aperto ma i suoi interessi restano nel totale pagato", () => {
    const { overview } = buildDebtsView([debt()], [], "2028-01-01");
    expect(overview.openCount).toBe(0);
    expect(overview.totalResidual).toBe(0);
    expect(overview.monthlyPayment).toBe(0);
    expect(overview.interestToDate).toBeGreaterThan(300);
  });

  it("somma due debiti e ordina le prossime scadenze per data", () => {
    const a = debt();
    const b = debt({ id: "d2", name: "Auto", firstInstallmentDate: "2026-10-01", principal: "5000.00", installments: 10 });
    const { overview } = buildDebtsView([a, b], [], "2026-09-30");
    // Le rate passate del prestito sono da confermare: la prossima da pagare è il 5 ottobre, quella dell'auto l'1 ottobre.
    expect(overview.nextDue.map((d) => d.name)).toEqual(["Auto", "Prestito"]);
    expect(overview.nextDue[0].date <= overview.nextDue[1].date).toBe(true);
    expect(overview.totalResidual).toBeGreaterThan(5000);
  });

  it("segnala una rata scaduta nelle prossime scadenze", () => {
    const { overview } = buildDebtsView([debt({ startMode: "nuovo" })], [], "2026-04-10");
    expect(overview.nextDue[0]).toMatchObject({ date: "2026-03-05", overdue: true });
  });

  it("applica gli eventi: pagamento reale e cambio tasso", () => {
    const events = [
      event({ installmentNumber: 1, amount: "1035.50" }),
      event({ type: "rate_change", date: "2026-06-20", amount: null, installmentNumber: null, rate: "9.0000" }),
    ];
    const { debts } = buildDebtsView([debt()], events, "2026-09-30");
    expect(debts[0].plan.rows[0].status).toBe("pagata");
    expect(debts[0].plan.rows[0].payment?.amount).toBe(1035.5);
    expect(debts[0].plan.rows[5].installment).toBeGreaterThan(debts[0].plan.rows[0].installment);
    expect(debts[0].events).toHaveLength(2);
  });

  it("calcola il TAEG con le spese, e per la fotografia di oggi quello di ciò che resta", () => {
    const withCosts = buildDebtsView([debt({ startMode: "nuovo", costs: [{ label: "Istruttoria", amount: 150, kind: "una_tantum" }] })], [], "2026-02-01");
    expect(withCosts.debts[0].apr).toBeGreaterThan(6.17);
    const photo = buildDebtsView([debt({ startMode: "fotografia" })], [], "2026-09-30");
    expect(photo.debts[0].apr).toBeGreaterThan(6);
    expect(photo.debts[0].apr).toBeLessThan(6.5);
  });

  it("il TAEG medio pesa sul residuo", () => {
    const cheap = debt({ id: "a", annualRate: "2.0000", principal: "20000.00", startMode: "fotografia", firstInstallmentDate: "2026-10-05", installments: 24 });
    const dear = debt({ id: "b", annualRate: "10.0000", principal: "2000.00", startMode: "fotografia", firstInstallmentDate: "2026-10-05", installments: 24 });
    const { overview } = buildDebtsView([cheap, dear], [], "2026-09-30");
    expect(overview.weightedApr).toBeGreaterThan(2.5);
    expect(overview.weightedApr).toBeLessThan(4);
    expect(buildDebtsView([], [], "2026-09-30").overview.weightedApr).toBeNull();
  });

  it("la serie del residuo complessivo parte da oggi con il residuo di oggi e finisce a zero", () => {
    const { overview } = buildDebtsView([debt()], [], "2026-09-30");
    expect(overview.residualSeries[0]).toEqual({ date: "2026-09-30", residual: overview.totalResidual });
    expect(overview.residualSeries.at(-1)?.residual).toBe(0);
    expect(overview.residualSeries.every((p, i, all) => i === 0 || p.date > all[i - 1].date)).toBe(true);
  });

  describe("linee di credito", () => {
    const line = (overrides: Partial<Debt> = {}) =>
      debt({
        id: "l1",
        kind: "credit_line",
        name: "Lombard",
        principal: "10000.00",
        annualRate: "3.0000",
        installments: 0,
        firstInstallmentDate: "2026-01-01",
        creditLimit: "50000.00",
        spread: "2.0000",
        indexLabel: "Euribor 3M",
        interestFrequency: "monthly",
        dayCount: "365",
        capitalizeInterest: false,
        ...overrides,
      });

    it("sono separate dai finanziamenti e l'utilizzato entra nel debito totale", () => {
      const { debts, creditLines, overview } = buildDebtsView([debt({ startMode: "fotografia", firstInstallmentDate: "2026-10-05" }), line()], [], "2026-09-30");
      expect(debts).toHaveLength(1);
      expect(creditLines).toHaveLength(1);
      expect(overview.creditUsed).toBe(10000);
      expect(overview.creditLimit).toBe(50000);
      expect(overview.totalDebt).toBeCloseTo(overview.totalResidual + 10000, 2);
      expect(overview.creditLineCount).toBe(1);
      expect(overview.creditMonthlyCost).toBe(41.67);
    });

    it("applica gli eventi della linea e ignora quelli dei finanziamenti", () => {
      const events = [
        event({ id: "e1", debtId: "l1", type: "draw", amount: "5000.00", installmentNumber: null, date: "2026-02-01" }),
        event({ id: "e2", debtId: "l1", type: "rate_change", amount: null, rate: "4.0000", installmentNumber: null, date: "2026-03-01" }),
      ];
      const view = buildDebtsView([line()], events, "2026-09-30").creditLines[0];
      expect(view.plan.used).toBe(15000);
      expect(view.plan.currentRate).toBe(6);
      expect(view.events).toHaveLength(2);
    });

    it("scatta l'allerta alla soglia dell'utente e sale nel riepilogo; senza soglia non scatta mai", () => {
      const withThreshold = buildDebtsView([line({ alertThresholdType: "percent", alertThresholdValue: "20.00" })], [], "2026-09-30");
      expect(withThreshold.creditLines[0].alertTriggered).toBe(true);
      expect(withThreshold.overview.creditAlerts).toEqual([{ debtId: "l1", name: "Lombard" }]);
      const noThreshold = buildDebtsView([line()], [], "2026-09-30");
      expect(noThreshold.creditLines[0].alertTriggered).toBe(false);
      const above = buildDebtsView([line({ alertThresholdType: "amount", alertThresholdValue: "20000.00" })], [], "2026-09-30");
      expect(above.creditLines[0].alertTriggered).toBe(false);
    });

    it("la serie del debito complessivo tiene l'utilizzato delle linee costante", () => {
      const { overview } = buildDebtsView([debt({ startMode: "fotografia", firstInstallmentDate: "2026-10-05", installments: 6 }), line()], [], "2026-09-30");
      expect(overview.residualSeries.at(-1)?.residual).toBe(10000);
      expect(overview.residualSeries[0].residual).toBeCloseTo(overview.totalDebt, 2);
    });
  });
});
