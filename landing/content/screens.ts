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
  /** Altezza massima (px CSS) di questa schermata, se la pagina intera è troppo lunga per la landing. */
  maxHeight?: number;
  /** Salva anche `<id>-top.jpg`, solo la parte alta a 1280×800, per i riquadri a proporzione fissa. */
  topCrop?: boolean;
  /** Salva anche `<id>-phone.jpg`: il primo schermo a misura di telefono (390×844 a 2x), per la cornice da telefono della home. */
  phone?: boolean;
  /** Pagina con un segmento dinamico (`[id]`): si apre `route` e si clicca il link con questo testo, così l'id non va scritto a mano. */
  open?: { route: string; clickText: string };
}

export const SCREENS = [
  { id: "panoramica", area: "Panoramica", label: "Panoramica", route: "/panoramica", topCrop: true, phone: true, caption: "Patrimonio netto nel tempo, per liquidità, investimenti, previdenza e debiti.", alt: "Panoramica: patrimonio netto, grafico nel tempo e ripartizione per classe di asset" },
  { id: "conti", area: "Liquidità", label: "Conti", route: "/liquidita/conti", caption: "Banca collegata e conti manuali, con la liquidità dell'ultimo mese.", alt: "Conti: conto collegato alla banca e conti manuali con saldi" },
  { id: "movimenti", area: "Liquidità", label: "Movimenti", route: "/liquidita", maxHeight: 1200, caption: "Saldo, andamento e movimenti di tutti i conti; la categoria si cambia con un tocco.", alt: "Movimenti: elenco delle transazioni con categorie e importi" },
  { id: "analisi", area: "Liquidità", label: "Analisi", route: "/liquidita/analisi", phone: true, caption: "Entrate, uscite, netto e risparmio, mese per mese.", alt: "Analisi: entrate contro uscite per mese e indicatori di risparmio", clickFirst: "Anno" },
  { id: "abbonamenti", area: "Liquidità", label: "Abbonamenti", route: "/liquidita/abbonamenti", caption: "Gli addebiti che tornano, trovati nei movimenti: quanto pesano al mese, il prossimo addebito e gli aumenti di prezzo.", alt: "Abbonamenti: costo mensile e annuale, abbonamenti da confermare e prossimo addebito" },
  { id: "categorie", area: "Liquidità", label: "Categorie", route: "/liquidita/categorie", caption: "Quattro gruppi di spesa, entrate e trasferimenti tra i tuoi conti esclusi dai conteggi.", alt: "Categorie divise per gruppi di spesa, entrate e trasferimenti" },
  { id: "categorizza", area: "Liquidità", label: "Categorizza", route: "/categorizza", caption: "Quando è quasi certa l'app mette la categoria da sola: tu scegli solo i dubbi, con date, importi e il perché di ogni proposta.", alt: "Categorizza: una carta per esercente con le date dei movimenti e la categoria proposta con la sua origine" },
  { id: "investimenti", area: "Investimenti", label: "Portafoglio", route: "/investimenti", caption: "Valore, versato e guadagno del mercato, posizione per posizione.", alt: "Investimenti: valore del portafoglio, versato contro mercato e posizioni" },
  { id: "performance", area: "Investimenti", label: "Performance", route: "/investimenti/performance", phone: true, caption: "Rendimento vero, contro un indice e al netto dell'inflazione.", alt: "Performance: rendimento del portafoglio a confronto con un indice" },
  { id: "diversificazione", area: "Investimenti", label: "Diversificazione", route: "/investimenti/diversificazione", caption: "Per area e settore, guardando dentro gli ETF.", alt: "Diversificazione: ripartizione del portafoglio per area e settore" },
  { id: "titolo", area: "Investimenti", label: "Scheda titolo", route: "/investimenti/titoli/[id]", open: { route: "/investimenti", clickText: "Energia Italia S.p.A." }, phone: true, maxHeight: 1200, caption: "La scheda di un titolo: prezzo e andamento, rischio, la tua posizione e, per le azioni, multipli e bilanci.", alt: "Scheda di un'azione: prezzo e numeri in breve, grafico con gli acquisti, rischio e posizione" },
  { id: "tasse", area: "Investimenti", label: "Tasse", route: "/investimenti/tasse", phone: true, caption: "Plus e minus, zaino a 4 anni e imposta stimata.", alt: "Tasse: stima della fiscalità italiana sul portafoglio" },
  { id: "pensione", area: "Pensione", label: "Pensione", route: "/pensione", caption: "Contributi, valore e rendimento reale del fondo, da due numeri per fotografia.", alt: "Pensione: valore del fondo, contributi versati e rendimento reale" },
  { id: "pensione-scenari", area: "Pensione", label: "Se ritiri oggi", route: "/pensione/scenari", caption: "Quanto ti resterebbe oggi al netto delle tasse e il confronto con il TFR in azienda.", alt: "Pensione: stima netta di un prelievo oggi e confronto con il TFR lasciato in azienda" },
  { id: "debiti", area: "Debiti", label: "Debiti", route: "/debiti", phone: true, caption: "Le prossime rate, dove paghi più interessi e come uscirne prima.", alt: "Debiti: prossime rate, interessi in un anno per debito e percorso per estinguerli prima" },
  { id: "simulatore", area: "Debiti", label: "Simulazione", route: "/debiti/finanziamenti", caption: "Finanziamento con le ipotesi «E se…»: versare di più, estinguere, cambiare banca.", alt: "Dettaglio di un finanziamento con residuo, anello di avanzamento e simulazione", scrollToText: "E se…", maxHeight: 1000 },
  { id: "analitiche", area: "Analitiche", label: "E se…", route: "/analitiche", phone: true, caption: "L'anno in cui puoi smettere di lavorare, che si sposta mentre muovi risparmio, spesa, rendimento e prelievo.", alt: "Analitiche: l'anno del traguardo, quattro cursori per provare le ipotesi e il grafico del patrimonio verso il numero FIRE" },
] as const satisfies readonly AppScreen[];

/** Id di una schermata (tipo chiuso: finisce negli eventi Umami). */
export type ScreenId = (typeof SCREENS)[number]["id"];

/** Percorso pubblico dell'immagine di una schermata nel tema dato (`top`: solo la parte alta, se catturata). */
export function screenSrc(id: ScreenId, theme: ScreenTheme, top = false): string {
  return `/screens/${theme}/${id}${top ? "-top" : ""}.jpg`;
}

/** Percorso della versione a misura di telefono (primo schermo, 390×844 a 2x), solo per le schermate con `phone`. */
export function screenPhoneSrc(id: ScreenId, theme: ScreenTheme): string {
  return `/screens/${theme}/${id}-phone.jpg`;
}

/** Larghezza della versione leggera (`-sm`), catturata a 1x per i telefoni. */
export const SCREEN_SMALL_WIDTH = 1280;

/** Percorso della versione leggera a 1x di una schermata intera. */
export function screenSmallSrc(id: ScreenId, theme: ScreenTheme): string {
  return `/screens/${theme}/${id}-sm.jpg`;
}
