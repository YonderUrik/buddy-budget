import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { essentialSpendingFrom } from "./essential";

const cat = (id: string, type: string, isFallback = false) => ({ id, type, isFallback }) as unknown as Category;
const categories = [cat("casa", "dovuta"), cat("auto", "saltuaria"), cat("cene", "voluta"), cat("altro", "voluta", true), cat("giro", "trasferimento")];
let n = 0;
const tx = (date: string, amount: number, categoryId: string | null) =>
  ({ id: `t${n++}`, date, amount: String(amount), excludedAmount: "0", categoryId }) as unknown as Transaction;
const today = new Date(2026, 9, 15);

describe("essentialSpendingFrom", () => {
  it("fa la media delle spese dovute e saltuarie sui mesi chiusi, dal primo con uscite", () => {
    const transactions = [
      tx("2026-08-03", -1000, "casa"),
      tx("2026-08-20", -200, "auto"),
      tx("2026-09-03", -1000, "casa"),
      tx("2026-09-10", -400, "cene"),
      tx("2026-10-02", -5000, "casa"), // mese in corso: fuori
      tx("2026-09-12", -3000, "giro"), // trasferimento: fuori
      tx("2026-09-15", 2500, "casa"), // entrata: fuori
    ];
    expect(essentialSpendingFrom({ transactions, categories, today })).toEqual({ monthly: 1100, basis: "dovute", months: 2 });
  });

  it("usa tutte le uscite se più di un quarto è senza categoria", () => {
    const transactions = [tx("2026-09-03", -1000, "casa"), tx("2026-09-04", -500, null), tx("2026-09-05", -500, "altro")];
    expect(essentialSpendingFrom({ transactions, categories, today })).toEqual({ monthly: 2000, basis: "tutte", months: 1 });
  });

  it("con il solo mese in corso usa quello", () => {
    const transactions = [tx("2026-10-01", -800, "casa")];
    expect(essentialSpendingFrom({ transactions, categories, today })).toEqual({ monthly: 800, basis: "dovute", months: 1 });
  });

  it("senza uscite non propone nulla, e guarda solo gli ultimi 12 mesi", () => {
    expect(essentialSpendingFrom({ transactions: [], categories, today })).toBeNull();
    expect(essentialSpendingFrom({ transactions: [tx("2025-09-30", -900, "casa")], categories, today })).toBeNull();
  });

  it("senza spese dovute usa tutte le uscite", () => {
    const transactions = [tx("2026-09-03", -600, "cene")];
    expect(essentialSpendingFrom({ transactions, categories, today })).toEqual({ monthly: 600, basis: "tutte", months: 1 });
  });
});
