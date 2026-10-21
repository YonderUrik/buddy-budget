import { expect, it } from "vitest";
import { inflationAreaForCountry, INFLATION_AREAS } from "./financial-country";
import { countryFeatures, resolveProfile } from "./config";
it("selects inflation by product country, independently of interface language", () => {
  for (const language of ["en", "de"]) expect(inflationAreaForCountry(resolveProfile({ productCountry: "DE", language }).productCountry, "EUR")).toBe("DE");
  for (const language of ["en", "it"]) expect(inflationAreaForCountry(resolveProfile({ productCountry: "IT", language }).productCountry, "EUR")).toBe("IT");
  expect(inflationAreaForCountry("DE", "USD")).toBeNull();
  expect(inflationAreaForCountry("US", "EUR")).toBeNull();
  expect(INFLATION_AREAS).toEqual(["IT", "DE"]);
  expect(countryFeatures("DE")).toEqual({ inflation: true, taxes: false, pension: false, retirement: true, incomeForecasts: false });
});


it("preserves inflation and real return across a consistent reference-base change", async () => {
  const { inflationBetween, realReturn } = await import("@/lib/calc/returns");
  const old = [{ month: "2025-12", value: 130 }, { month: "2026-01", value: 132.6 }];
  const rebased = old.map(p => ({ ...p, value: p.value / 1.3 }));
  const previous = inflationBetween(old, "2025-12-01", "2026-02-01")!;
  const current = inflationBetween(rebased, "2025-12-01", "2026-02-01")!;
  expect(current.rate).toBeCloseTo(0.02);
  expect(current.rate).toBeCloseTo(previous.rate);
  expect(realReturn(0.1, current.rate)).toBeCloseTo(realReturn(0.1, previous.rate));
});
