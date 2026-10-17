import { describe, expect, it } from "vitest";
import { canAdvance, initialDraft, requiredMonthly, type GoalDraft } from "./goal-form-state";
import { goalFormatters } from "./goal-format";

const TODAY = "2026-10-17";
const draft = (over: Partial<GoalDraft>): GoalDraft => ({ ...initialDraft(null, 0), kind: "viaggio", name: "Viaggio", target: 3000, ...over });

describe("second step with a half-typed month", () => {
  // Safari on Mac and Firefox render <input type="month"> as a text field: while typing, the value is not a month.
  it("does not advance, needs no monthly amount and formats without throwing", () => {
    const fmt = goalFormatters("it-IT", (value) => String(value), "EUR");
    for (const targetMonth of ["2", "ott", "2027", "2027-1"]) {
      expect(canAdvance("quanto", draft({ targetMonth }), TODAY)).toBe(false);
      expect(requiredMonthly(draft({ targetMonth }), TODAY)).toBeNull();
      expect(() => fmt.month(targetMonth)).not.toThrow();
    }
  });

  it("still works with a complete month", () => {
    expect(canAdvance("quanto", draft({ targetMonth: "2027-10" }), TODAY)).toBe(true);
    expect(requiredMonthly(draft({ targetMonth: "2027-10" }), TODAY)).toBe(250);
  });
});
