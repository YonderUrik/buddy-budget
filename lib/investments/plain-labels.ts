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

/** Da questa correlazione due posizioni finiscono nella stessa "famiglia" (si muovono in pratica insieme). */
export const FAMILY_CORRELATION = 0.75;

export interface CorrelationFamilies {
  /** Gruppi di almeno due posizioni legate tra loro, dal più numeroso. */
  families: string[][];
  /** Posizioni che non si muovono con nessun'altra. */
  independent: string[];
}

/** Raggruppa le posizioni legate da una correlazione ≥ soglia (a catena: se A≈B e B≈C stanno insieme). */
export function correlationFamilies(matrix: CorrelationMatrix, threshold = FAMILY_CORRELATION): CorrelationFamilies {
  const ids = matrix.instrumentIds;
  const parent = ids.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const value = matrix.values[i]?.[j];
      if (typeof value === "number" && value >= threshold) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, string[]>();
  ids.forEach((id, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), id]));
  const all = [...groups.values()];
  return {
    families: all.filter((g) => g.length > 1).sort((a, b) => b.length - a.length),
    independent: all.filter((g) => g.length === 1).map((g) => g[0]),
  };
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
