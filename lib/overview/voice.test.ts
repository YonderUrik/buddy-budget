import { describe, expect, it } from "vitest";
import type { MonthPace } from "@/lib/calc/month-pace";
import { buildVoiceLines, greetingFor } from "./voice";

const basePace: MonthPace = { spentSoFar: 997, typicalSoFar: 574, income: 0, budgetTotal: null, budgetSpent: 0, dayOfMonth: 6, daysInMonth: 31, current: [], typical: null };
const today = new Date(2026, 9, 6);
// Currency formatting uses non-breaking spaces: compare with plain ones.
const text = (lines: ReturnType<typeof buildVoiceLines>) => lines.map((l) => l.segments.map((s) => s.text).join("").replace(/\s/g, " "));

describe("buildVoiceLines", () => {
  it("says how far above the usual the month is, and the instalment due soon, one short line each", () => {
    const lines = buildVoiceLines({ pace: basePace, monthLabel: "ottobre", currency: "EUR", nextDue: { name: "Prestito auto", date: "2026-10-12", amount: 277 }, today });
    const t = text(lines);
    expect(t[0]).toBe("Ottobre: 997 € spesi, +423 € sul solito");
    expect(lines[0].segments.find((s) => s.tone)?.tone).toBe("neg");
    expect(t[1]).toBe("Rata Prestito auto: 277 € il 12 ottobre");
  });

  it("without history it does not compare; far instalments are left out", () => {
    const lines = buildVoiceLines({ pace: { ...basePace, typicalSoFar: null }, monthLabel: "ottobre", currency: "EUR", nextDue: { name: "Mutuo", date: "2026-12-05", amount: 365 }, today });
    expect(lines).toHaveLength(1);
    expect(text(lines)[0]).toBe("Ottobre: 997 € spesi");
  });

  it("says nothing about the month with no spending and no history (a new user)", () => {
    const lines = buildVoiceLines({ pace: { ...basePace, spentSoFar: 0, typicalSoFar: null }, monthLabel: "ottobre", currency: "EUR", nextDue: null, today });
    expect(lines).toHaveLength(0);
  });

  it("says «come al solito» within the tolerance, and colours a month below the usual as positive", () => {
    const inLine = buildVoiceLines({ pace: { ...basePace, spentSoFar: 580 }, monthLabel: "ottobre", currency: "EUR", nextDue: null, today });
    expect(text(inLine)[0]).toBe("Ottobre: 580 € spesi, come al solito");
    const below = buildVoiceLines({ pace: { ...basePace, spentSoFar: 400 }, monthLabel: "ottobre", currency: "EUR", nextDue: null, today });
    expect(text(below)[0]).toBe("Ottobre: 400 € spesi, −174 € sul solito");
    expect(below[0].segments.find((s) => s.tone)?.tone).toBe("pos");
  });

  it("says when an instalment is due today or overdue, and translates the lines", () => {
    const due = (date: string) => text(buildVoiceLines({ pace: basePace, monthLabel: "ottobre", currency: "EUR", nextDue: { name: "Mutuo", date, amount: 365 }, today }))[1];
    expect(due("2026-10-06")).toBe("Rata Mutuo: 365 € oggi");
    expect(due("2026-10-01")).toBe("Rata Mutuo: 365 €, scaduta");
    const en = text(buildVoiceLines({ language: "en", pace: basePace, monthLabel: "october", currency: "EUR", nextDue: { name: "Mortgage", date: "2026-10-12", amount: 365 }, today }));
    expect(en[0]).toContain("spent");
    expect(en[1]).toContain("Mortgage");
  });

  it("saluta in base all'ora", () => {
    expect([greetingFor(8), greetingFor(15), greetingFor(21)]).toEqual(["Buongiorno", "Buon pomeriggio", "Buonasera"]);
  });
});
