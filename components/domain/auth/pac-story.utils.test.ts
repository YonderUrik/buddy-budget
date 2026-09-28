import { describe, expect, it } from "vitest";
import { buildPacGapChart, buildPacSeries } from "./pac-story.utils";

describe("buildPacSeries", () => {
  it("accumula il versato e applica il rendimento dopo ogni versamento", () => {
    const series = buildPacSeries(100, [0.1, -0.5]);
    expect(series.map((p) => p.invested)).toEqual([100, 200]);
    expect(series[0].value).toBeCloseTo(110);
    expect(series[1].value).toBeCloseTo((110 + 100) * 0.5);
  });
});

describe("buildPacGapChart", () => {
  const box = { width: 100, height: 60, padding: 5 };

  it("parte da zero e usa tutta l'altezza tra il guadagno massimo e la perdita massima", () => {
    // Guadagni: +10, poi -95 (mese peggiore), poi +5.
    const series = buildPacSeries(100, [0.1, -0.5, 1]);
    const chart = buildPacGapChart(series, box);
    expect(chart.line.startsWith(`M0,${chart.zeroY}`)).toBe(true);
    expect(chart.worst).toMatchObject({ month: 2, y: 55 });
    const ys = chart.line.split(/[ML]/).filter(Boolean).map((c) => Number(c.split(",")[1]));
    expect(Math.min(...ys)).toBe(5);
    expect(Math.max(...ys)).toBe(55);
  });

  it("le aree di guadagno e di perdita non superano la linea dello zero", () => {
    const chart = buildPacGapChart(buildPacSeries(100, [0.1, -0.5, 1]), box);
    const ysOf = (path: string) => path.replace("Z", "").split(/[ML]/).filter(Boolean).map((c) => Number(c.split(",")[1]));
    expect(Math.max(...ysOf(chart.gainArea))).toBe(chart.zeroY);
    expect(Math.min(...ysOf(chart.lossArea))).toBe(chart.zeroY);
  });

  it("senza mesi in perdita non c'è un mese peggiore; l'ultimo punto è a destra", () => {
    const chart = buildPacGapChart(buildPacSeries(100, [0.1, 0.1]), box);
    expect(chart.worst).toBeNull();
    expect(chart.end.x).toBe(100);
    expect(chart.depositXs).toEqual([0, 50]);
  });
});
