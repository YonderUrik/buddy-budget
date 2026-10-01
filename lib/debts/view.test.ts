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

  it("calcola il TAEG con le spese e lo omette per la fotografia di oggi", () => {
    const withCosts = buildDebtsView([debt({ startMode: "nuovo", costs: [{ label: "Istruttoria", amount: 150, kind: "una_tantum" }] })], [], "2026-02-01");
    expect(withCosts.debts[0].apr).toBeGreaterThan(6.17);
    const photo = buildDebtsView([debt({ startMode: "fotografia" })], [], "2026-09-30");
    expect(photo.debts[0].apr).toBeNull();
  });

  it("la serie del residuo complessivo parte dal capitale e finisce a zero", () => {
    const { overview } = buildDebtsView([debt()], [], "2026-09-30");
    expect(overview.residualSeries[0].residual).toBe(12000);
    expect(overview.residualSeries.at(-1)?.residual).toBe(0);
  });
});
