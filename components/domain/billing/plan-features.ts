/** What each plan contains, for the comparison on the plans page. `path` hides a line where the country has no such screen. */

export interface PlanFeatureLine {
  label: string;
  /** Screen the line stands for; a line whose screen is not offered in the user's country is not shown. */
  path?: string;
}

/** The Free plan: Liquidità and what feeds it. */
export const FREE_FEATURES: readonly PlanFeatureLine[] = [
  { label: "Conti e movimenti, collegati o importati da file" },
  { label: "Analisi delle spese e budget per categoria" },
  { label: "Categorie e regole automatiche" },
  { label: "Abbonamenti ricorrenti" },
];

/** The Pro plan: everything, on top of Free. */
export const PRO_FEATURES: readonly PlanFeatureLine[] = [
  { label: "Tutto quello che c'è nel piano gratuito" },
  { label: "Panoramica e patrimonio netto", path: "/panoramica" },
  { label: "Investimenti, rendimenti e tasse", path: "/investimenti" },
  { label: "Fondo pensione e TFR", path: "/pensione" },
  { label: "Debiti, mutui e finanziamenti", path: "/debiti" },
  { label: "Analitiche, simulazioni e obiettivi", path: "/analitiche" },
  { label: "Riepilogo e scadenze nella barra laterale" },
];
