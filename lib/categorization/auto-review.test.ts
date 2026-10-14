import { describe, expect, it } from "vitest";
import { groupAutoCategorized, type AutoCategorizedTransaction } from "./auto-review";
import { countAutoCorrections } from "./auto-corrections";

function row(overrides: Partial<AutoCategorizedTransaction> = {}): AutoCategorizedTransaction {
  return {
    id: "t1",
    description: "NETFLIX.COM",
    amount: -12.99,
    date: "2026-10-01",
    categoryId: "cat-svago",
    source: "assistente",
    confidence: 0.96,
    categorizedAt: "2026-10-02T08:00:00.000Z",
    ...overrides,
  };
}

describe("groupAutoCategorized", () => {
  it("unisce i movimenti dello stesso esercente, categoria e origine con la sicurezza più bassa", () => {
    const [group, ...rest] = groupAutoCategorized([
      row({ id: "a", date: "2026-09-01", confidence: 0.97 }),
      row({ id: "b", date: "2026-10-01", confidence: 0.93, categorizedAt: "2026-10-03T08:00:00.000Z" }),
    ]);
    expect(rest).toHaveLength(0);
    expect(group.transactionIds).toEqual(["b", "a"]);
    expect(group.transactionDates).toEqual(["2026-10-01", "2026-09-01"]);
    expect(group.confidence).toBe(0.93);
    expect(group.totalAmount).toBe(-25.98);
    expect(group.lastCategorizedAt).toBe("2026-10-03T08:00:00.000Z");
  });

  it("tiene separati origini, categorie e direzioni diverse e mette prima l'ultimo applicato", () => {
    const groups = groupAutoCategorized([
      row({ id: "a" }),
      row({ id: "b", source: "regola", confidence: null }),
      row({ id: "c", categoryId: "cat-altro" }),
      row({ id: "d", amount: 12.99, categorizedAt: "2026-10-05T08:00:00.000Z" }),
    ]);
    expect(groups).toHaveLength(4);
    expect(groups[0].transactionIds).toEqual(["d"]);
    expect(groups.find((group) => group.source === "regola")?.confidence).toBeNull();
  });
});

describe("countAutoCorrections", () => {
  it("conta per origine solo i movimenti automatici che cambiano davvero categoria", () => {
    const counts = countAutoCorrections([
      { before: { categoryId: "a", categorySource: "assistente" }, categoryId: "b" },
      { before: { categoryId: "a", categorySource: "assistente" }, categoryId: "a" },
      { before: { categoryId: "a", categorySource: "regola" }, categoryId: "c" },
      { before: { categoryId: "a", categorySource: "utente" }, categoryId: "c" },
      { before: { categoryId: "a", categorySource: null }, categoryId: "c" },
    ]);
    expect(Object.fromEntries(counts)).toEqual({ assistente: 1, regola: 1 });
  });
});
