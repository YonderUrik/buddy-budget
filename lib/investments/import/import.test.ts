import { describe, expect, it } from "vitest";
import { parseCsv, detectDelimiter } from "./csv";
import { completeMapping, suggestColumns, missingFields } from "./mapping";
import { collectIdentities, normalizeRows } from "./normalize";
import { planImport, type PlannedOperation } from "./plan";
import { detectPreset, initialMapping, templateCsv } from "./presets";
import { detectDateOrder, detectDecimalSeparator, parseDate, parseNumber } from "./values";

const TODAY = "2026-09-28";

// Stesse colonne e particolarità dell'export portafoglio di Yahoo Finance (dati inventati).
const YAHOO_CSV = [
  "Symbol,Current Price,Date,Time,Change,Open,High,Low,Volume,Trade Date,Purchase Price,Quantity,Commission,High Limit,Low Limit,Comment,Transaction Type",
  "SWDA.MI,128.57,2026/09/28,17:35 CEST,-0.35,129.0,129.26,128.54,97349,20260902,126.52,0.001738,,,,,BUY",
  "SWDA.MI,128.57,2026/09/28,17:35 CEST,-0.35,129.0,129.26,128.54,97349,20240301,88.5,12.0,0.0,,,,BUY",
  "ETH-EUR,2362.81,2026/09/28,17:03 UTC,-1.56,2362.07,2369.17,2315.55,13421742080,20260601,0.0,3.0E-4,,,,,BUY",
  "ETH-EUR,2362.81,2026/09/28,17:03 UTC,-1.56,2362.07,2369.17,2315.55,13421742080,20260125,2573.93,0.604,0.0,,,,BUY",
  "BTC-EUR,73538.63,2026/09/28,17:03 UTC,-761.67,74228.17,74553.37,72581.04,35810168832,20260125,14024.91,0.0285,0.0,,,Primo acquisto,SELL",
].join("\n");

describe("parseCsv", () => {
  it("riconosce il punto e virgola, toglie il BOM e gestisce le virgolette", () => {
    const table = parseCsv('﻿Data;Nome;Prezzo\n01/02/2026;"Titolo; con ""virgolette""";1.234,5\n\n');
    expect(table.delimiter).toBe(";");
    expect(table.headers).toEqual(["Data", "Nome", "Prezzo"]);
    expect(table.rows).toEqual([["01/02/2026", 'Titolo; con "virgolette"', "1.234,5"]]);
  });

  it("preferisce la virgola quando dà colonne coerenti", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
  });
});

describe("numeri e date", () => {
  it("legge numeri in formato italiano, inglese e scientifico", () => {
    expect(parseNumber("1.234,56", ",")).toBe(1234.56);
    expect(parseNumber("1,234.56", ".")).toBe(1234.56);
    expect(parseNumber("3.0E-4", ".")).toBe(0.0003);
    expect(parseNumber("€ -12,5", ",")).toBe(-12.5);
    expect(parseNumber("12.50 EUR", ".")).toBe(12.5);
    expect(parseNumber("(3,00)", ",")).toBe(-3);
    expect(parseNumber("abc", ".")).toBeNull();
  });

  it("deduce il separatore decimale dalla colonna", () => {
    expect(detectDecimalSeparator(["12,5", "1.000,25"])).toBe(",");
    expect(detectDecimalSeparator(["126.52", "0.001738", "3.0E-4"])).toBe(".");
    expect(detectDecimalSeparator(["1,000", "2,000"])).toBe(".");
  });

  it("legge le date nei vari ordini e scarta quelle impossibili", () => {
    expect(parseDate("20260105", "ymd")).toBe("2026-01-05");
    expect(parseDate("2026-01-05T10:00:00", "ymd")).toBe("2026-01-05");
    expect(parseDate("05/01/2026", "dmy")).toBe("2026-01-05");
    expect(parseDate("01/05/2026", "mdy")).toBe("2026-01-05");
    expect(parseDate("05.01.26", "dmy")).toBe("2026-01-05");
    expect(parseDate("31/02/2026", "dmy")).toBeNull();
  });

  it("deduce l'ordine delle date, giorno/mese a parità", () => {
    expect(detectDateOrder(["20260105", "20251231"])).toBe("ymd");
    expect(detectDateOrder(["05/01/2026", "06/02/2026"])).toBe("dmy");
    expect(detectDateOrder(["05/01/2026", "12/31/2026"])).toBe("mdy");
  });
});

describe("mappatura", () => {
  it("associa le intestazioni italiane per sinonimo", () => {
    const columns = suggestColumns(["Data operazione", "Segno", "Titolo", "ISIN", "Quantità", "Prezzo eseguito (EUR)", "Commissioni"]);
    expect(columns).toEqual({ date: 0, type: 1, name: 2, isin: 3, quantity: 4, price: 5, fees: 6 });
  });

  it("segnala i campi indispensabili mancanti", () => {
    const table = parseCsv("Nome;Quantità\nA;1");
    expect(missingFields(completeMapping(table, suggestColumns(table.headers)))).toEqual(["la data", "il prezzo o il controvalore"]);
  });

  it("riconosce il formato Yahoo e il modello BuddyBudget", () => {
    expect(detectPreset(parseCsv(YAHOO_CSV).headers)?.id).toBe("yahoo-portfolio");
    expect(detectPreset(parseCsv(templateCsv()).headers)?.id).toBe("buddybudget-template");
    expect(detectPreset(["Data", "Prezzo"])).toBeNull();
  });
});

