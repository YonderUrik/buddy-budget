import type { InstrumentType } from "@/lib/db/schema/investments";

/**
 * Colore di ogni tipo di strumento, dalla palette `--swatch-*` già usata dai grafici delle categorie: lo stesso tipo
 * ha lo stesso colore nelle posizioni e nella composizione, così la pagina si legge a colpo d'occhio.
 */
export const INSTRUMENT_TYPE_COLOR: Record<InstrumentType, string> = {
  etf: "var(--swatch-blue)",
  azione: "var(--swatch-violet)",
  obbligazione: "var(--swatch-teal)",
  fondo: "var(--swatch-amber)",
  crypto: "var(--swatch-orange)",
  etc: "var(--swatch-slate)",
};

/** Colori delle valute, in ordine di peso: la valuta principale prende il primo. */
export const CURRENCY_COLORS = [
  "var(--swatch-blue)",
  "var(--swatch-rose)",
  "var(--swatch-emerald)",
  "var(--swatch-amber)",
  "var(--swatch-violet)",
] as const;
