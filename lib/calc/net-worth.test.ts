import { describe, expect, it } from "vitest";
import { deriveLiquidityHistory, toDateKey } from "./net-worth";
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: "account-auto",
    userId: "user-1",
    name: "Conto",
    type: "Conto corrente",
    balance: "0.00",
    color: "slate",
    icon: "wallet",
    source: "auto",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-auto",
    categoryId: "category-1",
    description: "Movimento",
    rawDescription: null,
    note: null,
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-09-10",
    source: "auto",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const TODAY = new Date(2026, 8, 13); // 13 settembre 2026

describe("toDateKey", () => {
  it("formatta la data locale come YYYY-MM-DD con zero padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("deriveLiquidityHistory", () => {
  it("non produce punti se non ci sono movimenti su conti Auto", () => {
    const accounts = [makeAccount({ id: "manual", source: "manuale", balance: "500.00" })];
    const transactions = [makeTransaction({ accountId: "manual", date: "2026-09-10" })];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([]);
  });

  it("ricostruisce il saldo di fine giornata sottraendo i movimenti Auto successivi, fino a ieri", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-100.00" }),
      makeTransaction({ date: "2026-09-12", amount: "50.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 950 },
      { date: "2026-09-12", amount: 1000 },
    ]);
  });

  it("i movimenti datati oggi incidono già sul punto di ieri", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-12", amount: "-20.00" }),
      makeTransaction({ date: "2026-09-13", amount: "30.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([{ date: "2026-09-12", amount: 970 }]);
  });

  it("somma i conti manuali come costante e ignora i loro movimenti", () => {
    const accounts = [
      makeAccount({ balance: "1000.00" }),
      makeAccount({ id: "manual", source: "manuale", balance: "200.00" }),
    ];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-100.00" }),
      makeTransaction({ date: "2026-09-12", amount: "50.00" }),
      makeTransaction({ accountId: "manual", date: "2026-09-12", amount: "-999.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 1150 },
      { date: "2026-09-12", amount: 1200 },
    ]);
  });

  it("usa l'importo pieno anche quando la transazione è divisa", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-10.00" }),
      makeTransaction({ date: "2026-09-12", amount: "-100.00", excludedAmount: "-60.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 1100 },
      { date: "2026-09-12", amount: 1000 },
    ]);
  });

  it("limita la ricostruzione a 24 mesi, dal primo giorno del mese", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [makeTransaction({ date: "2023-01-15", amount: "-10.00" })];
    const points = deriveLiquidityHistory(accounts, transactions, TODAY);
    expect(points[0].date).toBe("2024-09-01");
    expect(points[points.length - 1].date).toBe("2026-09-12");
    expect(points.every((p) => p.amount === 1000)).toBe(true);
  });
});
