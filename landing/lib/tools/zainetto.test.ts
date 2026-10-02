import { describe, expect, it } from "vitest";
import { computeZainetto } from "./zainetto";

describe("computeZainetto", () => {
  it("compensa prima la minusvalenza più vecchia e lascia il resto", () => {
    const r = computeZainetto({ taxYear: 2026, gain: 3000, instrument: "azioni_etf", losses: [{ year: 2025, amount: 2000 }, { year: 2023, amount: 1500 }] });
    expect(r.losses.map((l) => [l.year, l.used])).toEqual([[2023, 1500], [2025, 1500]]);
    expect(r.taxableGain).toBe(0);
    expect(r.taxSaved).toBeCloseTo(780);
    expect(r.remaining).toBe(500);
  });
  it("non usa le minusvalenze scadute (oltre il quarto anno)", () => {
    const r = computeZainetto({ taxYear: 2026, gain: 1000, instrument: "azioni_etf", losses: [{ year: 2021, amount: 5000 }, { year: 2022, amount: 400 }] });
    expect(r.losses[0]).toMatchObject({ year: 2021, expired: true, used: 0 });
    expect(r.losses[1]).toMatchObject({ year: 2022, expired: false, used: 400, expiresYear: 2026 });
    expect(r.tax).toBeCloseTo(156);
    expect(r.remaining).toBe(0);
  });
  it("applica l'aliquota dei titoli di Stato e ignora una plusvalenza negativa", () => {
    expect(computeZainetto({ taxYear: 2026, gain: 1000, instrument: "titoli_stato", losses: [] }).tax).toBeCloseTo(125);
    expect(computeZainetto({ taxYear: 2026, gain: -50, instrument: "azioni_etf", losses: [] }).tax).toBe(0);
  });
});
