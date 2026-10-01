import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/db/schema/transactions";
import { describeFilterUsage, rankInstallmentCandidates } from "./transaction-candidates";

function tx(id: string, date: string, amount: string, description = "x", categoryId = "c1"): Transaction {
  return { id, date, amount, description, categoryId, note: null, accountId: "a1" } as Transaction;
}

const list = [
  tx("far", "2026-09-01", "-500", "Mutuo banca", "c2"),
  tx("near", "2026-09-19", "-80", "Spesa", "c1"),
  tx("exact", "2026-09-10", "-500.00", "Rata mutuo", "c2"),
  tx("near2", "2026-09-21", "-50", "Mutuo extra", "c2"),
];

describe("rankInstallmentCandidates", () => {
  it("mette prima l'importo uguale, poi i più vicini alla scadenza", () => {
    const ids = rankInstallmentCandidates(list, { categoryId: null, searchText: "" }, "2026-09-20", 500).map((t) => t.id);
    expect(ids).toEqual(["exact", "far", "near", "near2"]);
  });

  it("filtra per testo e categoria in AND", () => {
    const ids = rankInstallmentCandidates(list, { categoryId: "c2", searchText: "mutuo" }, "2026-09-20", 500).map((t) => t.id);
    expect(ids).toEqual(["exact", "far", "near2"]);
    expect(rankInstallmentCandidates(list, { categoryId: "c1", searchText: "mutuo" }, "2026-09-20", 500)).toEqual([]);
  });
});

describe("describeFilterUsage", () => {
  it("riconosce i filtri attivi", () => {
    expect(describeFilterUsage({ categoryId: null, searchText: " " })).toBe("nessuno");
    expect(describeFilterUsage({ categoryId: null, searchText: "a" })).toBe("testo");
    expect(describeFilterUsage({ categoryId: "c", searchText: "" })).toBe("categoria");
    expect(describeFilterUsage({ categoryId: "c", searchText: "a" })).toBe("entrambi");
  });
});
