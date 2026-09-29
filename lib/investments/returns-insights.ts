import type { BenchmarkComparison } from "@/lib/calc/returns";

/** Sotto questa differenza (1 punto percentuale) due rendimenti si considerano uguali. */
export const RETURN_DIFFERENCE_THRESHOLD = 0.01;

/** Esito del confronto tra portafoglio e benchmark. */
export type BenchmarkVerdict = "better" | "worse" | "even";

/**
 * Cosa dice la differenza tra rendimento del portafoglio (TWR) e dei tuoi soldi (money-weighted): se i tuoi soldi
 * rendono meno, hai versato di più quando i prezzi erano alti (o prima di un calo). Null se la differenza è piccola.
 */
export function timingInsight(twr: number | null, moneyWeighted: number | null): string | null {
  if (twr === null || moneyWeighted === null) return null;
  const diff = moneyWeighted - twr;
  if (Math.abs(diff) < RETURN_DIFFERENCE_THRESHOLD) return null;
  return diff < 0
    ? "I tuoi soldi hanno reso meno del portafoglio: hai versato di più quando i prezzi erano più alti."
    : "I tuoi soldi hanno reso più del portafoglio: hai versato di più quando i prezzi erano più bassi.";
}

/** Il portafoglio ha fatto meglio o peggio del benchmark, confrontando i valori finali a parità di versamenti. */
export function benchmarkVerdict(comparison: Pick<BenchmarkComparison, "simulatedValue" | "portfolioValue">): BenchmarkVerdict {
  const base = Math.max(Math.abs(comparison.simulatedValue), 1);
  const diff = (comparison.portfolioValue - comparison.simulatedValue) / base;
  if (Math.abs(diff) < RETURN_DIFFERENCE_THRESHOLD) return "even";
  return diff > 0 ? "better" : "worse";
}
