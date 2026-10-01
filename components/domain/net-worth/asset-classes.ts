/** Colori ed etichette delle classi di asset, condivisi tra il grafico del patrimonio e la composizione. */

/** Colore di ogni classe di asset (token del tema). */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  liquidita: "var(--swatch-teal)",
  investimenti: "var(--primary)",
  debiti: "var(--neg)",
};
export const FALLBACK_ASSET_CLASS_COLOR = "var(--swatch-slate)";

/** Etichetta leggibile di ogni classe di asset. */
export const ASSET_CLASS_LABELS: Record<string, string> = {
  liquidita: "Liquidità",
  investimenti: "Investimenti",
  debiti: "Debiti",
};

/** Ordine di impilamento nel grafico, dal basso: la liquidità fa da base. */
export const ASSET_CLASS_ORDER = ["liquidita", "investimenti", "debiti"];

export function assetClassColor(key: string): string {
  return ASSET_CLASS_COLORS[key] ?? FALLBACK_ASSET_CLASS_COLOR;
}

export function assetClassLabel(key: string): string {
  return ASSET_CLASS_LABELS[key] ?? key;
}

/** Classi presenti nella serie (con almeno un valore diverso da zero), nell'ordine di impilamento. */
export function assetClassesInSeries(series: { byClass: Record<string, number> }[]): string[] {
  const present = new Set<string>();
  for (const point of series) {
    for (const [key, value] of Object.entries(point.byClass)) if (value !== 0) present.add(key);
  }
  const rank = (key: string) => {
    const index = ASSET_CLASS_ORDER.indexOf(key);
    return index === -1 ? ASSET_CLASS_ORDER.length : index;
  };
  return [...present].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
