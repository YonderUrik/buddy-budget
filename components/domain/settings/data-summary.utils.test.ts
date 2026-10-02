import { describe, expect, it } from "vitest";
import { dataSummaryItems } from "./data-summary.utils";

describe("dataSummaryItems", () => {
  it("usa il singolare solo per 1 e mantiene le voci a zero", () => {
    const items = dataSummaryItems({
      accounts: 1,
      bankConnections: 0,
      transactions: 2,
      categories: 33,
      rules: 1,
      budgets: 0,
      investmentOperations: 1,
      investmentPlans: 2,
      debts: 3,
      pensionFunds: 1,
      netWorthDays: 1,
    });
    expect(items.map((i) => `${i.value} ${i.label}`)).toEqual([
      "1 conto",
      "0 banche collegate",
      "2 transazioni",
      "33 categorie",
      "1 regola di categorizzazione",
      "0 budget",
      "1 operazione di investimento",
      "2 piani di accumulo",
      "3 debiti",
      "1 fondo pensione",
      "1 giorno di storico del patrimonio",
    ]);
  });
});
