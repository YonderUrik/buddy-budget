/**
 * Palette colori condivisa da Conti e Categorie: 16 colori base + una variante chiara
 * e una scura per ciascuno (32), per un totale di 48. Le varianti non sono selezionabili
 * manualmente nei picker (solo i 16 base) — esistono per la distribuzione automatica dei
 * colori quando le categorie superano i 16 base senza ripetizioni.
 */
export const SWATCH_BASE_COLORS = [
  "slate", "blue", "green", "yellow", "purple", "orange", "red", "teal",
  "pink", "indigo", "cyan", "lime", "amber", "rose", "violet", "emerald",
] as const;
export type SwatchBaseColor = (typeof SWATCH_BASE_COLORS)[number];

const SWATCH_LIGHT_COLORS = [
  "slate-light", "blue-light", "green-light", "yellow-light", "purple-light", "orange-light",
  "red-light", "teal-light", "pink-light", "indigo-light", "cyan-light", "lime-light",
  "amber-light", "rose-light", "violet-light", "emerald-light",
] as const;

const SWATCH_DARK_COLORS = [
  "slate-dark", "blue-dark", "green-dark", "yellow-dark", "purple-dark", "orange-dark",
  "red-dark", "teal-dark", "pink-dark", "indigo-dark", "cyan-dark", "lime-dark",
  "amber-dark", "rose-dark", "violet-dark", "emerald-dark",
] as const;

export const SWATCH_COLORS = [
  ...SWATCH_BASE_COLORS,
  ...SWATCH_LIGHT_COLORS,
  ...SWATCH_DARK_COLORS,
] as const;
export type SwatchColor = (typeof SWATCH_COLORS)[number];
