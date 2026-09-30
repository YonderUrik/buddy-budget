/**
 * Pagine selezionabili come "pagina iniziale" dopo il login. Tenute qui (layer lib) e non derivate da `NAV_ITEMS`
 * della sidebar, che vive nel layer layout: quando si aggiunge una schermata va aggiunta anche qui se ha senso come home.
 */
export const HOME_PAGE_OPTIONS = [
  { path: "/panoramica", label: "Panoramica" },
  { path: "/conti", label: "Conti" },
  { path: "/movimenti", label: "Movimenti" },
  { path: "/movimenti/analisi", label: "Analisi dei movimenti" },
  { path: "/investimenti", label: "Investimenti" },
] as const;

export type HomePagePath = (typeof HOME_PAGE_OPTIONS)[number]["path"];

/** Pagina iniziale di default (anche per chi ha un valore non più valido salvato). */
export const DEFAULT_HOME_PAGE: HomePagePath = "/panoramica";

/** True se `value` è una delle pagine iniziali ammesse. */
export function isHomePagePath(value: unknown): value is HomePagePath {
  return typeof value === "string" && HOME_PAGE_OPTIONS.some((option) => option.path === value);
}

/** Pagina iniziale dell'utente, con ripiego sul default se il valore salvato non è (più) valido. */
export function resolveHomePage(value: string | null | undefined): HomePagePath {
  return isHomePagePath(value) ? value : DEFAULT_HOME_PAGE;
}
