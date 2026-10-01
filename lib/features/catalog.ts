/**
 * Catalogo delle funzionalità di BuddyBudget: unica fonte per la landing, il pannello "In arrivo" del login
 * e il test di coerenza con la sidebar. Solo dati (nessuna dipendenza), così si può importare anche da `landing/`.
 * Quando una funzionalità cambia stato o ne nasce una nuova, si aggiorna QUI e basta.
 */

/** `live` = disponibile in produzione; `soon` = annunciata ma non ancora implementata. */
export type FeatureStatus = "live" | "soon";

export interface Feature {
  /** Identificatore stabile (kebab-case). */
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  /** Voce di sidebar corrispondente (pathname nell'app), se la funzionalità ha una schermata propria. */
  appPath?: string;
}

export const FEATURES: readonly Feature[] = [
  { id: "panoramica", name: "Panoramica", description: "Il patrimonio netto per classe di asset, in un colpo d'occhio.", status: "live", appPath: "/panoramica" },
  { id: "conti", name: "Conti", description: "Conti manuali e collegamento alla banca via Open Banking, con sincronizzazione automatica.", status: "live", appPath: "/conti" },
  { id: "movimenti", name: "Movimenti", description: "Transazioni, entrate e uscite, budget per categoria e gruppi di spesa (Dovute, Volute, Te futuro, Saltuarie).", status: "live", appPath: "/movimenti" },
  { id: "categorizzazione", name: "Categorizzazione a regole", description: "Regole sui merchant che categorizzano per te, mai in modo opaco: ogni suggerimento lo confermi tu.", status: "live" },
  { id: "investimenti", name: "Investimenti", description: "Operazioni, PAC, rendimenti e benchmark, rischio e diversificazione, fiscalità italiana, proventi, watchlist e avvisi di prezzo.", status: "live", appPath: "/investimenti" },
  { id: "debiti", name: "Debiti", description: "Finanziamenti con piano di ammortamento, estinzioni anticipate e rate segnate a mano.", status: "live", appPath: "/debiti" },
  { id: "pensione", name: "Pensione", description: "Il tuo fondo pensione e una stima di quanto varrà.", status: "soon", appPath: "/pensione" },
  { id: "pianifica", name: "Pianifica", description: "Simula un cambio di lavoro, una casa o un figlio e vedi l'effetto sul patrimonio.", status: "soon", appPath: "/pianifica" },
  { id: "analitiche", name: "Analitiche", description: "Autonomia finanziaria, tasso di risparmio reale e radar degli abbonamenti.", status: "soon", appPath: "/analitiche" },
];

/** Funzionalità con lo stato richiesto, nell'ordine del catalogo. */
export function featuresByStatus(status: FeatureStatus): Feature[] {
  return FEATURES.filter((feature) => feature.status === status);
}
