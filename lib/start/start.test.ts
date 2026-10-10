import { describe, expect, it } from "vitest";
import { buildDemoData } from "./demo-data";
import { countDoneSteps, shouldShowChecklist } from "./steps";

describe("buildDemoData", () => {
  const today = new Date(2026, 9, 10);
  const data = buildDemoData(today);

  it("è deterministico e non produce movimenti futuri", () => {
    expect(buildDemoData(today)).toEqual(data);
    expect(data.transactions.every((t) => t.date <= "2026-10-10")).toBe(true);
  });

  it("lo storico finisce oggi con la somma dei saldi dei conti", () => {
    const last = data.liquidityHistory[data.liquidityHistory.length - 1];
    expect(last.date).toBe("2026-10-10");
    expect(last.amount).toBeCloseTo(data.checking.balance + data.savings.balance, 2);
  });

  it("marca i conti come demo nel nome", () => {
    expect(data.checking.name).toMatch(/demo/);
    expect(data.savings.name).toMatch(/demo/);
  });
});

describe("checklist", () => {
  it("conta i passi fatti", () => {
    expect(countDoneSteps({ conto: true, import: false, investimento: true, obiettivo: false })).toBe(2);
  });
  it("si nasconde se chiusa, completa o in demo", () => {
    expect(shouldShowChecklist({ dismissed: false, completed: false, demoActive: false })).toBe(true);
    expect(shouldShowChecklist({ dismissed: true, completed: false, demoActive: false })).toBe(false);
    expect(shouldShowChecklist({ dismissed: false, completed: true, demoActive: false })).toBe(false);
    expect(shouldShowChecklist({ dismissed: false, completed: false, demoActive: true })).toBe(false);
  });
});
