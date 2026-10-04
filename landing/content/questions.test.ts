import { describe, expect, it } from "vitest";
import { EARLY_REPAYMENT_SAVING, FIRE_NUMBER, QUESTIONS, ZAINO_SAVING } from "./questions";
import { SCREENS } from "./screens";

describe("domande della home", () => {
  it("hanno id unici e puntano a schermate esistenti", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS) expect(SCREENS.map((s) => s.id), q.id).toContain(q.screen);
  });

  it("le cifre sono quelle verificabili a mano o con gli strumenti pubblici", () => {
    expect(ZAINO_SAVING).toBe(312);
    expect(FIRE_NUMBER).toBe(857143);
    expect(EARLY_REPAYMENT_SAVING).toBe(9611);
  });

  it("ogni risposta dichiara il suo limite", () => {
    for (const q of QUESTIONS) expect(q.note.length, q.id).toBeGreaterThan(0);
  });
});
