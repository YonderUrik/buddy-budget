import { describe, expect, it } from "vitest";
import { computeAccountsKpi } from "./accounts-kpi.utils";
import type { Account } from "@/lib/db/schema/accounts";

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    isDemo: false,
    name: "Conto",
    type: "Conto corrente",
    balance: "0.00",
    color: "slate",
    icon: "wallet",
    source: "manuale",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("computeAccountsKpi", () => {
  it("somma i saldi di tutti i conti", () => {
    const accounts = [makeAccount({ balance: "1000.00" }), makeAccount({ balance: "250.50" })];
    expect(computeAccountsKpi(accounts).totalLiquidity).toBe(1250.5);
  });

  it("conta il numero di conti", () => {
    const accounts = [makeAccount({}), makeAccount({}), makeAccount({})];
    expect(computeAccountsKpi(accounts).linkedAccountsCount).toBe(3);
  });

  it("ritorna 0 e 0 per lista vuota", () => {
    const result = computeAccountsKpi([]);
    expect(result.totalLiquidity).toBe(0);
    expect(result.linkedAccountsCount).toBe(0);
  });

  it("include saldi negativi nella somma", () => {
    const accounts = [makeAccount({ balance: "100.00" }), makeAccount({ balance: "-30.00" })];
    expect(computeAccountsKpi(accounts).totalLiquidity).toBe(70);
  });
});
