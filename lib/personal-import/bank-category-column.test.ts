import { describe, expect, it } from "vitest";
import { fillBankCategories, findCategoryColumns, splitCsvLine } from "./bank-category-column";
import type { Outcome } from "./contract";

const rows = (text: string) => text.split("\n").map((line) => [line]);
const cash = (row: number, bankCategory?: string | null): Outcome => ({ row, kind: "cash", date: "2026-10-01", currency: "EUR", description: "x", amount: -1, transfer: false, ...(bankCategory === undefined ? {} : { bankCategory }) });

describe("splitCsvLine", () => {
  it("honours quotes, escaped quotes and the delimiter", () => {
    expect(splitCsvLine('01/10/2026;"Bar ""Da Mario""; centro";Ristorazione;-12,50', ";")).toEqual(["01/10/2026", 'Bar "Da Mario"; centro', "Ristorazione", "-12,50"]);
  });
});

describe("findCategoryColumns", () => {
  it("finds the header after a preamble, with a subcategory", () => {
    const lines = ["Estratto conto", "Conto: ****", "Data;Descrizione;Categoria;Sottocategoria;Importo", "01/10/2026;Esselunga;Casa;Spesa;-40"];
    expect(findCategoryColumns(lines)).toEqual({ line: 2, delimiter: ";", width: 5, category: 2, subcategory: 3 });
  });

  it("recognises Fineco's Moneymap and German headers", () => {
    expect(findCategoryColumns(["Data,Entrate,Uscite,Descrizione,Stato,Moneymap"])?.category).toBe(5);
    expect(findCategoryColumns(["Buchungstag;Betrag;Kategorie;Verwendungszweck"])?.category).toBe(2);
  });

  it("returns null without a category column", () => {
    expect(findCategoryColumns(["Date,Amount,Description"])).toBeNull();
  });
});

describe("fillBankCategories", () => {
  const table = { rows: rows("Data;Descrizione;Categoria;Importo\n01/10/2026;Pizzeria;Ristorazione;-20\n02/10/2026;\"riga\nspezzata\";Altro;-1\n03/10/2026;Bonifico;;-5") };

  it("fills cash rows from the column and leaves the rest alone", () => {
    const filled = fillBankCategories([{ row: 0, kind: "ignore", reason: "Header" }, cash(1), cash(2), cash(4)], table);
    expect(filled[1]).toMatchObject({ bankCategory: "Ristorazione" });
    expect(filled[2]).not.toHaveProperty("bankCategory");
    expect(filled[3]).not.toHaveProperty("bankCategory");
    expect(filled[0]).toEqual({ row: 0, kind: "ignore", reason: "Header" });
  });

  it("keeps the parser's value", () => {
    expect(fillBankCategories([cash(1, "Food")], table)[0]).toMatchObject({ bankCategory: "Food" });
  });

  it("joins category and subcategory", () => {
    const filled = fillBankCategories([cash(1)], { rows: rows("Data;Descrizione;Categoria;Sottocategoria;Importo\n01/10/2026;Enel;Casa;Bollette;-80") });
    expect(filled[0]).toMatchObject({ bankCategory: "Casa > Bollette" });
  });
});
