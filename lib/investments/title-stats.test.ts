import { describe, expect, it } from "vitest";
import { closeOnOrBefore, computeTitleStats, downsampleCloses, type CloseInput } from "./title-stats";

function series(startKey: string, days: number, fn: (i: number) => number): CloseInput[] {
  const out: CloseInput[] = [];
  const start = Date.parse(`${startKey}T00:00:00Z`);
  for (let i = 0; i < days; i += 1) out.push({ date: new Date(start + i * 86_400_000).toISOString().slice(0, 10), close: fn(i) });
  return out;
}

describe("computeTitleStats", () => {
  it("è null senza chiusure", () => {
    expect(computeTitleStats([], "2026-09-30")).toBeNull();
  });

  it("calcola variazione giornaliera, periodi, massimo/minimo e distanza dal massimo", () => {
    const closes = series("2025-09-01", 395, (i) => 100 + i); // sale di 1 al giorno fino al 2026-09-30
    const stats = computeTitleStats(closes, "2026-09-30")!;
    expect(stats.lastDate).toBe("2026-09-30");
    expect(stats.lastClose).toBe(494);
    expect(stats.dayChange).toBeCloseTo(494 / 493 - 1, 10);
    expect(stats.returns["1M"]).toBeCloseTo(494 / 464 - 1, 10);
    expect(stats.returns["1A"]).toBeCloseTo(494 / 129 - 1, 10);
    expect(stats.returns.YTD).toBeCloseTo(494 / (100 + 121) - 1, 10); // chiusura del 31/12/2025
    expect(stats.high52).toBe(494);
    expect(stats.fromHigh).toBe(0);
    expect(stats.maxDrawdown).toBe(0);
  });

  it("lascia vuoto un periodo che lo storico non copre", () => {
    const closes = series("2026-08-20", 42, () => 10);
    const stats = computeTitleStats(closes, "2026-09-30")!;
    expect(stats.returns["1M"]).toBe(0);
    expect(stats.returns["1A"]).toBeUndefined();
    expect(stats.returns.YTD).toBeUndefined();
    expect(stats.volatility).not.toBeNull();
  });

  it("trova la caduta massima e la volatilità positiva", () => {
    const closes = series("2026-01-01", 200, (i) => (i < 100 ? 100 + i : 199 - (i - 99) * 0.5) + (i % 2));
    const stats = computeTitleStats(closes, "2026-07-19")!;
    expect(stats.maxDrawdown!).toBeLessThan(-0.2);
    expect(stats.volatility!).toBeGreaterThan(0);
  });

  it("con poche osservazioni non dà volatilità né caduta", () => {
    const stats = computeTitleStats(series("2026-09-01", 10, (i) => 10 + i), "2026-09-10")!;
    expect(stats.volatility).toBeNull();
    expect(stats.maxDrawdown).toBeNull();
  });
});

describe("closeOnOrBefore / downsampleCloses", () => {
  it("prende l'ultima chiusura in data o prima", () => {
    const closes = series("2026-09-01", 5, (i) => i);
    expect(closeOnOrBefore(closes, "2026-09-03")?.close).toBe(2);
    expect(closeOnOrBefore(closes, "2026-08-31")).toBeNull();
  });

  it("tiene primo e ultimo punto", () => {
    const points = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsampleCloses(points, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(0);
    expect(out[99]).toBe(999);
  });
});
