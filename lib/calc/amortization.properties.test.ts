import { describe, expect, it } from "vitest";
import { buildSegmentSchedule, installmentAmount, round2, solveAnnualRate, solveInstallments } from "./amortization";

/** Generatore pseudo-casuale deterministico (mulberry32), per scenari riproducibili. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = rng(20260930);
const scenarios = Array.from({ length: 40 }, () => ({
  principal: Math.round(1000 + next() * 299000),
  annualRate: Math.round(next() * 1200) / 100,
  installments: Math.round(6 + next() * 354),
  day: 1 + Math.floor(next() * 31),
}));

describe("proprietà del piano su scenari casuali deterministici", () => {
  for (const s of scenarios) {
    const label = `${s.principal} € al ${s.annualRate}% su ${s.installments} rate, giorno ${s.day}`;
    it(label, () => {
      const rows = buildSegmentSchedule({
        firstDueDate: `2026-03-${String(Math.min(s.day, 28)).padStart(2, "0")}`,
        anchorDay: s.day,
        principal: s.principal,
        annualRate: s.annualRate,
        installments: s.installments,
      });
      const capital = round2(rows.reduce((sum, r) => sum + r.capital, 0));
      const interest = round2(rows.reduce((sum, r) => sum + r.interest, 0));
      const paid = round2(rows.reduce((sum, r) => sum + r.installment, 0));
      expect(capital).toBeCloseTo(s.principal, 2);
      expect(paid).toBeCloseTo(s.principal + interest, 2);
      expect(rows[rows.length - 1].residual).toBe(0);
      for (let i = 0; i < rows.length; i++) {
        expect(rows[i].residual).toBeGreaterThanOrEqual(0);
        if (i > 0) expect(rows[i].residual).toBeLessThanOrEqual(rows[i - 1].residual);
        if (i > 0) expect(rows[i].dueDate > rows[i - 1].dueDate).toBe(true);
      }
    });

    it(`solver coerenti: ${label}`, () => {
      const rata = installmentAmount(s.principal, s.annualRate, s.installments);
      // Con la rata arrotondata al centesimo il numero di rate ricavato può essere al massimo uno in più.
      const n = solveInstallments({ principal: s.principal, annualRate: s.annualRate, installment: rata });
      expect([s.installments, s.installments + 1]).toContain(n);
      if (s.annualRate > 0.5) {
        const r = solveAnnualRate({ principal: s.principal, installment: rata, installments: s.installments });
        expect(Math.abs(r - s.annualRate)).toBeLessThan(0.02);
      }
    });
  }
});
