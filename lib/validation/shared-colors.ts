/** Palette di 8 colori condivisa da conti e categorie, per coerenza visiva tra le due entità. */
export const SWATCH_COLORS = [
  "slate",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "red",
  "teal",
] as const;
export type SwatchColor = (typeof SWATCH_COLORS)[number];
