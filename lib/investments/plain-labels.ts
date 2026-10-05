/**
 * Parole semplici per sovrapposizioni e correlazioni: soglie e etichette in un posto solo, così la UI mostra
 * "Quasi lo stesso investimento" invece di un 0,87 da interpretare.
 */

import type { CorrelationMatrix } from "@/lib/calc/risk";
import type { AreaKey } from "./exposure-keys";

/** Da questa quota in comune due fondi sono, in pratica, lo stesso investimento. */
export const OVERLAP_ALMOST_SAME = 0.8;
/** Da questa quota in comune la parte condivisa pesa sul risultato. */
export const OVERLAP_MOSTLY_SAME = 0.5;

export type Severity = "alta" | "media" | "bassa";

export interface PlainLabel {
  label: string;
  severity: Severity;
}

/** Quanto due fondi si sovrappongono, in parole. */
export function overlapLabel(share: number): PlainLabel {
  if (share >= OVERLAP_ALMOST_SAME) return { label: "Quasi lo stesso investimento", severity: "alta" };
  if (share >= OVERLAP_MOSTLY_SAME) return { label: "In buona parte lo stesso", severity: "media" };
  return { label: "Una parte in comune", severity: "bassa" };
}

/** Soglie della correlazione tra due posizioni. */
export const CORRELATION_VERY_HIGH = 0.8;
export const CORRELATION_HIGH = 0.5;
export const CORRELATION_LOW = 0.2;

/** Quanto due posizioni si muovono insieme, in parole (−1 = opposte, 1 = identiche). */
export function correlationLabel(value: number): PlainLabel {
  if (value >= CORRELATION_VERY_HIGH) return { label: "Si muovono quasi sempre insieme", severity: "alta" };
  if (value >= CORRELATION_HIGH) return { label: "Spesso vanno nella stessa direzione", severity: "media" };
  if (value >= CORRELATION_LOW) return { label: "Si muovono poco insieme", severity: "bassa" };
  return { label: "Indipendenti", severity: "bassa" };
}

export interface CorrelationPair {
  aId: string;
  bId: string;
  value: number;
}

/** Coppie con un valore calcolato, dalla più legata alla meno legata. */
export function correlationPairs(matrix: CorrelationMatrix): CorrelationPair[] {
  const pairs: CorrelationPair[] = [];
  for (let i = 0; i < matrix.instrumentIds.length; i += 1) {
    for (let j = i + 1; j < matrix.instrumentIds.length; j += 1) {
      const value = matrix.values[i]?.[j];
      if (typeof value === "number")
        pairs.push({
          aId: matrix.instrumentIds[i],
          bId: matrix.instrumentIds[j],
          value,
        });
    }
  }
  return pairs.sort((x, y) => y.value - x.value);
}

/** Codici dei punti della mappa (`world-dot-map.generated.ts`) → area dell'app. */
export const WORLD_DOT_AREA_CODES: Record<string, AreaKey> = {
  n: "nord_america",
  e: "europa",
  i: "italia",
  j: "giappone",
  p: "pacifico",
  m: "emergenti",
};
