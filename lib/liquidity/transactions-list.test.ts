import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/db/schema/transactions";
import {
  applyTransactionListFilter,
  compareFeedOrder,
  decodeTransactionCursor,
  encodeTransactionCursor,
  paginateTransactions,
  type TransactionListFilter,
} from "./transactions-list";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tx = (n: number, date: string, amount: string, extra: Partial<Transaction> = {}): Transaction =>
  ({
    id: id(n), userId: "u", accountId: id(100), categoryId: id(200), description: `Movimento ${n}`, rawDescription: null,
    merchantCategoryCode: null, note: null, amount, excludedAmount: "0", categorySource: null, categoryConfidence: null,
    categorizedAt: null, date, source: "manuale", externalId: null, createdAt: new Date(), updatedAt: new Date(), ...extra,
  }) as Transaction;

const ALL: TransactionListFilter = { direction: "tutte", accountId: null, categoryId: null, searchText: "", uncategorizedOnly: false };

describe("transaction cursor", () => {
  it("round-trips and rejects foreign strings", () => {
    const cursor = { date: "2026-10-18", id: id(7) };
    expect(decodeTransactionCursor(encodeTransactionCursor(cursor))).toEqual(cursor);
    expect(decodeTransactionCursor("nope")).toBeNull();
    expect(decodeTransactionCursor(Buffer.from("2026-10-18|x").toString("base64url"))).toBeNull();
  });
});

describe("paginateTransactions", () => {
  const rows = [tx(1, "2026-10-01", "-1"), tx(2, "2026-10-03", "-1"), tx(3, "2026-10-03", "-1"), tx(4, "2026-09-30", "-1"), tx(5, "2026-10-02", "-1")];

  it("orders by date then id, both descending", () => {
    expect([...rows].sort(compareFeedOrder).map((t) => t.id)).toEqual([id(3), id(2), id(5), id(1), id(4)]);
  });

  it("walks every row exactly once across pages, also when a page ends inside a day", () => {
    const seen: string[] = [];
    let cursor = null;
    for (let page = 0; page < 10; page += 1) {
      const result = paginateTransactions(rows, 2, cursor);
      seen.push(...result.items.map((t) => t.id));
      if (!result.nextCursor) break;
      cursor = decodeTransactionCursor(result.nextCursor);
    }
    expect(seen).toEqual([id(3), id(2), id(5), id(1), id(4)]);
  });

  it("has no next cursor on the last page", () => {
    expect(paginateTransactions(rows, 5, null).nextCursor).toBeNull();
    expect(paginateTransactions(rows, 4, null).nextCursor).not.toBeNull();
  });
});

describe("applyTransactionListFilter", () => {
  const fallback = id(299);
  const rows = [
    tx(1, "2026-10-01", "-20.00", { description: "Supermercato Centro" }),
    tx(2, "2026-10-02", "1500.00", { description: "Stipendio", categoryId: id(201) }),
    tx(3, "2026-10-03", "-5.00", { description: "Bar", note: "colazione al SUPERMERCATO", accountId: id(101) }),
    tx(4, "2026-10-04", "-9.00", { description: "???", categoryId: fallback }),
  ];

  it("filters like the Movimenti screen: direction, text in description or note, account, category, to fix", () => {
    const ids = (filter: Partial<TransactionListFilter>) => applyTransactionListFilter(rows, { ...ALL, ...filter }, new Set([fallback])).map((t) => t.id);
    expect(ids({ direction: "entrata" })).toEqual([id(2)]);
    expect(ids({ direction: "uscita" })).toEqual([id(1), id(3), id(4)]);
    expect(ids({ searchText: " supermercato " })).toEqual([id(1), id(3)]);
    expect(ids({ accountId: id(101) })).toEqual([id(3)]);
    expect(ids({ categoryId: id(201) })).toEqual([id(2)]);
    expect(ids({ uncategorizedOnly: true })).toEqual([id(4)]);
    expect(ids({ searchText: "supermercato", direction: "uscita", accountId: id(100) })).toEqual([id(1)]);
  });
});
