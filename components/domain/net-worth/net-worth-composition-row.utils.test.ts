import { describe, expect, it } from "vitest";
import { buildCompositionItems } from "./net-worth-composition-row.utils";
import type { Account } from "@/lib/db/schema/accounts";

function makeAccount(balance: string): Account {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    name: "Conto",
    type: "Conto corrente",
    balance,
    color: "slate",
    icon: "wallet",
    source: "manuale",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("buildCompositionItems", () => {
  it("nessuna voce senza conti", () => {
    expect(buildCompositionItems([])).toEqual([]);
  });

  it("una voce Liquidità con totale e numero di conti, che porta a Conti", () => {
    expect(buildCompositionItems([makeAccount("100.50"), makeAccount("-20.50")])).toEqual([
      { key: "liquidita", label: "Liquidità", detail: "2 conti", amount: 80, href: "/conti" },
    ]);
  });

  it("singolare con un solo conto", () => {
    expect(buildCompositionItems([makeAccount("10.00")])[0].detail).toBe("1 conto");
  });
});
