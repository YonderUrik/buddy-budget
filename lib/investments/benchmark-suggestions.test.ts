import { describe, expect, it } from "vitest";
import { BENCHMARK_SUGGESTIONS, findBenchmarkSuggestion, matchBenchmarkSuggestion } from "./benchmark-suggestions";

describe("benchmark suggestions", () => {
  it("have unique ids, ISINs and symbols", () => {
    for (const key of ["id", "isin", "yahooSymbol"] as const) {
      expect(new Set(BENCHMARK_SUGGESTIONS.map((s) => s[key])).size).toBe(BENCHMARK_SUGGESTIONS.length);
    }
  });

  it("finds a suggestion by id and nothing else", () => {
    expect(findBenchmarkSuggestion("msci-world")?.label).toBe("MSCI World");
    expect(findBenchmarkSuggestion("example.com")).toBeNull();
  });

  it("recognises the chosen instrument by ISIN or by name without brackets", () => {
    expect(matchBenchmarkSuggestion({ isin: "IE00BK5BQT80", name: "Anything" })?.id).toBe("ftse-all-world");
    expect(matchBenchmarkSuggestion({ isin: null, name: "iShares Core MSCI World UCITS ETF Acc" })?.id).toBe("msci-world");
    expect(matchBenchmarkSuggestion({ isin: "IE00B3RBWM25", name: "Vanguard FTSE All-World UCITS ETF (Dist)" })).toBeNull();
    expect(matchBenchmarkSuggestion(null)).toBeNull();
  });
});
