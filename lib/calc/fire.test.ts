import { describe, expect, it } from "vitest";
import {
  coastNumber,
  fireNumber,
  fireNumberAfterTax,
  leanSpending,
  monthsOfCoverage,
  savingsRate,
  sensitivityBySpendingAndSaving,
  sensitivityByRateAndReturn,
  wealthAfterYears,
  yearsToTarget,
} from "./fire";

describe("fireNumber", () => {
  it("divide la spesa per il tasso di prelievo", () => {
    expect(fireNumber(24_000, 0.04)).toBeCloseTo(600_000);
    expect(fireNumber(24_000, 0.03)).toBeCloseTo(800_000);
  });
  it("rifiuta tassi nulli e spese negative", () => {
    expect(fireNumber(24_000, 0)).toBeNull();
    expect(fireNumber(-1, 0.04)).toBeNull();
  });
});

describe("fireNumberAfterTax", () => {
  it("maggiora il traguardo della quota che va in imposte", () => {
    expect(fireNumberAfterTax(600_000, 0.1)).toBeCloseTo(666_666.67, 1);
  });
  it("senza imposte non cambia e rifiuta quote impossibili", () => {
    expect(fireNumberAfterTax(600_000, 0)).toBe(600_000);
    expect(fireNumberAfterTax(600_000, 1)).toBeNull();
    expect(fireNumberAfterTax(600_000, -0.1)).toBeNull();
  });
});

describe("yearsToTarget", () => {
  it("è zero se hai già raggiunto il traguardo", () => {
    expect(yearsToTarget({ current: 700_000, annualSaving: 0, realReturn: 0.03 }, 600_000)).toBe(0);
  });
  it("coincide con la simulazione anno per anno", () => {
    const input = { current: 100_000, annualSaving: 20_000, realReturn: 0.04 };
    const years = yearsToTarget(input, 600_000)!;
    expect(wealthAfterYears(input, years)).toBeCloseTo(600_000, 0);
  });
  it("senza rendimento è una divisione", () => {
    expect(yearsToTarget({ current: 100_000, annualSaving: 25_000, realReturn: 0 }, 600_000)).toBeCloseTo(20);
  });
  it("solo rendimento composto, senza versamenti", () => {
    expect(yearsToTarget({ current: 100_000, annualSaving: 0, realReturn: 0.05 }, 200_000)).toBeCloseTo(Math.log(2) / Math.log(1.05), 6);
  });
  it("restituisce null se non ci si arriva mai", () => {
    expect(yearsToTarget({ current: 100_000, annualSaving: 0, realReturn: 0 }, 200_000)).toBeNull();
    expect(yearsToTarget({ current: 100_000, annualSaving: -20_000, realReturn: 0.02 }, 200_000)).toBeNull();
    expect(yearsToTarget({ current: 0, annualSaving: 100, realReturn: 0 }, 1_000_000)).toBeNull();
  });
});

describe("coastNumber", () => {
  it("è il traguardo scontato del rendimento sugli anni rimasti", () => {
    expect(coastNumber(600_000, 0.03, 20)).toBeCloseTo(600_000 / 1.03 ** 20, 6);
    expect(coastNumber(600_000, 0.03, 0)).toBe(600_000);
  });
  it("lasciando crescere il coast number senza versare si arriva al traguardo", () => {
    const coast = coastNumber(600_000, 0.03, 20);
    expect(wealthAfterYears({ current: coast, annualSaving: 0, realReturn: 0.03 }, 20)).toBeCloseTo(600_000, 4);
  });
});

describe("leanSpending", () => {
  it("somma dovute e saltuarie", () => {
    expect(leanSpending({ dovuta: 12_000, saltuaria: 1_500 })).toBe(13_500);
  });
});

describe("sensibilità", () => {
  it("più alto è il tasso di prelievo, meno anni servono", () => {
    const grid = sensitivityByRateAndReturn({
      annualSpending: 24_000,
      current: 100_000,
      annualSaving: 15_000,
      withdrawalRates: [0.03, 0.04],
      realReturns: [0.03],
    });
    expect(grid[1][0].years!).toBeLessThan(grid[0][0].years!);
  });
  it("spendere meno accorcia il percorso più che risparmiare di più la stessa cifra", () => {
    const grid = sensitivityBySpendingAndSaving({
      annualSpending: 24_000,
      withdrawalRate: 0.04,
      realReturn: 0.03,
      current: 100_000,
      annualSaving: 15_000,
      spendingChanges: [-0.1, 0],
      savingChanges: [0],
    });
    expect(grid[0][0].years!).toBeLessThan(grid[1][0].years!);
  });
});

describe("indicatori semplici", () => {
  it("tasso di risparmio", () => {
    expect(savingsRate(3_000, 2_250)).toBeCloseTo(0.25);
    expect(savingsRate(0, 100)).toBeNull();
  });
  it("mesi di copertura", () => {
    expect(monthsOfCoverage(12_000, 2_000)).toBe(6);
    expect(monthsOfCoverage(12_000, 0)).toBeNull();
  });
});
