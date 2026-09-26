import { describe, expect, it } from "vitest";
import { planBaselineMark } from "./baseline";

const BASELINE_WHEN = 1790400000000;

describe("planBaselineMark", () => {
  it("inserisce su un DB che non ha mai usato il migrator", () => {
    expect(planBaselineMark([], BASELINE_WHEN)).toBe("insert");
  });

  it("inserisce anche se c'è la vecchia migration di luglio, così il migrator la considera superata", () => {
    expect(planBaselineMark([1783617840424], BASELINE_WHEN)).toBe("insert");
  });

  it("non fa nulla se la baseline è già registrata (script rilanciabile)", () => {
    expect(planBaselineMark([1783617840424, BASELINE_WHEN], BASELINE_WHEN)).toBe("already-marked");
  });
});
