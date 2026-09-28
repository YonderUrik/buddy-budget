import { describe, expect, it } from "vitest";
import { buildCompositionItems, computeInvestedShare } from "./net-worth-composition-row.utils";
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

const INVESTMENTS = { value: 1500, positions: 3, paid: 1200, marketGain: 300 };

describe("buildCompositionItems", () => {
  it("nessuna voce senza conti", () => {
    expect(buildCompositionItems([])).toEqual([]);
  });

  it("una voce Liquidità con totale, numero di conti e peso pieno, che porta a Conti", () => {
    expect(buildCompositionItems([makeAccount("100.50"), makeAccount("-20.50")])).toEqual([
      { key: "liquidita", label: "Liquidità", detail: "2 conti", amount: 80, share: 1, href: "/conti" },
    ]);
  });

  it("singolare con un solo conto", () => {
    expect(buildCompositionItems([makeAccount("10.00")])[0].detail).toBe("1 conto");
  });

  it("aggiunge gli investimenti col guadagno di mercato, anche senza conti", () => {
    const items = buildCompositionItems([makeAccount("500.00")], INVESTMENTS);
    expect(items[1]).toEqual({
      key: "investimenti",
      label: "Investimenti",
      detail: "3 posizioni",
      amount: 1500,
      share: 0.75,
      href: "/investimenti",
      highlight: { amount: 300, ratio: 0.25, label: "dal mercato" },
    });
    expect(items[0].share).toBe(0.25);
    const onlyInvestments = buildCompositionItems([], { value: 100, positions: 1, paid: 0, marketGain: 100 });
    expect(onlyInvestments.map((i) => [i.key, i.detail, i.highlight?.ratio])).toEqual([["investimenti", "1 posizione", null]]);
  });

  it("una liquidità negativa non ha peso e non falsa quello degli investimenti", () => {
    const items = buildCompositionItems([makeAccount("-200.00")], INVESTMENTS);
    expect(items.map((i) => i.share)).toEqual([0, 1]);
  });
});

describe("computeInvestedShare", () => {
  it("quota investita solo quando ci sono entrambe le classi", () => {
    expect(computeInvestedShare(buildCompositionItems([makeAccount("500.00")], INVESTMENTS))).toBe(0.75);
    expect(computeInvestedShare(buildCompositionItems([makeAccount("500.00")]))).toBeNull();
    expect(computeInvestedShare(buildCompositionItems([], INVESTMENTS))).toBeNull();
  });
});
