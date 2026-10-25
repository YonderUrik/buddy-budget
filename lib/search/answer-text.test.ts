import { describe, expect, it } from "vitest";
import { answerLine, answerTitle, isUsefulAnswer } from "./answer-text";
import type { SearchAnswer, SearchHit } from "./types";

const tr = (key: string, values: Record<string, string> = {}) => key.replace(/\{(\d)\}/g, (_, i) => values[i] ?? "");
const hit = (title: string, answer: SearchAnswer): SearchHit & { answer: SearchAnswer } => ({ key: "risposte:x", group: "risposte", icon: "totale", title, score: 3, answer });
const year = { kind: "anno" as const, from: "2026-01-01", to: "2026-12-31" };
const october = { kind: "mese" as const, from: "2026-10-01", to: "2026-10-31" };

describe("answer rows", () => {
  it("names the total and its period, and how many movements it sums", () => {
    const netflix = hit("Netflix", { kind: "totale", source: "regole", direction: "uscite", period: year, count: 10, category: false, partial: false });
    expect(answerTitle(netflix, "it-IT", tr)).toBe("Netflix · 2026");
    expect(answerLine(netflix, "it-IT", "EUR", tr)).toBe("10 movimenti");
    const all = hit("", { kind: "totale", source: "regole", direction: "uscite", period: october, count: 1, category: true, partial: true });
    expect(answerTitle(all, "it-IT", tr)).toBe("Uscite · ottobre 2026");
    expect(answerLine(all, "it-IT", "EUR", tr)).toBe("Categoria · 1 movimento · solo gli ultimi 24 mesi");
    expect(answerTitle(all, "en-GB", tr)).toBe("Uscite · October 2026");
  });

  it("explains an answer without a figure, and only figures stop «Chiedi all'AI»", () => {
    const none = hit("Serenis", { kind: "totale", source: "regole", direction: "uscite", period: year, count: 0, category: false, partial: false });
    expect(answerLine(none, "it-IT", "EUR", tr)).toBe("Nessun movimento");
    expect(isUsefulAnswer(none.answer)).toBe(false);
    const noLoan = hit("", { kind: "rata", source: "regole", date: null, overdue: false });
    expect(answerTitle(noLoan, "it-IT", tr)).toBe("Nessuna rata in arrivo");
    expect(isUsefulAnswer(noLoan.answer)).toBe(false);
    const loan = hit("Mutuo casa", { kind: "rata", source: "ai", date: "2026-11-05", overdue: false });
    expect(answerLine(loan, "it-IT", "EUR", tr)).toBe("Prossima rata il 5 nov 2026");
    expect(isUsefulAnswer(loan.answer)).toBe(true);
  });

  it("writes the gain of a holding with the currency and the net worth on a past day", () => {
    const apple = hit("Apple Inc.", { kind: "portafoglio", source: "regole", gain: -120.5, positions: 1 });
    expect(answerLine(apple, "it-IT", "EUR", tr).replace(/ /g, " ")).toBe("Valore di oggi · perdita 120,50 €");
    const past = hit("", { kind: "patrimonio", source: "ai", date: "2025-12-31", missing: false });
    expect(answerTitle(past, "it-IT", tr)).toBe("Patrimonio netto al 31 dic 2025");
    expect(answerLine(past, "it-IT", "EUR", tr)).toBe("Dallo storico, al netto dei debiti");
  });
});
