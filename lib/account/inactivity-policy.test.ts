import { describe, expect, it } from "vitest";
import { INACTIVITY_DELETE_AFTER_DAYS, INACTIVITY_WARNING_LEAD_DAYS } from "./constants";
import { decideInactivity, deletionDueAt, inactiveDays, parseInactivityMode, warningCutoff, warningDueAt } from "./inactivity-policy";

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-01-01T10:00:00Z");
const after = (from: Date, days: number) => new Date(from.getTime() + days * DAY_MS);

describe("parseInactivityMode", () => {
  it("ricade su dry-run per valori mancanti o sconosciuti, mai su execute", () => {
    expect(parseInactivityMode(undefined)).toBe("dry-run");
    expect(parseInactivityMode("")).toBe("dry-run");
    expect(parseInactivityMode("EXECUTE")).toBe("dry-run");
    expect(parseInactivityMode("true")).toBe("dry-run");
  });
  it("riconosce solo i valori esatti", () => {
    expect(parseInactivityMode("execute")).toBe("execute");
    expect(parseInactivityMode("off")).toBe("off");
    expect(parseInactivityMode("dry-run")).toBe("dry-run");
  });
});

describe("scadenze", () => {
  it("l'avviso parte a 83 giorni e l'eliminazione a 90 (con 7 giorni di preavviso)", () => {
    expect(INACTIVITY_DELETE_AFTER_DAYS - INACTIVITY_WARNING_LEAD_DAYS).toBe(83);
    expect(warningDueAt(T0)).toEqual(after(T0, 83));
    expect(deletionDueAt(T0, after(T0, 83))).toEqual(after(T0, 90));
  });
  it("se l'avviso è in ritardo il preavviso resta di 7 giorni interi", () => {
    expect(deletionDueAt(T0, after(T0, 120))).toEqual(after(T0, 127));
  });
  it("la soglia di pre-selezione coincide con la scadenza dell'avviso", () => {
    expect(warningCutoff(after(T0, 83))).toEqual(T0);
  });
  it("conta i giorni interi di inattività", () => {
    expect(inactiveDays(T0, after(T0, 90.9))).toBe(90);
    expect(inactiveDays(after(T0, 1), T0)).toBe(0);
  });
});

describe("decideInactivity", () => {
  const state = (lastActiveDays: number, warnedDays: number | null) => ({
    lastActiveAt: after(T0, lastActiveDays),
    warnedAt: warnedDays === null ? null : after(T0, warnedDays),
  });

  it("chi è attivo da poco non viene toccato", () => {
    expect(decideInactivity(state(0, null), after(T0, 82.9))).toBe("none");
  });
  it("a 83 giorni senza accessi parte l'avviso", () => {
    expect(decideInactivity(state(0, null), after(T0, 83))).toBe("warn");
  });
  it("non si elimina mai senza avviso, nemmeno dopo 200 giorni (cron fermo a lungo)", () => {
    expect(decideInactivity(state(0, null), after(T0, 200))).toBe("warn");
  });
  it("dopo l'avviso si aspetta il preavviso intero", () => {
    expect(decideInactivity(state(0, 83), after(T0, 89.9))).toBe("none");
    expect(decideInactivity(state(0, 83), after(T0, 90))).toBe("delete");
  });
  it("avvisato in ritardo: si elimina solo 7 giorni dopo l'avviso", () => {
    expect(decideInactivity(state(0, 100), after(T0, 106.9))).toBe("none");
    expect(decideInactivity(state(0, 100), after(T0, 107))).toBe("delete");
  });
  it("un accesso dopo l'avviso annulla tutto", () => {
    expect(decideInactivity(state(86, 83), after(T0, 95))).toBe("returned");
  });
});
