/** Elementi della barra laterale che l'utente può mostrare o nascondere (preferenza per dispositivo, in localStorage). */

export const SIDEBAR_MODULES = [
  { id: "oggi", label: "Patrimonio netto", hint: "Il totale di oggi e la variazione dell'ultimo mese." },
  { id: "portafoglio", label: "Portafoglio", hint: "Valore degli investimenti e posizioni principali." },
  { id: "watchlist", label: "Watchlist", hint: "I titoli che segui, con gli avvisi di prezzo scattati." },
  { id: "scadenze", label: "Prossime scadenze", hint: "Rate dei finanziamenti e collegamenti bancari da rinnovare." },
  { id: "fire", label: "Obiettivo FIRE", hint: "Quanto manca al numero FIRE, con le ipotesi di Analitiche." },
] as const;

export type SidebarModuleId = (typeof SIDEBAR_MODULES)[number]["id"];

/** Tutti i moduli sono accesi finché l'utente non li spegne. */
export const SIDEBAR_MODULE_DEFAULT = true;

/** Chiave di localStorage del modulo. */
export const sidebarModuleKey = (id: SidebarModuleId): string => `bb:sidebar:module:${id}`;

/** Barra di navigazione in basso su mobile: se spenta torna il menu a scomparsa con l'hamburger. */
export const BOTTOM_NAV_KEY = "bb:mobile:bottom-nav";
export const BOTTOM_NAV_DEFAULT = true;
