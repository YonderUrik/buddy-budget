/**
 * Calcoli del capitolo investimenti della storia del login: la serie di un PAC mese per mese (versato e valore) e
 * il grafico di quanto il mercato aggiunge o toglie rispetto al versato. Funzioni pure, così la resa è testabile.
 */

/** Un mese del PAC di esempio. */
export interface PacStoryPoint {
  month: number;
  /** Totale versato fino a quel mese. */
  invested: number;
  /** Valore del portafoglio alla fine del mese. */
  value: number;
}

/** Serie del PAC: ogni mese si versa `monthly`, poi il portafoglio rende quanto indicato in `monthlyReturns`. */
export function buildPacSeries(monthly: number, monthlyReturns: readonly number[]): PacStoryPoint[] {
  const points: PacStoryPoint[] = [];
  let value = 0;
  monthlyReturns.forEach((rate, i) => {
    value = (value + monthly) * (1 + rate);
    points.push({ month: i + 1, invested: monthly * (i + 1), value });
  });
  return points;
}

export interface PacChartBox {
  width: number;
  height: number;
  /** Margine interno in alto e in basso, per non tagliare tratto ed etichette. */
  padding: number;
}

/** Un punto notevole del grafico (mese peggiore, oggi), con la sua posizione. */
export interface PacChartMark {
  x: number;
  y: number;
  month: number;
  /** Valore meno versato in quel mese. */
  gap: number;
}

export interface PacGapChart {
  /** Altezza della linea dello zero (valore = versato). */
  zeroY: number;
  /** Linea di quanto il mercato ha aggiunto o tolto, mese per mese. */
  line: string;
  /** Area sopra lo zero (mercato in guadagno). */
  gainArea: string;
  /** Area sotto lo zero (mercato in perdita). */
  lossArea: string;
  /** Mese in cui il mercato toglieva di più, o null se non è mai andato sotto il versato. */
  worst: PacChartMark | null;
  /** Ultimo mese. */
  end: PacChartMark;
  /** Ascissa di ogni versamento (inizio di ogni mese). */
  depositXs: number[];
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Grafico di "valore meno versato" nel tempo: parte da zero, sale quando il mercato aggiunge e scende sotto lo zero
 * quando toglie. La scala verticale va dal minimo al massimo della differenza (zero compreso), così le oscillazioni
 * occupano tutta l'altezza invece di schiacciarsi sotto la crescita del versato.
 */
export function buildPacGapChart(points: readonly PacStoryPoint[], box: PacChartBox): PacGapChart {
  const gaps = [0, ...points.map((p) => p.value - p.invested)];
  const high = Math.max(...gaps);
  const low = Math.min(...gaps);
  const span = high - low || 1;
  const plotHeight = box.height - box.padding * 2;
  const steps = Math.max(points.length, 1);
  const x = (i: number) => round((i / steps) * box.width);
  const y = (gap: number) => round(box.padding + ((high - gap) / span) * plotHeight);
  const zeroY = y(0);

  const coords = gaps.map((gap, i) => ({ x: x(i), gap }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${y(c.gap)}`).join("");
  const area = (clamp: (gap: number) => number) =>
    `M${x(0)},${zeroY}${coords.map((c) => `L${c.x},${y(clamp(c.gap))}`).join("")}L${x(gaps.length - 1)},${zeroY}Z`;

  const mark = (i: number): PacChartMark => ({ x: x(i), y: y(gaps[i]), month: i, gap: gaps[i] });
  const worstIndex = gaps.indexOf(low);

  return {
    zeroY,
    line,
    gainArea: area((g) => Math.max(g, 0)),
    lossArea: area((g) => Math.min(g, 0)),
    worst: low < 0 ? mark(worstIndex) : null,
    end: mark(gaps.length - 1),
    depositXs: points.map((_, i) => x(i)),
  };
}

/** Una fetta della composizione di esempio. */
export interface AllocationSlice {
  label: string;
  share: number;
  swatchVar: string;
}
