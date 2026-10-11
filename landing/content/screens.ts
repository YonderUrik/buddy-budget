/**
 * Schermate dell'app mostrate nella landing. Non sono disegnate a mano: sono screenshot dell'app vera con dati
 * demo, generati da `scripts/capture-screens.mjs` (vedi `docs/landing-screens.md`). Ogni voce punta alla route reale
 * dell'app: il test `screens.test.ts` fallisce se la route non esiste più o se mancano i file immagine.
 */

export type ScreenTheme = "light" | "dark";
export const SCREEN_THEMES: readonly ScreenTheme[] = ["light", "dark"];

export interface AppScreen {
  /** Identificatore stabile, anche nome del file immagine. */
  id: string;
  /** Voce di sidebar (area) a cui appartiene. */
  area: "Panoramica" | "Liquidità" | "Investimenti" | "Pensione" | "Debiti" | "Analitiche";
  /** Etichetta breve per le schede della galleria. */
  label: string;
  /** Una riga che dice cosa mostra la schermata. */
  caption: string;
  /** Route dell'app (pathname) da cui si cattura lo screenshot. */
  route: string;
  /** Testo alternativo dell'immagine. */
  alt: string;
  /** Azione da fare sulla pagina prima dello scatto: clic su un bottone con questo nome (es. il periodo "Anno"). */
  clickFirst?: string;
  /** Campi da compilare prima dello scatto (etichetta del campo → valore), per mostrare un risultato e non un modulo vuoto. */
  fill?: readonly (readonly [label: string, value: string])[];
  /** Testo di un elemento da portare in vista prima dello scatto. */
  scrollToText?: string;
}

export const SCREENS = [
  { id: "panoramica", area: "Panoramica", label: "Panoramica", route: "/panoramica", caption: "Patrimonio netto nel tempo, per liquidità, investimenti, previdenza e debiti.", alt: "Panoramica: patrimonio netto, grafico nel tempo e ripartizione per classe di asset" },
  { id: "conti", area: "Liquidità", label: "Conti", route: "/liquidita/conti", caption: "Banca collegata e conti manuali, con la liquidità dell'ultimo mese.", alt: "Conti: conto collegato alla banca e conti manuali con saldi" },
  { id: "movimenti", area: "Liquidità", label: "Movimenti", route: "/liquidita", caption: "Saldo, andamento e movimenti di tutti i conti; la categoria si cambia con un tocco.", alt: "Movimenti: elenco delle transazioni con categorie e importi" },
  { id: "analisi", area: "Liquidità", label: "Analisi", route: "/liquidita/analisi", caption: "Entrate, uscite, netto e risparmio, mese per mese.", alt: "Analisi: entrate contro uscite per mese e indicatori di risparmio", clickFirst: "Anno" },
  { id: "abbonamenti", area: "Liquidità", label: "Abbonamenti", route: "/liquidita/abbonamenti", caption: "Gli addebiti che tornano, trovati nei movimenti: quanto pesano al mese, il prossimo addebito e gli aumenti di prezzo.", alt: "Abbonamenti: costo mensile e annuale, abbonamenti da confermare e prossimo addebito" },
  { id: "categorie", area: "Liquidità", label: "Categorie", route: "/liquidita/categorie", caption: "Quattro gruppi di spesa: Dovute, Volute, Te futuro, Saltuarie.", alt: "Categorie divise nei quattro gruppi di spesa" },
  { id: "categorizza", area: "Liquidità", label: "Categorizza", route: "/categorizza", caption: "Conferma un negozio una volta, le volte dopo lo riconosce.", alt: "Categorizza: proposte di categoria per i movimenti da sistemare" },
  { id: "investimenti", area: "Investimenti", label: "Portafoglio", route: "/investimenti", caption: "Valore, versato e guadagno del mercato, posizione per posizione.", alt: "Investimenti: valore del portafoglio, versato contro mercato e posizioni" },
  { id: "performance", area: "Investimenti", label: "Performance", route: "/investimenti/performance", caption: "Rendimento vero, contro un indice e al netto dell'inflazione.", alt: "Performance: rendimento del portafoglio a confronto con un indice" },
  { id: "diversificazione", area: "Investimenti", label: "Diversificazione", route: "/investimenti/diversificazione", caption: "Per area e settore, guardando dentro gli ETF.", alt: "Diversificazione: ripartizione del portafoglio per area e settore" },
  { id: "tasse", area: "Investimenti", label: "Tasse", route: "/investimenti/tasse", caption: "Plus e minus, zaino a 4 anni e imposta stimata.", alt: "Tasse: stima della fiscalità italiana sul portafoglio" },
  { id: "pensione", area: "Pensione", label: "Pensione", route: "/pensione", caption: "Contributi, valore e rendimento reale del fondo, da due numeri per fotografia.", alt: "Pensione: valore del fondo, contributi versati e rendimento reale" },
  { id: "pensione-scenari", area: "Pensione", label: "Se ritiri oggi", route: "/pensione/scenari", caption: "Quanto ti resterebbe oggi al netto delle tasse e il confronto con il TFR in azienda.", alt: "Pensione: stima netta di un prelievo oggi e confronto con il TFR lasciato in azienda" },
  { id: "debiti", area: "Debiti", label: "Debiti", route: "/debiti", caption: "Le prossime rate, dove paghi più interessi e come uscirne prima.", alt: "Debiti: prossime rate, interessi in un anno per debito e percorso per estinguerli prima" },
  { id: "simulatore", area: "Debiti", label: "Simulazione", route: "/debiti/finanziamenti", caption: "Finanziamento con le ipotesi «E se…»: versare di più, estinguere, cambiare banca.", alt: "Dettaglio di un finanziamento con residuo, anello di avanzamento e simulazione", scrollToText: "E se…" },
  { id: "analitiche", area: "Analitiche", label: "E se…", route: "/analitiche", caption: "L'anno in cui puoi smettere di lavorare, che si sposta mentre muovi risparmio, spesa, rendimento e prelievo.", alt: "Analitiche: l'anno del traguardo, quattro cursori per provare le ipotesi e il grafico del patrimonio verso il numero FIRE" },
] as const satisfies readonly AppScreen[];

/** Id di una schermata (tipo chiuso: finisce negli eventi Umami). */
export type ScreenId = (typeof SCREENS)[number]["id"];

/** Percorso pubblico dell'immagine di una schermata nel tema dato. */
export function screenSrc(id: ScreenId, theme: ScreenTheme): string {
  return `/screens/${theme}/${id}.jpg`;
}
