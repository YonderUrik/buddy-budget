import { describe, expect, it } from "vitest";
import type { MonthPace } from "@/lib/calc/month-pace";
import { buildVoiceLines, greetingFor } from "./voice";

const basePace: MonthPace = { spentSoFar: 997, typicalSoFar: 574, income: 0, budgetTotal: null, budgetSpent: 0, dayOfMonth: 6, daysInMonth: 31, current: [], typical: null };
const today = new Date(2026, 9, 6);
const text = (lines: ReturnType<typeof buildVoiceLines>) => lines.map((l) => l.segments.map((s) => s.text).join(""));

describe("buildVoiceLines", () => {
  it("dice quanto sopra il solito e cita scadenza vicina e movimenti", () => {
    const lines = buildVoiceLines({ pace: basePace, monthLabel: "ottobre", currency: "EUR", nextDue: { name: "Prestito auto", date: "2026-10-12", amount: 277 }, uncategorizedCount: 6, today });
    const t = text(lines);
    expect(t[0]).toContain("sopra il solito");
    expect(t[0]).toContain("423");
    expect(t[1]).toContain("scade il 12 ottobre");
    expect(t[2]).toBe("6 movimenti aspettano una categoria.");
  });

  it("senza storico non confronta; scadenze lontane e nessun movimento da categorizzare non compaiono", () => {
    const lines = buildVoiceLines({ pace: { ...basePace, typicalSoFar: null }, monthLabel: "ottobre", currency: "EUR", nextDue: { name: "Mutuo", date: "2026-12-05", amount: 365 }, uncategorizedCount: 0, today });
    expect(lines).toHaveLength(1);
    expect(text(lines)[0]).toContain("finora hai speso");
  });

  it("in linea entro la tolleranza", () => {
    const lines = buildVoiceLines({ pace: { ...basePace, spentSoFar: 580 }, monthLabel: "ottobre", currency: "EUR", nextDue: null, uncategorizedCount: 0, today });
    expect(text(lines)[0]).toContain("in linea");
  });

  it("saluta in base all'ora", () => {
    expect([greetingFor(8), greetingFor(15), greetingFor(21)]).toEqual(["Buongiorno", "Buon pomeriggio", "Buonasera"]);
  });
});
