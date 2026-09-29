import { describe, expect, it } from "vitest";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { benchmarkVerdict, benchmarkWait, timingInsight } from "./returns-insights";

describe("timingInsight", () => {
  it("spiega la differenza tra i due rendimenti solo quando è rilevante", () => {
    expect(timingInsight(0.2, 0.1)).toContain("meno");
    expect(timingInsight(0.1, 0.2)).toContain("più bassi");
    expect(timingInsight(0.1, 0.105)).toBeNull();
    expect(timingInsight(null, 0.1)).toBeNull();
  });
});

describe("benchmarkVerdict", () => {
  it("confronta i valori finali con una tolleranza dell'1%", () => {
    expect(benchmarkVerdict({ portfolioValue: 1100, simulatedValue: 1000 })).toBe("better");
    expect(benchmarkVerdict({ portfolioValue: 900, simulatedValue: 1000 })).toBe("worse");
    expect(benchmarkVerdict({ portfolioValue: 1005, simulatedValue: 1000 })).toBe("even");
  });
});

describe("benchmarkWait", () => {
  const state = (over: Partial<BackfillStateView>): BackfillStateView => ({
    instrumentId: "b",
    status: "running",
    saved: 0,
    total: null,
    startedAt: "2026-09-29T10:00:00Z",
    updatedAt: "2026-09-29T10:00:00Z",
    interrupted: false,
    ...over,
  });
  const base = "2024-01-09";

  it("mostra l'avanzamento finché il recupero è vivo", () => {
    expect(benchmarkWait({ backfill: state({ saved: 120, total: 500 }), firstPriceDate: null, baseKey: base })).toEqual({
      kind: "downloading",
      saved: 120,
      total: 500,
    });
    expect(benchmarkWait({ backfill: undefined, firstPriceDate: null, baseKey: base }).kind).toBe("checking");
  });

  it("un recupero fallito, interrotto o mai partito senza prezzi si può riprovare", () => {
    expect(benchmarkWait({ backfill: state({ status: "failed" }), firstPriceDate: null, baseKey: base }).kind).toBe("failed");
    expect(benchmarkWait({ backfill: state({ interrupted: true }), firstPriceDate: null, baseKey: base }).kind).toBe("failed");
    expect(benchmarkWait({ backfill: null, firstPriceDate: null, baseKey: base }).kind).toBe("failed");
  });

  it("se i prezzi partono dopo l'inizio del periodo lo dice, con la data", () => {
    expect(benchmarkWait({ backfill: state({ status: "done", saved: 300 }), firstPriceDate: "2025-03-03", baseKey: base })).toEqual({
      kind: "no_history",
      firstPriceDate: "2025-03-03",
    });
  });

  it("prezzi a metà con recupero fallito, scaduto o interrotto non è \"solo dal…\": si riprova", () => {
    const late = "2026-08-31";
    expect(benchmarkWait({ backfill: state({ status: "failed" }), firstPriceDate: late, baseKey: base }).kind).toBe("failed");
    expect(benchmarkWait({ backfill: state({ status: "done", interrupted: true }), firstPriceDate: late, baseKey: base }).kind).toBe("failed");
    expect(benchmarkWait({ backfill: null, firstPriceDate: late, baseKey: base }).kind).toBe("incomplete");
  });

  it("prezzi che coprono il periodo ma confronto assente: dati incompleti", () => {
    expect(benchmarkWait({ backfill: state({ status: "done" }), firstPriceDate: "2023-12-29", baseKey: base }).kind).toBe("incomplete");
    expect(benchmarkWait({ backfill: null, firstPriceDate: "2023-12-29", baseKey: base }).kind).toBe("incomplete");
  });
});
