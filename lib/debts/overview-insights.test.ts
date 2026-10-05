import { describe, expect, it } from "vitest";
import type { Debt } from "@/lib/db/schema/debts";
import { buildExitPlan, findDueRow, yearlyInterestShares } from "./overview-insights";
import { buildDebtsView } from "./view";

const now = new Date("2026-09-30T10:00:00Z");

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: "d1", userId: "u1", kind: "loan", name: "Prestito", startMode: "origine", principal: "12000.00", annualRate: "6.0000", installments: 24,
    firstInstallmentDate: "2026-10-05", installment: null, anchorDate: null, costs: [],
    creditLimit: null, spread: null, indexLabel: null, interestFrequency: null, dayCount: null, capitalizeInterest: null, alertThresholdType: null, alertThresholdValue: null,
    openDate: null, initialUsed: null, initialIndexRate: null, createdAt: now, updatedAt: now,
    ...overrides,
  } as Debt;
}

const TODAY = "2026-09-30";
const view = buildDebtsView(
  [debt({ id: "caro", name: "Caro", principal: "3000.00", annualRate: "12.0000", installments: 12 }), debt({ id: "mutuo", name: "Mutuo", principal: "100000.00", annualRate: "3.0000", installments: 240 })],
  [],
  TODAY
);

describe("yearlyInterestShares", () => {
  it("ordina dal più alto e le quote sommano a 1", () => {
    const { items, total } = yearlyInterestShares(view.debts, view.creditLines);
    expect(items.map((i) => i.name)).toEqual(["Mutuo", "Caro"]);
    expect(items.reduce((s, i) => s + i.share, 0)).toBeCloseTo(1, 6);
    expect(total).toBeCloseTo(items[0].yearly + items[1].yearly, 6);
  });
  it("senza debiti il totale è zero", () => {
    expect(yearlyInterestShares([], [])).toEqual({ items: [], total: 0 });
  });
});

describe("buildExitPlan", () => {
  it("con un extra chiude prima e risparmia interessi, nell'ordine valanga", () => {
    const plan = buildExitPlan(view.debts, 300, TODAY)!;
    expect(plan.steps[0].name).toBe("Caro");
    expect(plan.interestSaved).toBeGreaterThan(0);
    expect(plan.endDate < plan.baselineEndDate).toBe(true);
    expect(plan.steps.every((s) => s.endDate <= s.baselineEndDate)).toBe(true);
  });
  it("senza finanziamenti aperti non propone nulla", () => {
    expect(buildExitPlan([], 200, TODAY)).toBeNull();
  });
});

describe("findDueRow", () => {
  it("trova la rata non saldata a quella data", () => {
    const d = view.debts[0];
    const next = d.plan.rows.find((r) => r.status !== "pagata")!;
    expect(findDueRow(d, next.dueDate)?.number).toBe(next.number);
    expect(findDueRow(d, "1999-01-01")).toBeUndefined();
  });
});
