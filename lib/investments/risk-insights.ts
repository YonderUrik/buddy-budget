/** Frasi che spiegano in italiano semplice i numeri del rischio e della diversificazione. */

import type { CorrelationMatrix } from "@/lib/calc/risk";

/** Soglie di lettura dello Sharpe. */
export const SHARPE_FAIR = 0.5;
export const SHARPE_GOOD = 1;
/** Oltre questa correlazione due strumenti "si muovono quasi insieme". */
export const HIGH_CORRELATION = 0.8;
/** Differenza di volatilità con l'indice sotto cui si considerano simili (in punti). */
const SIMILAR_VOLATILITY = 0.02;

/** Percentuale con un decimale, come nelle card del rischio (4,6%). */
function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

/** Oscillazione tipica in un anno (una deviazione standard: circa due anni su tre). */
export function volatilityInsight(volatility: number, benchmarkVolatility: number | null, benchmarkName: string | null): string {
  const base = `In un anno normale il valore può muoversi di circa ±${pct(volatility)} (due anni su tre).`;
  if (benchmarkVolatility === null || !benchmarkName) return base;
  const diff = volatility - benchmarkVolatility;
  if (Math.abs(diff) < SIMILAR_VOLATILITY) return `${base} Più o meno come ${benchmarkName}.`;
  return `${base} ${diff > 0 ? "Più" : "Meno"} movimentato di ${benchmarkName} (±${pct(benchmarkVolatility)}).`;
}

export type SharpeLevel = "negativo" | "basso" | "discreto" | "buono";

export function sharpeLevel(sharpe: number): SharpeLevel {
  if (sharpe < 0) return "negativo";
  if (sharpe < SHARPE_FAIR) return "basso";
  if (sharpe < SHARPE_GOOD) return "discreto";
  return "buono";
}

const SHARPE_TEXT: Record<SharpeLevel, string> = {
  negativo: "Hai reso meno di un conto deposito: il rischio preso non è stato ripagato.",
  basso: "Il rischio preso è stato ripagato poco.",
  discreto: "Il rischio preso è stato ripagato in modo discreto.",
  buono: "Il rischio preso è stato ripagato bene.",
};

export function sharpeInsight(sharpe: number): string {
  return SHARPE_TEXT[sharpeLevel(sharpe)];
}

/** Quanto il portafoglio segue l'indice. */
export function betaInsight(beta: number, benchmarkName: string): string {
  const move = Math.abs(beta).toFixed(1).replace(".", ",");
  return `Quando ${benchmarkName} si muove dell'1%, il portafoglio tende a muoversi dello ${move}%${beta < 0 ? " in direzione opposta" : ""}.`;
}

/** Lettura della matrice: coppia più correlata e correlazione media. */
export interface CorrelationInsight {
  aId: string;
  bId: string;
  value: number;
  average: number;
  high: boolean;
}

export function correlationInsight(matrix: CorrelationMatrix): CorrelationInsight | null {
  let best: { aId: string; bId: string; value: number } | null = null;
  const all: number[] = [];
  for (let i = 0; i < matrix.instrumentIds.length; i += 1) {
    for (let j = i + 1; j < matrix.instrumentIds.length; j += 1) {
      const value = matrix.values[i][j];
      if (value === null) continue;
      all.push(value);
      if (!best || value > best.value) best = { aId: matrix.instrumentIds[i], bId: matrix.instrumentIds[j], value };
    }
  }
  if (!best) return null;
  const average = all.reduce((s, v) => s + v, 0) / all.length;
  return { ...best, average, high: best.value >= HIGH_CORRELATION };
}
