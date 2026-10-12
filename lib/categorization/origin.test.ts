import { describe, expect, it } from "vitest";
import { autoOriginLabel, dateRangeLabel, suggestionOriginText } from "./origin";
import type { CategorizeSuggestion } from "./suggest";

const TODAY = new Date("2026-10-12T12:00:00");

function suggestion(overrides: Partial<CategorizeSuggestion>): CategorizeSuggestion {
  return {
    transactionId: "t",
    merchantKey: "k",
    suggestedCategoryId: "c",
    source: "storico",
    confidence: 1,
    reason: "",
    suggestedSplitPercentage: null,
    ...overrides,
  };
}

describe("dateRangeLabel", () => {
  it("un giorno solo, senza anno se è quello in corso", () => {
    expect(dateRangeLabel(["2026-10-09"], TODAY)).toBe("9 ott");
    expect(dateRangeLabel(["2026-10-09", "2026-10-09"], TODAY)).toBe("9 ott");
  });

  it("nello stesso mese scrive il mese una volta, a cavallo di due mesi lo scrive due volte", () => {
    expect(dateRangeLabel(["2026-10-09", "2026-10-02"], TODAY)).toBe("2–9 ott");
    expect(dateRangeLabel(["2026-09-28", "2026-10-09"], TODAY)).toBe("28 set – 9 ott");
  });

  it("aggiunge l'anno se non è quello in corso o se l'intervallo lo attraversa", () => {
    expect(dateRangeLabel(["2025-12-30", "2026-01-04"], TODAY)).toMatch(/2025.*2026/);
    expect(dateRangeLabel(["2025-03-01"], TODAY)).toContain("2025");
  });

  it("senza date resta vuoto", () => {
    expect(dateRangeLabel([], TODAY)).toBe("");
  });
});

describe("suggestionOriginText", () => {
  it("racconta lo storico con i numeri veri", () => {
    expect(suggestionOriginText(suggestion({ history: { agreeing: 4, total: 4 } }))).toBe("Come tutti i tuoi 4 movimenti simili");
    expect(suggestionOriginText(suggestion({ history: { agreeing: 3, total: 5 } }))).toBe("Come 3 dei tuoi 5 movimenti simili");
    expect(suggestionOriginText(suggestion({ history: { agreeing: 1, total: 1 } }))).toBe("Come l'unico tuo movimento simile");
  });

  it("nomina la regola simile e l'AI", () => {
    expect(suggestionOriginText(suggestion({ source: "regola", rulePattern: "esselunga" }))).toBe("Simile alla tua regola «esselunga»");
    expect(suggestionOriginText(suggestion({ source: "assistente" }))).toBe("Proposta dall'AI");
  });
});

describe("autoOriginLabel", () => {
  it("solo il nome dell'origine, senza percentuale", () => {
    expect(autoOriginLabel("regola")).toBe("Regola");
    expect(autoOriginLabel("assistente")).toBe("AI");
    expect(autoOriginLabel("storico")).toBe("Le tue scelte");
  });
});
