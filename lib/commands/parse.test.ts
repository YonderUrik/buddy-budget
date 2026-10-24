import { describe, expect, it } from "vitest";
import { parseCommand, readNumber } from "./parse";
import { missingFields } from "./types";

// Saturday 24 October 2026.
const TODAY = new Date(2026, 9, 24);
const parse = (text: string) => parseCommand(text, TODAY);

describe("parseCommand", () => {
  it("reads an Italian purchase with quantity, price and date", () => {
    expect(parse("comprato 3 Apple a 50 euro oggi")).toMatchObject({ kind: "acquisto", quantity: 3, price: 50, amount: null, subject: "Apple", date: "2026-10-24", language: "it", guessed: false });
    expect(parse("ho comprato 10 azioni VWCE a 112,40 € ieri")).toMatchObject({ kind: "acquisto", quantity: 10, price: 112.4, subject: "VWCE", date: "2026-10-23" });
    expect(parse("acquistato Apple per 150 €")).toMatchObject({ kind: "acquisto", amount: 150, quantity: null, price: null, subject: "Apple" });
  });

  it("reads English and German operations", () => {
    expect(parse("sold 10 VWCE at 110.5 yesterday")).toMatchObject({ kind: "vendita", quantity: 10, price: 110.5, subject: "VWCE", date: "2026-10-23", language: "en" });
    expect(parse("I bought 1,200 shares of Enel at 6.80 on october 12")).toMatchObject({ kind: "acquisto", quantity: 1200, price: 6.8, subject: "Enel", date: "2026-10-12" });
    expect(parse("3 Apple Aktien zu 180 € gekauft")).toMatchObject({ kind: "acquisto", quantity: 3, price: 180, subject: "Apple", language: "de" });
    expect(parse("verkauft 5 SAP zu 1.234,50 € am 12. Oktober")).toMatchObject({ kind: "vendita", quantity: 5, price: 1234.5, subject: "SAP", date: "2026-10-12" });
  });

  it("reads movements and dividends", () => {
    expect(parse("speso 45,90 da Esselunga ieri")).toMatchObject({ kind: "spesa", amount: 45.9, subject: "Esselunga", date: "2026-10-23" });
    expect(parse("pagato 12 € al bar lunedì")).toMatchObject({ kind: "spesa", amount: 12, subject: "Bar", date: "2026-10-19" });
    expect(parse("stipendio 2.300")).toMatchObject({ kind: "entrata", amount: 2300, subject: "Stipendio" });
    expect(parse("gestern 12 € bei Rewe bezahlt")).toMatchObject({ kind: "spesa", amount: 12, subject: "Rewe", date: "2026-10-23", language: "de" });
    expect(parse("received 1,250.00 from Acme on 01/10")).toMatchObject({ kind: "entrata", amount: 1250, subject: "Acme", date: "2026-10-01", language: "en" });
    expect(parse("dividendo Apple 12,40 il 15/09")).toMatchObject({ kind: "dividendo", amount: 12.4, subject: "Apple", date: "2026-09-15" });
    expect(parse("l'altro ieri pagato 30 euro dall'idraulico")).toMatchObject({ kind: "spesa", amount: 30, subject: "Idraulico", date: "2026-10-22" });
  });

  it("guesses a spending from an amount with a currency and a name", () => {
    expect(parse("Netflix 13,99 €")).toMatchObject({ kind: "spesa", amount: 13.99, subject: "Netflix", guessed: true });
  });

  it("leaves plain searches alone", () => {
    expect(parse("netflix")).toBeNull();
    expect(parse("mutuo casa")).toBeNull();
    expect(parse("742,18")).toBeNull();
    expect(parse("VWCE 2024")).toBeNull();
    expect(parse("x".repeat(200) + " comprato 3 Apple")).toBeNull();
  });

  it("keeps the currency written next to a number", () => {
    expect(parse("comprato 3 Apple a 50 euro oggi")?.currency).toBe("EUR");
    expect(parse("bought 2 Apple at $180")).toMatchObject({ quantity: 2, price: 180, currency: "USD", subject: "Apple" });
    expect(parse("comprato 2 Apple a 180 dollari")).toMatchObject({ price: 180, currency: "USD" });
    expect(parse("stipendio 2.300")?.currency).toBeNull();
  });

  it("never dates in the future", () => {
    expect(parse("comprato 3 Apple il 30/12")?.date).toBe("2025-12-30");
  });

  it("lists what is still missing", () => {
    expect(missingFields(parse("comprato Apple oggi")!)).toEqual(["quantita"]);
    expect(missingFields(parse("speso 20 euro")!)).toEqual(["descrizione"]);
    expect(missingFields(parse("dividendo 12 €")!)).toEqual(["titolo"]);
  });
});

describe("readNumber", () => {
  it("follows the sentence's language", () => {
    expect(readNumber("1.200", "it")).toBe(1200);
    expect(readNumber("1.200", "en")).toBe(1.2);
    expect(readNumber("1,200", "en")).toBe(1200);
    expect(readNumber("45,90", "it")).toBe(45.9);
    expect(readNumber("1.234,56", "de")).toBe(1234.56);
    expect(readNumber("99999999", "it")).toBeNull();
  });
});
