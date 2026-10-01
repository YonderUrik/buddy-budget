/** Dati del grafico dell'utilizzato di una linea di credito (puro): serie a scalini con asse del tempo e fido. */

import type { CreditLineBalancePoint } from "@/lib/calc/credit-line";

export interface BalanceChartPoint {
  /** Millisecondi UTC della data (asse numerico del tempo). */
  time: number;
  balance: number;
}

export interface BalanceChartData {
  points: BalanceChartPoint[];
  /** Massimo dell'asse: il più alto tra fido e utilizzo, con un po' d'aria sopra. */
  yMax: number;
}

/** Margine sopra il valore massimo, perché la linea del fido non tocchi il bordo. */
export const CHART_HEADROOM = 1.08;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Serie a scalini fino a `today` (il saldo di oggi chiude la linea) e massimo dell'asse. */
export function buildBalanceChartData(series: CreditLineBalancePoint[], creditLimit: number, today: string): BalanceChartData {
  const points = series.map((p) => ({ time: toTime(p.date), balance: p.balance }));
  const last = series[series.length - 1];
  if (last && last.date < today) points.push({ time: toTime(today), balance: last.balance });
  const peak = Math.max(creditLimit, ...series.map((p) => p.balance), 0);
  return { points, yMax: Math.max(peak * CHART_HEADROOM, 1) };
}
