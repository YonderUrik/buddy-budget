import { describe, expect, it } from "vitest";
import { isQuestion, parseCommand } from "./parse";
import { parseDataQuestion, parseTotalQuestion } from "./question";

// Sunday 25 October 2026.
const TODAY = new Date(2026, 9, 25);
const ask = (text: string) => parseTotalQuestion(text, TODAY);

describe("parseTotalQuestion", () => {
  it("reads what was spent on something in a year or a month", () => {
    expect(ask("soldi spesi su Serenis nel 2026")).toEqual({ kind: "totale", direction: "uscite", subject: "serenis", period: { kind: "anno", from: "2026-01-01", to: "2026-12-31" }, language: "it" });
    expect(ask("quanto ho speso da Esselunga a settembre")).toMatchObject({ subject: "esselunga", period: { kind: "mese", from: "2026-09-01", to: "2026-09-30" } });
    expect(ask("quanto ho speso al bar a novembre")).toMatchObject({ subject: "bar", period: { from: "2025-11-01", to: "2025-11-30" } });
    expect(ask("spese di febbraio 2024")).toMatchObject({ subject: "", period: { kind: "mese", from: "2024-02-01", to: "2024-02-29" } });
  });

  it("reads English and German questions", () => {
    expect(ask("how much did I spend at Amazon last year")).toMatchObject({ direction: "uscite", subject: "amazon", period: { kind: "anno", from: "2025-01-01" }, language: "en" });
    expect(ask("wie viel habe ich bei Rewe 2026 ausgegeben")).toMatchObject({ direction: "uscite", subject: "rewe", period: { from: "2026-01-01" }, language: "de" });
    expect(ask("Einnahmen letzten Monat")).toMatchObject({ direction: "entrate", subject: "", period: { kind: "mese", from: "2026-09-01", to: "2026-09-30" } });
  });

  it("reads income and relative periods, this year by default", () => {
    expect(ask("quanto ho guadagnato quest'anno")).toMatchObject({ direction: "entrate", subject: "", period: { kind: "anno", from: "2026-01-01" } });
    expect(ask("quanto ho pagato Netflix?")).toMatchObject({ subject: "netflix", period: { kind: "anno", from: "2026-01-01" } });
    expect(ask("spesi questo mese su Amazon")).toMatchObject({ subject: "amazon", period: { kind: "mese", from: "2026-10-01" } });
    expect(ask("spese del mese scorso")).toMatchObject({ subject: "", period: { from: "2026-09-01" } });
  });

  it("leaves things to add and plain searches alone", () => {
    expect(ask("pagato 12 € al bar ieri")).toBeNull();
    expect(ask("speso 45,90 da Esselunga")).toBeNull();
    expect(ask("pagato 30 € il 12 ottobre")).toBeNull();
    expect(ask("netflix 2026")).toBeNull();
    expect(ask("pagato netflix")).toBeNull();
    expect(ask("comprato 3 Apple quest'anno")).toBeNull();
  });

  it("is a question for the sentence rules, so no form is offered", () => {
    expect(isQuestion("soldi spesi su Serenis nel 2026")).toBe(true);
    expect(parseCommand("soldi spesi su Serenis nel 2026", TODAY)).toBeNull();
    expect(parseCommand("spese di ottobre", TODAY)).toBeNull();
  });
});

describe("parseDataQuestion", () => {
  const read = (text: string) => parseDataQuestion(text, TODAY);

  it("reads totals first, the examples of the empty panel included", () => {
    expect(read("quanto ho speso a ottobre?")).toMatchObject({ kind: "totale", subject: "", period: { kind: "mese", from: "2026-10-01" } });
    expect(read("how much did I spend in October?")).toMatchObject({ kind: "totale", subject: "", language: "en" });
    expect(read("Wie viel habe ich im Oktober ausgegeben?")).toMatchObject({ kind: "totale", subject: "", language: "de" });
    expect(read("entrate dell'anno scorso")).toMatchObject({ kind: "totale", direction: "entrate", subject: "", period: { from: "2025-01-01" } });
  });

  it("reads balances, net worth, the portfolio and the next instalment in three languages", () => {
    expect(read("saldo Fineco")).toEqual({ kind: "saldo", subject: "fineco", language: "it" });
    expect(read("saldo dei conti")).toMatchObject({ kind: "saldo", subject: "" });
    expect(read("balance of my Revolut account")).toMatchObject({ kind: "saldo", subject: "revolut", language: "en" });
    expect(read("Kontostand")).toMatchObject({ kind: "saldo", subject: "", language: "de" });
    expect(read("patrimonio")).toEqual({ kind: "patrimonio", date: null, language: "it" });
    expect(read("what is my net worth")).toMatchObject({ kind: "patrimonio", language: "en" });
    expect(read("Vermögen")).toMatchObject({ kind: "patrimonio", language: "de" });
    expect(read("portafoglio")).toMatchObject({ kind: "portafoglio", subject: "" });
    expect(read("quanto vale Apple")).toMatchObject({ kind: "portafoglio", subject: "apple" });
    expect(read("how much is VWCE worth")).toMatchObject({ kind: "portafoglio", subject: "vwce", language: "en" });
    expect(read("prossima rata")).toMatchObject({ kind: "rata", language: "it" });
    expect(read("next payment on the mortgage")).toMatchObject({ kind: "rata", language: "en" });
    expect(read("nächste Rate")).toMatchObject({ kind: "rata", language: "de" });
  });

  it("leaves plain searches and sentences with numbers alone", () => {
    expect(read("rate")).toBeNull();
    expect(read("Apple")).toBeNull();
    expect(read("vale la pena")).toBeNull();
    expect(read("saldo 2025 fineco")).toBeNull();
    expect(read("pagato 12 € al bar ieri")).toBeNull();
  });
});
