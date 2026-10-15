import { describe, expect, it } from "vitest";
import { summarizeCosts, costDrag, type CostPosition } from "./costs";
import { BOLLO_RATE } from "./taxes";
import type { ProductCountry } from "@/lib/localization/config";
const positions: CostPosition[] = [
  { id: "fund", name: "My fund", value: 10_000, ter: 0.002, subjectToBollo: true },
  { id: "other", name: "My other holding", value: 5_000, ter: null, subjectToBollo: false },
];
describe("country-specific recurring investment costs", () => {
  it("retains fund costs but never applies Italian stamp duty to Germany", () => {
    const de = summarizeCosts(positions, "DE");
    const it = summarizeCosts(positions, "IT");
    expect(de.annualCost).toBe(20);
    expect(de.rows.every(row => row.bolloCost === 0)).toBe(true);
    expect(it.annualCost).toBe(20 + 10_000 * BOLLO_RATE);
    expect(de.rows.map(row => row.terCost)).toEqual(it.rows.map(row => row.terCost));
    expect(de.missingTerValue).toBe(5_000);
    expect(de.totalValue).toBe(it.totalValue);
    expect(positions[0].value).toBe(10_000);
  });
  it("uses each country's costs in the illustrative projection", () => {
    const de = summarizeCosts(positions, "DE"), it = summarizeCosts(positions, "IT");
    expect(costDrag(de.totalValue, 0.05, de.annualPct!, 10).at(-1)!.lost).toBeLessThan(costDrag(it.totalValue, 0.05, it.annualPct!, 10).at(-1)!.lost);
  });
  it("does not silently default an unsupported or missing country to Italy", () => {
    expect(() => summarizeCosts(positions, "FR" as ProductCountry)).toThrow("Unsupported");
    expect(() => summarizeCosts(positions, undefined as unknown as ProductCountry)).toThrow("Unsupported");
    expect(summarizeCosts([], "DE")).toMatchObject({ annualCost: 0, annualPct: null });
  });
});
