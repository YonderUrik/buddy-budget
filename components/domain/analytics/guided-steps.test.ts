import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { fireSteps } from "./guided-steps";

const PLAN = {
  spending: 30000,
  spendingSource: "ipotesi",
  savings: 12000,
  savingsSource: "ipotesi",
  wealth: 200000,
  liquidation: { latentTax: 0, grossValue: 200000, netValue: 200000, taxRatio: 0, byPosition: [] },
  taxShare: 0,
  fireNumberGross: 857143,
  target: 857143,
  progress: 0.23,
  yearsToFire: 20,
  coast: [{ years: 10, number: 579000 }],
} as unknown as AnalyticsPlan;

describe("fireSteps", () => {
  it("usa i numeri dell'utente in ogni passo e numera sette passi", () => {
    const steps = fireSteps(PLAN, DEFAULT_ASSUMPTIONS, "EUR", null);
    expect(steps).toHaveLength(7);
    const text = steps.flatMap((s) => s.text).join(" ");
    expect(text).toContain("30.000");
    expect(text).toContain("857.143");
    expect(steps.every((s) => s.title && s.text.length > 0)).toBe(true);
  });
  it("senza spesa non produce passi", () => {
    expect(fireSteps({ ...PLAN, spending: null, target: null }, DEFAULT_ASSUMPTIONS, "EUR", null)).toEqual([]);
  });
});
