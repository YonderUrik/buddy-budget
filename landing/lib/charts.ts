/**
 * Geometrie dei grafici decorativi della finestra del prodotto. Dati d'esempio generati da un seed fisso, così
 * il rendering è identico sul server e sul client e non servono dati reali.
 */

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Point = [number, number];

/** Curva morbida (bezier) che passa per i punti. */
export function smoothPath(points: Point[]): string {
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const mx = ((ax + bx) / 2).toFixed(1);
    d += ` C${mx} ${ay.toFixed(1)} ${mx} ${by.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  return d;
}

function series(n: number, from: number, to: number, volatility: number, seed: number): number[] {
  const rand = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(from + (to - from) * t + (rand() - 0.5) * volatility * (1 - 0.3 * t) + Math.sin(i / 4) * volatility * 0.4);
  }
  out[n - 1] = to;
  return out;
}

export interface NetWorthChartData {
  areaTop: string;
  lineTop: string;
  lineLiquidity: string;
  lineNet: string;
  monthLabels: { x: number; text: string }[];
}

/** Patrimonio netto d'esempio: liquidità e investimenti impilati, più la linea del netto dopo i debiti. */
export function netWorthChart(width: number, height: number): NetWorthChartData {
  const n = 40;
  const liquidity = series(n, 10800, 14416, 900, 7);
  const investments = series(n, 27200, 39070, 2400, 11);
  const debt = Array.from({ length: n }, (_, i) => (i < 14 ? 21000 : i < 27 ? 19600 : 18200));
  const top = liquidity.map((v, i) => v + investments[i]);
  const net = top.map((v, i) => v - debt[i]);
  const max = Math.max(...top) * 1.04;
  const min = Math.min(...net) * 0.9;
  const pad = 18;
  const x = (i: number) => i * (width / (n - 1));
  const y = (v: number) => height - pad - ((v - min) / (max - min)) * (height - pad - 6);
  const toPoints = (values: number[]): Point[] => values.map((v, i) => [x(i), y(v)]);
  const lineTop = smoothPath(toPoints(top));
  return {
    areaTop: `${lineTop} L${width} ${height} L0 ${height}Z`,
    lineTop,
    lineLiquidity: smoothPath(toPoints(liquidity)),
    lineNet: smoothPath(toPoints(net)),
    monthLabels: ["lug", "ago", "set", "ott"].map((text, i) => ({ x: i * (width / 3.2) + 8, text })),
  };
}

export interface ComparisonLines {
  you: string;
  index: string;
}

/** Due linee a confronto (portafoglio e indice) normalizzate su base 100. */
export function comparisonLines(width: number, height: number, seed: number): ComparisonLines {
  const n = 30;
  const a = series(n, 100, 109.4, 3.2, seed);
  const b = series(n, 100, 106.1, 2.6, seed + 5);
  const all = [...a, ...b];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const toPoints = (values: number[]): Point[] =>
    values.map((v, i) => [i * (width / (n - 1)), height - 4 - ((v - min) / (max - min)) * (height - 12)]);
  return { you: smoothPath(toPoints(a)), index: smoothPath(toPoints(b)) };
}

/** Residuo di un debito che scende a gradini (rate), come area e linea. */
export function debtStepsPath(width: number, height: number): { line: string; area: string } {
  const pts: Point[] = [[0, 0.32], [0.18, 0.32], [0.18, 0.5], [0.5, 0.5], [0.5, 0.62], [0.78, 0.62], [0.78, 0.82], [1, 0.82]];
  const line = "M" + pts.map(([px, py]) => `${(px * width).toFixed(1)} ${(height - py * height).toFixed(1)}`).join(" L");
  return { line, area: `${line} L${width} ${height} L0 ${height}Z` };
}
