import { describe, expect, it } from "vitest";
import { isValidExcludedAmount } from "./transactions";

describe("isValidExcludedAmount", () => {
  it("accetta una quota esclusa con lo stesso segno e valore assoluto minore o uguale", () => {
    expect(isValidExcludedAmount(-50, -10)).toBe(true);
    expect(isValidExcludedAmount(-50, -50)).toBe(true);
    expect(isValidExcludedAmount(100, 40)).toBe(true);
  });

  it("rifiuta una quota esclusa più grande in valore assoluto dell'importo", () => {
    expect(isValidExcludedAmount(-50, -60)).toBe(false);
  });

  it("rifiuta una quota esclusa di segno opposto all'importo", () => {
    expect(isValidExcludedAmount(-50, 10)).toBe(false);
  });

  it("accetta 0 come quota esclusa indipendentemente dal segno dell'importo", () => {
    expect(isValidExcludedAmount(-50, 0)).toBe(true);
    expect(isValidExcludedAmount(50, 0)).toBe(true);
  });
});
