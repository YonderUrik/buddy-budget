import { describe, expect, it } from "vitest";
import { INVESTMENT_STORY_STEPS, PAC_STORY_MONTHLY, PAC_STORY_RETURNS, STORY_ALLOCATION, STORY_STEPS } from "./login-story.data";
import { buildPacSeries } from "./pac-story.utils";

describe("dati della storia del login", () => {
  it("i due capitoli hanno le stesse fasi nello stesso ordine, perché condividono la timeline", () => {
    expect(INVESTMENT_STORY_STEPS.map((s) => s.id)).toEqual(STORY_STEPS.map((s) => s.id));
  });

  it("il PAC di esempio chiude in guadagno ma passa anche qualche mese sotto il versato", () => {
    const series = buildPacSeries(PAC_STORY_MONTHLY, PAC_STORY_RETURNS);
    const last = series[series.length - 1];
    expect(last.value).toBeGreaterThan(last.invested);
    expect(series.some((p) => p.value < p.invested)).toBe(true);
  });

  it("la composizione di esempio somma al 100%", () => {
    expect(STORY_ALLOCATION.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });
});
