import { describe, expect, it } from "vitest";
import { isSupportedCurrency } from "./currency";

describe("isSupportedCurrency", () => {
  it("accetta le valute supportate", () => {
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("CHF")).toBe(true);
  });

  it("rifiuta valute sconosciute, minuscole o tipi non stringa", () => {
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("eur")).toBe(false);
    expect(isSupportedCurrency(" EUR")).toBe(false);
    expect(isSupportedCurrency(42)).toBe(false);
    expect(isSupportedCurrency(null)).toBe(false);
  });
});