describe("normalizeRows", () => {
  it("legge l'export di Yahoo: data operazione, notazione scientifica, prezzo zero e vendite", () => {
    const table = parseCsv(YAHOO_CSV);
    const { mapping } = initialMapping(table);
    expect(mapping.columns.date).toBe(9);
    const rows = normalizeRows(table, mapping, TODAY);
    expect(rows.every((r) => r.status === "ok")).toBe(true);
    const [first, , reward, , sale] = rows;
    if (first.status !== "ok" || reward.status !== "ok" || sale.status !== "ok") throw new Error("righe attese valide");
    expect(first.operation).toMatchObject({ type: "acquisto", date: "2026-09-02", quantity: 0.001738, price: 126.52, fees: 0 });
    expect(first.identity).toMatchObject({ key: "symbol:SWDA.MI", symbolIsYahoo: true });
    expect(reward.operation).toMatchObject({ quantity: 0.0003, price: 0 });
    expect(reward.warnings).toEqual(["Prezzo zero: quote ricevute gratis (es. staking)"]);
    expect(sale.operation).toMatchObject({ type: "vendita", note: "Primo acquisto" });
    expect(collectIdentities(rows).map((i) => [i.key, i.count])).toEqual([
      ["symbol:SWDA.MI", 2],
      ["symbol:ETH-EUR", 2],
      ["symbol:BTC-EUR", 1],
    ]);
  });

  it("legge il modello BuddyBudget con dividendo e ISIN come chiave", () => {
    const table = parseCsv(templateCsv());
    const rows = normalizeRows(table, initialMapping(table).mapping, TODAY);
    expect(rows[0]).toMatchObject({ status: "ok", identity: { key: "isin:IE00B4L5Y983" }, operation: { price: 104.5, fees: 2.95 } });
    expect(rows[1]).toMatchObject({ status: "ok", operation: { type: "dividendo", grossAmount: 12.4, taxes: 3.22, quantity: 0 } });
  });

  it("ricava il prezzo dal controvalore, trasforma le quantità negative in vendite e segnala gli errori", () => {
    const table = parseCsv(
      ["Data;Tipo;Simbolo;Quantità;Controvalore", "01/02/2026;;AAA;10;1.000", "02/02/2026;;AAA;-4;480", "03/02/2026;Giroconto;AAA;1;1", "31/12/2099;;AAA;1;1", "04/02/2026;;;1;1", "05/02/2026;;AAA;x;1"].join("\n")
    );
    const mapping = completeMapping(table, suggestColumns(table.headers));
    const rows = normalizeRows(table, mapping, TODAY);
    expect(rows[0]).toMatchObject({ status: "ok", operation: { type: "acquisto", price: 100 } });
    expect(rows[1]).toMatchObject({ status: "ok", operation: { type: "vendita", quantity: 4, price: 120 } });
    expect(rows[2]).toMatchObject({ status: "skipped", message: 'Tipo "Giroconto" ignorato' });
    expect(rows[3]).toMatchObject({ status: "error", message: "Data nel futuro" });
    expect(rows[4]).toMatchObject({ status: "error", message: "Manca lo strumento (simbolo, ISIN o nome)" });
    expect(rows[5]).toMatchObject({ status: "error", message: 'Numero "x" non valido' });
  });
});

describe("planImport", () => {
  const buy = (line: number, date: string, quantity: number, price = 10): PlannedOperation => ({
    line,
    instrumentId: "i1",
    type: "acquisto",
    date,
    quantity,
    price,
    grossAmount: null,
  });

  it("salta le operazioni già salvate contando le ripetizioni", () => {
    const existing = [{ instrumentId: "i1", type: "acquisto" as const, date: "2026-01-01", quantity: "1.0000000000", price: "10.00000000", grossAmount: null }];
    const rows = planImport([buy(2, "2026-01-01", 1), buy(3, "2026-01-01", 1), buy(4, "2026-01-02", 1)], existing);
    expect(rows.map((r) => r.status)).toEqual(["duplicate", "new", "new"]);
  });

  it("blocca una vendita oltre le quote, contando quelle già salvate", () => {
    const existing = [{ instrumentId: "i1", type: "acquisto" as const, date: "2026-01-01", quantity: 2, price: 10, grossAmount: null }];
    const sale = { ...buy(3, "2026-02-01", 3), type: "vendita" as const };
    expect(planImport([buy(2, "2026-03-01", 5), sale], existing)).toEqual([
      { line: 2, status: "new" },
      { line: 3, status: "error", message: "Vende più quote di quelle possedute a quella data" },
    ]);
    expect(planImport([buy(2, "2026-01-15", 5), sale], existing).map((r) => r.status)).toEqual(["new", "new"]);
  });
});
