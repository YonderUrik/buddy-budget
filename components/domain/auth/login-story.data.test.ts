import { describe, expect, it } from "vitest";
import { INVESTMENT_STORY_STEPS, STORY_INVESTMENTS, STORY_STEPS, STORY_TRANSACTIONS } from "./login-story.data";

describe("dati della storia del login", () => {
  it("i due capitoli hanno lo stesso numero di righe, perché condividono la timeline", () => {
    expect(STORY_INVESTMENTS).toHaveLength(STORY_TRANSACTIONS.length);
  });

  it("i due capitoli hanno le stesse fasi nello stesso ordine", () => {
    expect(INVESTMENT_STORY_STEPS.map((s) => s.id)).toEqual(STORY_STEPS.map((s) => s.id));
  });

  it("gli investimenti di esempio chiudono in guadagno, con almeno una posizione in perdita", () => {
    const paid = STORY_INVESTMENTS.reduce((sum, i) => sum + i.cost, 0);
    const value = STORY_INVESTMENTS.reduce((sum, i) => sum + i.value, 0);
    expect(value).toBeGreaterThan(paid);
    expect(STORY_INVESTMENTS.some((i) => i.value < i.cost)).toBe(true);
  });
});
