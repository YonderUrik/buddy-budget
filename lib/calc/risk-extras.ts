/** Misure di rischio aggiuntive, pure su serie di rendimenti. Rendimenti come frazioni (-0,02 = -2%). */
import { mean, sampleStd } from "./risk";

/** Sortino annuo: come Sharpe ma divide per la sola volatilità dei ribassi sotto il tasso privo di rischio. */
export function sortinoRatio(returns: number[], perYear: number, annualRiskFree: number): number | null {
  if (returns.length < 2) return null;
  const target = annualRiskFree / perYear;
  const downside = Math.sqrt(returns.reduce((s, r) => s + Math.min(0, r - target) ** 2, 0) / returns.length);
  if (downside === 0) return null;
  return ((mean(returns) - target) / downside) * Math.sqrt(perYear);
}

/** Calmar: rendimento annuo diviso per il massimo calo (positivo, es. 0,3 = -30%). */
export function calmarRatio(annualReturn: number | null, maxDrawdown: number | null): number | null {
  if (annualReturn === null || maxDrawdown === null || maxDrawdown <= 0) return null;
  return annualReturn / maxDrawdown;
}

export interface TailRisk {
  /** Perdita giornaliera superata nel (1 − confidenza) dei giorni peggiori, come numero positivo. */
  var: number;
  /** Perdita media nei giorni peggiori di quella soglia (Expected Shortfall), positiva. */
  cvar: number;
}

/** VaR e CVaR storici sui rendimenti giornalieri (nessuna ipotesi di normalità). Null con meno di `minObservations` giorni. */
export function historicalTailRisk(returns: number[], confidence = 0.95, minObservations = 100): TailRisk | null {
  if (returns.length < minObservations) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const cut = Math.max(1, Math.floor(sorted.length * (1 - confidence)));
  const tail = sorted.slice(0, cut);
  return { var: -sorted[cut - 1], cvar: -mean(tail) };
}

export interface RiskContribution {
  id: string;
  weight: number;
  /** Quota del rischio totale del portafoglio dovuta a questa posizione (le quote sommano a 1). */
  riskShare: number;
}

function cov(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += (x[i] - mx) * (y[i] - my);
  return sum / (x.length - 1);
}

/**
 * Contributo di ogni posizione al rischio (scomposizione di Eulero): w_i·(Σw)_i / w'Σw. Le serie devono avere la stessa
 * lunghezza (giorni in comune). Null con meno di due posizioni o poche osservazioni.
 */
export function riskContributions(items: { id: string; weight: number; returns: number[] }[], minObservations = 60): RiskContribution[] | null {
  if (items.length < 2) return null;
  const n = items[0].returns.length;
  if (n < minObservations || items.some((i) => i.returns.length !== n)) return null;
  const sigma = items.map((a) => items.map((b) => cov(a.returns, b.returns)));
  const marginal = sigma.map((row) => row.reduce((s, v, j) => s + v * items[j].weight, 0));
  const total = items.reduce((s, item, i) => s + item.weight * marginal[i], 0);
  if (!(total > 0)) return null;
  return items.map((item, i) => ({ id: item.id, weight: item.weight, riskShare: (item.weight * marginal[i]) / total }));
}

export interface Concentration {
  /** Indice di Herfindahl: somma dei pesi al quadrato (1 = una sola posizione). */
  hhi: number;
  /** Numero "effettivo" di posizioni equivalenti: 1/HHI. */
  effectiveN: number;
}

/** Concentrazione dai pesi (normalizzati qui, quindi anche valori assoluti vanno bene). */
export function concentration(weights: number[]): Concentration | null {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (!(total > 0)) return null;
  const hhi = weights.reduce((s, w) => s + (Math.max(0, w) / total) ** 2, 0);
  return { hhi, effectiveN: 1 / hhi };
}

/** Rendimento annuo composto dai rendimenti giornalieri: (Π(1+r))^(osservazioni per anno / n) − 1. */
export function annualizedReturn(returns: number[], perYear: number): number | null {
  if (returns.length === 0 || !(perYear > 0)) return null;
  const growth = returns.reduce((acc, r) => acc * (1 + r), 1);
  return growth > 0 ? growth ** (perYear / returns.length) - 1 : null;
}

export { sampleStd };
