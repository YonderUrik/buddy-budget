import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_TEXTS, translateDemoText } from "./demo-data";
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

  it("writes texts in the interface language and keeps amounts and dates identical", () => {
    for (const language of ["en", "de"] as const) {
      const localized = buildDemoData(today, language);
      expect(localized.checking.name).toBe(DEMO_TEXTS[language].checking);
      const shape = (t: { category: string; amount: number; date: string }) => [t.category, t.amount, t.date];
      expect(localized.transactions.map(shape)).toEqual(data.transactions.map(shape));
      expect(localized.liquidityHistory).toEqual(data.liquidityHistory);
      const allowed = new Set(Object.values(DEMO_TEXTS[language]));
      expect(localized.transactions.every((t) => allowed.has(t.description))).toBe(true);
    }
  });

  it("uses language-independent category keys", () => {
    expect(new Set(data.transactions.map((t) => t.category))).toEqual(
      new Set(["stipendio", "risparmio", "affitto", "bollette", "spesa", "trasporti", "ristoranti", "abbonamenti", "benessere", "shopping"])
    );
  });

  it("translates only texts the demo wrote", () => {
    expect(translateDemoText("Affitto", "de")).toBe("Miete");
    expect(translateDemoText("Current account · demo", "it")).toBe("Conto corrente · demo");
    expect(translateDemoText("Affitto di ottobre", "en")).toBeNull();
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
