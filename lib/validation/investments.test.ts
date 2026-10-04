import { describe, expect, it } from "vitest";
import {
  createInstrumentSchema,
  createInvestmentTransactionSchema,
  isValidIsin,
} from "./investments";

const INSTRUMENT_ID = "00000000-0000-4000-8000-000000000001";

describe("isValidIsin", () => {
  it("accetta ISIN veri e rifiuta cifre di controllo sbagliate", () => {
    expect(isValidIsin("IE00BK5BQT80")).toBe(true);
    expect(isValidIsin("US0378331005")).toBe(true);
    expect(isValidIsin("IT0003128367")).toBe(true);
    expect(isValidIsin("IE00BK5BQT81")).toBe(false);
    expect(isValidIsin("ie00bk5bqt80")).toBe(false);
    expect(isValidIsin("NOTANISIN")).toBe(false);
  });
});

describe("createInstrumentSchema", () => {
  it("normalizza l'ISIN in maiuscolo e lo verifica", () => {
    const parsed = createInstrumentSchema.parse({ source: "isin", isin: " it0003128367 ", name: "ENEL", type: "azione", currency: "EUR" });
    expect(parsed.source === "isin" && parsed.isin).toBe("IT0003128367");
    expect(createInstrumentSchema.safeParse({ source: "isin", isin: "IT0003128368", name: "X", type: "azione", currency: "EUR" }).success).toBe(false);
  });

  it("rifiuta valute non ISO", () => {
    expect(createInstrumentSchema.safeParse({ source: "manuale", name: "X", type: "fondo", currency: "euro" }).success).toBe(false);
  });
});

describe("createInvestmentTransactionSchema", () => {
  it("un acquisto vuole quantità e prezzo positivi", () => {
    const result = createInvestmentTransactionSchema.safeParse({ instrumentId: INSTRUMENT_ID, type: "acquisto", date: "2026-09-25", quantity: 0, price: 10 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["quantity"]);
  });

  it("un dividendo vuole l'importo lordo, non quantità e prezzo", () => {
    expect(createInvestmentTransactionSchema.safeParse({ instrumentId: INSTRUMENT_ID, type: "dividendo", date: "2026-09-25", grossAmount: 12.5 }).success).toBe(true);
    expect(createInvestmentTransactionSchema.safeParse({ instrumentId: INSTRUMENT_ID, type: "cedola", date: "2026-09-25" }).success).toBe(false);
  });

  it("applica i default di commissioni e imposte e svuota la nota vuota", () => {
    const parsed = createInvestmentTransactionSchema.parse({ instrumentId: INSTRUMENT_ID, type: "acquisto", date: "2026-09-25", quantity: 1.5, price: 10, note: "" });
    expect([parsed.fees, parsed.taxes, parsed.note]).toEqual([0, 0, null]);
  });
});
