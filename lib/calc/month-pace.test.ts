import { describe, expect, it } from "vitest";
import type { Budget } from "@/lib/db/schema/budgets";
import type { Transaction } from "@/lib/db/schema/transactions";
import { computeMonthPace } from "./month-pace";

function tx(date: string, amount: string, categoryId = "c1"): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "u",
    accountId: "a",
    categoryId,
    description: "x",
    rawDescription: null,
    merchantCategoryCode: null,
    note: null,
    amount,
    excludedAmount: "0.00",
    date,
    source: "manuale",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Transaction;
}

const today = new Date(2026, 9, 6);

describe("computeMonthPace", () => {
  it("confronta lo speso con la media dello stesso tratto dei mesi passati", () => {
    const transactions = [
      tx("2026-10-02", "-100.00"),
      tx("2026-10-05", "2350.00"),
      tx("2026-09-03", "-60.00"),
      tx("2026-09-20", "-500.00"), // dopo il giorno 6: non conta per il confronto
      tx("2026-08-04", "-40.00"),
    ];
    const pace = computeMonthPace(transactions, [], today);
    expect(pace.spentSoFar).toBe(100);
    expect(pace.income).toBe(2350);
    expect(pace.typicalSoFar).toBe(50);
    expect(pace.budgetTotal).toBeNull();
    expect(pace.dayOfMonth).toBe(6);
    expect(pace.daysInMonth).toBe(31);
  });

  it("senza storico non stima il solito", () => {
    expect(computeMonthPace([tx("2026-10-02", "-10.00")], [], today).typicalSoFar).toBeNull();
  });

  it("conta nel budget solo le categorie che ne hanno uno", () => {
    const budgets = [{ categoryId: "c1", monthlyAmount: "300.00" }] as Budget[];
    const pace = computeMonthPace([tx("2026-10-02", "-100.00"), tx("2026-10-03", "-50.00", "c2")], budgets, today);
    expect(pace.budgetTotal).toBe(300);
    expect(pace.budgetSpent).toBe(100);
    expect(pace.spentSoFar).toBe(150);
  });
});
