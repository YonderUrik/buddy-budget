import { describe, expect, it } from "vitest";
import type { Debt, DebtEvent } from "@/lib/db/schema/debts";
import { buildDebtsView } from "@/lib/debts/view";
import { buildDebtHistoryRows } from "./debt-history";

const now = new Date("2026-09-30T10:00:00Z");

const loan: Debt = {
  id: "l1", userId: "u1", kind: "loan", name: "Prestito", startMode: "origine", principal: "12000.00", annualRate: "0.0000",
  installments: 12, firstInstallmentDate: "2026-09-15", installment: null, anchorDate: null, costs: [],
  creditLimit: null, spread: null, indexLabel: null, interestFrequency: null, dayCount: null,
  capitalizeInterest: false, alertThresholdType: null, alertThresholdValue: null, createdAt: now, updatedAt: now,
};
const payment: DebtEvent = {
  id: "e1", debtId: "l1", userId: "u1", type: "payment", date: "2026-09-15", amount: "1000.00", installmentNumber: 1, rate: null,
  penalty: null, effect: null, transactionId: null, note: null, createdAt: now,
};

describe("buildDebtHistoryRows", () => {
  it("senza debiti non produce righe", () => {
    expect(buildDebtHistoryRows(buildDebtsView([], [], "2026-09-30"), "2026-09-30")).toEqual([]);
  });

  it("scrive il debito in negativo, a gradini, dal primo giorno a ieri", () => {
    const rows = buildDebtHistoryRows(buildDebtsView([loan], [payment], "2026-09-30"), "2026-09-30");
    expect(rows[0]).toMatchObject({ date: "2026-08-15", amount: "-12000.00", assetClass: "debiti", source: "derivato" });
    expect(rows.find((r) => r.date === "2026-09-16")?.amount).toBe("-11000.00");
    expect(rows.at(-1)?.date).toBe("2026-09-29");
  });

  it("rispetta l'inizio richiesto", () => {
    const rows = buildDebtHistoryRows(buildDebtsView([loan], [payment], "2026-09-30"), "2026-09-30", "2026-09-20");
    expect(rows[0].date).toBe("2026-09-20");
  });
});
