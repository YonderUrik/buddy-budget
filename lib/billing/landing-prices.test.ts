import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRO_PRICE_CENTS, PRO_TRIAL_DAYS } from "./plans";

/** The landing is a separate project: it keeps its own copy of the prices, checked here against the app's. */
const LANDING_PRICING = path.join(process.cwd(), "landing/content/pricing.ts");

describe("landing prices", () => {
  it("match the prices and trial the app sells", () => {
    const source = readFileSync(LANDING_PRICING, "utf8");
    const match = source.match(/PRO_PRICES = \{ monthCents: (\d+), yearCents: (\d+), trialDays: (\d+) \}/);
    expect(match, "PRO_PRICES not found in landing/content/pricing.ts").not.toBeNull();
    expect(Number(match![1])).toBe(PRO_PRICE_CENTS.month);
    expect(Number(match![2])).toBe(PRO_PRICE_CENTS.year);
    expect(Number(match![3])).toBe(PRO_TRIAL_DAYS);
  });
});
