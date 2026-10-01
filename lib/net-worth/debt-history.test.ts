import { describe, expect, it } from "vitest";
import type { Debt, DebtEvent } from "@/lib/db/schema/debts";
import { buildDebtsView } from "@/lib/debts/view";
import { buildDebtHistoryRows } from "./debt-history";

const now = new Date("2026-09-30T10:00:00Z");

const line: Debt = {
  id: "l1", userId: "u1", kind: "credit_line", name: "Lombard", startMode: "nuovo", principal: "10000.00", annualRate: "3.0000",
  installments: 0, firstInstallmentDate: "2026-09-01", installment: null, anchorDate: null, costs: [],
  creditLimit: "50000.00", spread: "2.0000", indexLabel: "Euribor 3M", interestFrequency: "monthly", dayCount: "365",
  capitalizeInterest: false, alertThresholdType: null, alertThresholdValue: null, createdAt: now, updatedAt: now,
};
const draw: DebtEvent = {
  id: "e1", debtId: "l1", userId: "u1", type: "draw", date: "2026-09-10", amount: "5000.00", installmentNumber: null, rate: null,
  penalty: null, effect: null, transactionId: null, note: null, createdAt: now,
};

describe("buildDebtHistoryRows", () => {
  it("senza debiti non produce righe", () => {
    expect(buildDebtHistoryRows(buildDebtsView([], [], "2026-09-30"), "2026-09-30")).toEqual([]);
  });

  it("scrive il debito in negativo, a gradini, dal primo giorno a ieri", () => {
    const rows = buildDebtHistoryRows(buildDebtsView([line], [draw], "2026-09-30"), "2026-09-30");
    expect(rows[0]).toMatchObject({ date: "2026-09-01", amount: "-10000.00", assetClass: "debiti", source: "derivato" });
    expect(rows.find((r) => r.date === "2026-09-09")?.amount).toBe("-10000.00");
    expect(rows.find((r) => r.date === "2026-09-10")?.amount).toBe("-15000.00");
    expect(rows.at(-1)?.date).toBe("2026-09-29");
  });

  it("rispetta l'inizio richiesto", () => {
    const rows = buildDebtHistoryRows(buildDebtsView([line], [draw], "2026-09-30"), "2026-09-30", "2026-09-20");
    expect(rows[0].date).toBe("2026-09-20");
  });
});
