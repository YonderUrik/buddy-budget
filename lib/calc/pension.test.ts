import { describe, expect, it } from "vitest";
import {
  addMonths,
  companyTfrValue,
  computePensionPerformance,
  deriveContributions,
  exitTaxMilestones,
  exitTaxRate,
  projectPension,
  recentQuarterlyContribution,
  yearlyBreakdown,
  withdrawalScenarios,
  type PensionSnapshot,
} from "./pension";

const snap = (id: string, date: string, netContributions: number, value: number): PensionSnapshot => ({ id, date, netContributions, value });

describe("addMonths", () => {
  it("accorcia il giorno nei mesi più corti", () => {
    expect(addMonths("2022-01-31", 1)).toBe("2022-02-28");
    expect(addMonths("2022-11-15", 3)).toBe("2023-02-15");
  });
});

describe("deriveContributions", () => {
  it("ricava i versamenti dalla differenza dei contributi netti", () => {
    const flows = deriveContributions([snap("a", "2026-01-01", 1000, 1000), snap("b", "2026-04-01", 1300, 1320)], null);
    expect(flows).toEqual([
      { date: "2026-01-01", amount: 1000, estimated: false },
      { date: "2026-04-01", amount: 300, estimated: false },
    ]);
  });

  it("distribuisce lo storico precedente alla prima fotografia tra adesione e prima fotografia", () => {
    const flows = deriveContributions([snap("a", "2023-01-01", 1200, 1250)], "2022-01-01");
    expect(flows).toHaveLength(4);
    expect(flows.every((f) => f.estimated)).toBe(true);
    expect(flows.reduce((s, f) => s + f.amount, 0)).toBeCloseTo(1200, 6);
    expect(flows.at(-1)?.date).toBe("2023-01-01");
  });
});

describe("computePensionPerformance", () => {
  it("restituisce null senza fotografie", () => {
    expect(computePensionPerformance([], null)).toBeNull();
  });

  it("calcola il rendimento ponderato per i tempi: un euro versato ieri non ha reso", () => {
    // 1000 versati un anno fa che valgono 1100, più 1000 versati oggi: il rendimento è ~10%, non 5%.
    const perf = computePensionPerformance(
      [snap("a", "2025-10-01", 1000, 1000), snap("b", "2026-10-01", 2000, 2100)],
      null
    );
    expect(perf?.gain).toBe(100);
    expect(perf?.annualReturn).toBeCloseTo(0.1, 2);
  });

  it("segnala come approssimato il calcolo con storico stimato", () => {
    const perf = computePensionPerformance([snap("a", "2026-10-01", 4000, 4300)], "2022-10-01");
    expect(perf?.approximate).toBe(true);
    expect(perf?.annualReturn).not.toBeNull();
  });
});

describe("exitTaxRate", () => {
  it("resta al 15% fino a 15 anni e scende di 0,30 punti l'anno fino al 9%", () => {
    expect(exitTaxRate(4)).toBeCloseTo(0.15);
    expect(exitTaxRate(15)).toBeCloseTo(0.15);
    expect(exitTaxRate(25)).toBeCloseTo(0.12);
    expect(exitTaxRate(35)).toBeCloseTo(0.09);
    expect(exitTaxRate(50)).toBeCloseTo(0.09);
  });

  it("indica quando l'aliquota comincia a scendere e quando arriva al minimo", () => {
    expect(exitTaxMilestones("2022-03-10")).toEqual({ reductionStartsOn: "2037-03-10", minRateOn: "2057-03-10" });
  });
});

describe("withdrawalScenarios", () => {
  it("dà una forbice: imposta sui soli contributi (alto) contro imposta su tutto il valore (basso)", () => {
    const [pension, health, other] = withdrawalScenarios(10_000, 8_000, "2022-03-10", "2026-10-01");
    expect(pension.rate).toBeCloseTo(0.15);
    expect(pension.netHigh).toBeCloseTo(10_000 - 0.15 * 8_000);
    expect(pension.netLow).toBeCloseTo(10_000 - 0.15 * 10_000);
    expect(health.rate).toBeCloseTo(0.15);
    expect(other.rate).toBeCloseTo(0.23);
    expect(other.netHigh).toBeGreaterThan(other.netLow);
  });

  it("non applica l'imposta su una base maggiore del valore", () => {
    const [pension] = withdrawalScenarios(5_000, 6_000, "2022-03-10", "2026-10-01");
    expect(pension.netHigh).toBeCloseTo(pension.netLow);
  });
});

