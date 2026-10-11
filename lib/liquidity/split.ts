/** Opzioni del "Dividi": quanta parte di un movimento conta davvero come tua. Logica pura. */

export interface SplitPreset {
  key: string;
  label: string;
  /** Su quante quote uguali si divide l'importo (1 = tutto è tuo). */
  parts: number;
}

export const SPLIT_PRESETS: readonly SplitPreset[] = [
  { key: "tutta", label: "Tutta", parts: 1 },
  { key: "meta", label: "Metà", parts: 2 },
  { key: "terzo", label: "Un terzo", parts: 3 },
  { key: "quarto", label: "Un quarto", parts: 4 },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Riporta la quota tua nell'intervallo [0, totale]; un valore non numerico vale il totale. */
export function clampOwnShare(share: number, total: number): number {
  if (Number.isNaN(share)) return total;
  return round2(Math.min(Math.max(share, 0), total));
}

/** Quota tua per un preset: l'importo diviso per il numero di parti. */
export function ownShareForPreset(total: number, parts: number): number {
  return clampOwnShare(total / parts, total);
}

/** Parte esclusa dal conteggio (quella da salvare) data la quota tua. */
export function excludedFromOwnShare(total: number, ownShare: number): number {
  return round2(total - clampOwnShare(ownShare, total));
}

/** Preset che corrisponde esattamente alla quota tua, se c'è. */
export function matchPreset(total: number, ownShare: number): SplitPreset | null {
  return SPLIT_PRESETS.find((p) => Math.abs(ownShareForPreset(total, p.parts) - ownShare) < 0.005) ?? null;
}
