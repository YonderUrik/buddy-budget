import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_TEXTS, translateDemoText } from "./demo-data";
import {
  allStepsSettled,
  countDoneSteps,
  focusOptionsFor,
  newlyDoneSteps,
  nextStartStep,
  shouldShowChecklist,
  startStepDefinitionsFor,
  startStepsFor,
  UNSKIPPABLE_STEPS,
  type StartStepId,
} from "./steps";

const none: Record<StartStepId, boolean> = { conto: false, import: false, budget: false, investimento: false, debito: false, pensione: false, obiettivo: false };

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
    const steps = { ...none, conto: true, investimento: true, debito: true };
    expect(countDoneSteps(steps)).toBe(3);
    expect(countDoneSteps(steps, ["conto", "import", "obiettivo"])).toBe(1);
  });
  it("si nasconde se chiusa, completa o in demo", () => {
    expect(shouldShowChecklist({ dismissed: false, completed: false, demoActive: false })).toBe(true);
    expect(shouldShowChecklist({ dismissed: true, completed: false, demoActive: false })).toBe(false);
    expect(shouldShowChecklist({ dismissed: false, completed: true, demoActive: false })).toBe(false);
    expect(shouldShowChecklist({ dismissed: false, completed: false, demoActive: true })).toBe(false);
  });
});

describe("startStepsFor", () => {
  const it_ = { pensionAvailable: true };
  it("asks for the default steps when nothing was chosen", () => {
    expect(startStepsFor(null, it_)).toEqual(["conto", "import", "budget", "investimento", "obiettivo"]);
    expect(startStepsFor([], it_)).toEqual(["conto", "import", "budget", "investimento", "obiettivo"]);
  });
  it("follows the focus, with the account first and the target last", () => {
    expect(startStepsFor(["debiti"], it_)).toEqual(["conto", "debito", "obiettivo"]);
    expect(startStepsFor(["pensione", "spese"], it_)).toEqual(["conto", "import", "budget", "pensione", "obiettivo"]);
    expect(startStepsFor(["spese", "investimenti", "debiti", "pensione"], it_)).toEqual(["conto", "import", "budget", "investimento", "debito", "pensione", "obiettivo"]);
  });
  it("never asks for the pension where that section is hidden", () => {
    expect(startStepsFor(["pensione", "debiti"], { pensionAvailable: false })).toEqual(["conto", "debito", "obiettivo"]);
    expect(focusOptionsFor(false).map((o) => o.id)).toEqual(["spese", "investimenti", "debiti"]);
  });
});

describe("next step and acknowledgement", () => {
  const ids: StartStepId[] = ["conto", "import", "obiettivo"];
  it("picks the first step not done", () => {
    expect(nextStartStep(none, ids)).toBe("conto");
    expect(nextStartStep({ ...none, conto: true }, ids)).toBe("import");
    expect(nextStartStep({ ...none, conto: true, import: true, obiettivo: true }, ids)).toBeNull();
  });
  it("ignores skipped steps when picking the next one", () => {
    expect(nextStartStep({ ...none, conto: true }, ids, ["import"])).toBe("obiettivo");
    expect(nextStartStep({ ...none, conto: true }, ids, ["import", "obiettivo"])).toBeNull();
  });
  it("settles when every step is done or skipped, but never skips the account", () => {
    expect(allStepsSettled({ ...none, conto: true }, ids, ["import", "obiettivo"])).toBe(true);
    expect(allStepsSettled({ ...none, conto: true }, ids, ["import"])).toBe(false);
    expect(allStepsSettled(none, ids, ["import", "obiettivo"])).toBe(false);
    expect(UNSKIPPABLE_STEPS).toContain("conto");
  });
  it("lists only steps of the user's list that just became done", () => {
    expect(newlyDoneSteps({ conto: true }, { ...none, conto: true, import: true, debito: true }, ids)).toEqual(["import"]);
    expect(newlyDoneSteps({ conto: true }, { ...none, conto: true }, ids)).toEqual([]);
  });
});

describe("startStepDefinitionsFor", () => {
  it("the budget step leads to Liquidità · Budget; without Analitiche the target is not asked", () => {
    expect(startStepDefinitionsFor().find((s) => s.id === "budget")?.href).toBe("/liquidita/budget");
    expect(startStepDefinitionsFor().find((s) => s.id === "obiettivo")?.href).toBe("/analitiche?traguardo=1");
    expect(startStepsFor(["spese"], { pensionAvailable: false, retirementAvailable: false })).toEqual(["conto", "import", "budget"]);
  });
});