describe("withdrawalScenarios con anni simulati", () => {
  it("usa gli anni indicati al posto di quelli reali", () => {
    const [real] = withdrawalScenarios(10_000, 8_000, "2022-03-10", "2026-10-01");
    const [simulated] = withdrawalScenarios(10_000, 8_000, "2022-03-10", "2026-10-01", 35);
    expect(real.rate).toBeCloseTo(0.15);
    expect(simulated.rate).toBeCloseTo(0.09);
    expect(simulated.netLow).toBeCloseTo(9_100);
  });
});

describe("companyTfrValue", () => {
  it("rivaluta ogni versamento con 1,5% + 75% dell'inflazione", () => {
    const result = companyTfrValue([{ date: "2025-10-01", amount: 1000, estimated: false }], "2026-10-01", 0.02);
    expect(result.annualRate).toBeCloseTo(0.03);
    expect(result.gross).toBeCloseTo(1030, 0);
    expect(result.net).toBeLessThan(result.gross);
    expect(result.net).toBeGreaterThan(1000);
  });
});

describe("recentQuarterlyContribution", () => {
  it("restituisce null con poco storico", () => {
    expect(recentQuarterlyContribution([snap("a", "2026-06-01", 1000, 1000), snap("b", "2026-09-01", 1300, 1310)])).toBeNull();
  });

  it("stima il versamento trimestrale degli ultimi 12 mesi", () => {
    const value = recentQuarterlyContribution([
      snap("a", "2025-09-01", 1000, 1000),
      snap("b", "2026-03-01", 1600, 1650),
      snap("c", "2026-09-01", 2200, 2290),
    ]);
    expect(value).toBeCloseTo(300, -1);
  });
});

describe("projectPension", () => {
  it("con rendimento zero somma solo i versamenti", () => {
    const points = projectPension({ startValue: 1000, quarterlyContribution: 100, years: 2, rates: { prudent: 0, base: 0, optimistic: 0 } });
    expect(points).toHaveLength(3);
    expect(points[2].base).toBeCloseTo(1000 + 8 * 100);
  });

  it("ordina gli scenari prudente < base < ottimistico", () => {
    const point = projectPension({ startValue: 5000, quarterlyContribution: 400, years: 20, rates: { prudent: 0, base: 0.02, optimistic: 0.04 } }).at(-1)!;
    expect(point.prudent).toBeLessThan(point.base);
    expect(point.base).toBeLessThan(point.optimistic);
  });
});

describe("yearlyBreakdown", () => {
  it("separa versamenti e rendimento per anno, partendo da zero", () => {
    const rows = yearlyBreakdown([
      snap("a", "2024-06-30", 500, 490),
      snap("b", "2024-12-31", 1000, 1010),
      snap("c", "2025-12-31", 2000, 2150),
      snap("d", "2026-03-31", 2250, 2420),
    ]);
    expect(rows.map((r) => r.year)).toEqual([2024, 2025, 2026]);
    expect(rows[0]).toMatchObject({ contributions: 1000, gain: 10, partial: false });
    expect(rows[1]).toMatchObject({ contributions: 1000, gain: 140, endValue: 2150, partial: false });
    expect(rows[2]).toMatchObject({ contributions: 250, gain: 20, partial: true });
  });

  it("calcola il rendimento percentuale sul valore a inizio anno più i versamenti", () => {
    const rows = yearlyBreakdown([snap("b", "2024-12-31", 1000, 1010), snap("c", "2025-12-31", 2000, 2150)]);
    expect(rows[0].returnRate).toBeCloseTo(0.01);
    expect(rows[1].returnRate).toBeCloseTo(140 / 2010);
  });

  it("non calcola la percentuale se la base non è positiva", () => {
    expect(yearlyBreakdown([snap("a", "2024-12-31", 0, 0)])[0].returnRate).toBeNull();
  });

  it("restituisce un elenco vuoto senza fotografie", () => {
    expect(yearlyBreakdown([])).toEqual([]);
  });
});
