import { describe, expect, it } from "vitest";
import { buildCommentaryPrompt, commentatorFromEnv } from "./commentary";
import type { TitleStats } from "./title-stats";

const stats: TitleStats = {
  lastClose: 123.456,
  lastDate: "2026-09-30",
  dayChange: 0.0123,
  returns: { "1M": 0.02, "1A": 0.15 },
  high52: 130,
  low52: 90,
  fromHigh: -0.05,
  volatility: 0.18,
  maxDrawdown: -0.12,
};

describe("buildCommentaryPrompt", () => {
  it("include solo i dati disponibili e le regole di tono", () => {
    const prompt = buildCommentaryPrompt({ name: "Test ETF", type: "etf", currency: "EUR", stats, fundamentals: null });
    expect(prompt).toContain("Test ETF (ETF)");
    expect(prompt).toContain("Ultimo anno: 15.0%");
    expect(prompt).toContain("Volatilità annua: 18.0%");
    expect(prompt).not.toContain("Ultimi 3 mesi");
    expect(prompt).not.toContain("P/E");
    expect(prompt).toContain("Non dare consigli");
  });
});

describe("commentatorFromEnv", () => {
  it("senza OLLAMA_BASE_URL non c'è commento", () => {
    expect(commentatorFromEnv({})).toBeNull();
    expect(commentatorFromEnv({ OLLAMA_BASE_URL: "  " })).toBeNull();
    expect(commentatorFromEnv({ OLLAMA_BASE_URL: "http://localhost:11434" })).not.toBeNull();
  });
});
