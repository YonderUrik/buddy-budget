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
      { key: "liquidita", label: "Liquidità", detail: "2 conti", amount: 80, share: 1, href: "/liquidita/conti" },
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

describe("buildCompositionItems con i debiti", () => {
  it("aggiunge i debiti in negativo senza toccare i pesi né la frase sugli investimenti", () => {
    const accounts = [{ balance: "1000" }] as never;
    const items = buildCompositionItems(accounts, null, { total: 400, count: 2 });
    const debt = items.find((i) => i.key === "debiti");
    expect(debt).toMatchObject({ amount: -400, share: 0, detail: "2 debiti", isLiability: true });
    expect(items.find((i) => i.key === "liquidita")?.share).toBe(1);
    expect(computeInvestedShare(items)).toBeNull();
  });
});

describe("buildCompositionItems con la previdenza", () => {
  const accounts = [{ balance: "600" }] as never;

  it("la conta nelle quote, tra investimenti e debiti", () => {
    const items = buildCompositionItems(accounts, null, null, { value: 400, funds: 1 });
    expect(items.find((i) => i.key === "previdenza")).toMatchObject({ amount: 400, share: 0.4, detail: "1 fondo" });
    expect(items.find((i) => i.key === "liquidita")?.share).toBe(0.6);
  });

  it("se esclusa resta in elenco ma fuori dalle quote", () => {
    const items = buildCompositionItems(accounts, null, null, { value: 400, funds: 2, excluded: true });
    expect(items.find((i) => i.key === "previdenza")).toMatchObject({ amount: 400, share: 0, detail: "2 fondi · fuori dal totale" });
    expect(items.find((i) => i.key === "liquidita")?.share).toBe(1);
  });
});
