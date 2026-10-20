/**
 * Schermate dell'app mostrate nella landing. Non sono disegnate a mano: sono screenshot dell'app vera con dati
 * demo, generati da `scripts/capture-screens.mjs` (vedi `docs/landing-screens.md`). Ogni voce punta alla route reale
 * dell'app: il test `screens.test.ts` fallisce se la route non esiste più o se mancano i file immagine.
 */

export type ScreenTheme = "light" | "dark";
export const SCREEN_THEMES: readonly ScreenTheme[] = ["light", "dark"];

/**
 * Interface languages the screens are captured in (the app's languages). Italian is the default and lives at the root
 * of `public/screens/`; the others in `public/screens/<language>/`. The landing shows the visitor's browser language.
 */
export type ScreenLanguage = "it" | "en" | "de";
export const SCREEN_LANGUAGES: readonly ScreenLanguage[] = ["it", "en", "de"];
export const DEFAULT_SCREEN_LANGUAGE: ScreenLanguage = "it";
/** Language shown instead when a screen does not exist in a language (German accounts follow German product rules). */
const SCREEN_LANGUAGE_FALLBACK: Partial<Record<ScreenLanguage, ScreenLanguage>> = { de: "en", en: "it" };

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
  /** Salva anche `<id>-top.webp`, solo la parte alta a 1280×800, per i riquadri a proporzione fissa. */
  topCrop?: boolean;
  /** Also saves `<id>-phone.webp`: the first screen at phone size (390×751 at 2x, an iPhone screen minus status bar and home indicator), for the phone frame (home and gallery on the phone). */
  phone?: boolean;
  /** Pagina con un segmento dinamico (`[id]`): si apre `route` e si clicca il link con questo testo, così l'id non va scritto a mano. */
  open?: { route: string; clickText: string };
  /** Languages whose demo account cannot open this screen (its product country hides it): the landing falls back. */
  unavailableIn?: readonly ScreenLanguage[];
}

export const SCREENS = [
  { id: "panoramica", area: "Panoramica", label: "Panoramica", route: "/panoramica", topCrop: true, phone: true, caption: "Quanto hai in tutto e com'è diviso: conti, investimenti, pensione e debiti.", alt: "Panoramica: patrimonio netto, grafico nel tempo e ripartizione per classe di asset" },
  { id: "conti", area: "Liquidità", label: "Conti", route: "/liquidita/conti", phone: true, caption: "La banca collegata e i conti aggiunti a mano, con i saldi.", alt: "Conti: conto collegato alla banca e conti manuali con saldi" },
  { id: "movimenti", area: "Liquidità", label: "Movimenti", route: "/liquidita", maxHeight: 1200, phone: true, caption: "Saldo, andamento e tutti i movimenti; la categoria si cambia con un tocco.", alt: "Movimenti: elenco delle transazioni con categorie e importi" },
  { id: "analisi", area: "Liquidità", label: "Analisi", route: "/liquidita/analisi", phone: true, caption: "Entrate, uscite e quanto resta, mese per mese.", alt: "Analisi: entrate contro uscite per mese e indicatori di risparmio", clickFirst: "Anno" },
  { id: "abbonamenti", area: "Liquidità", label: "Abbonamenti", route: "/liquidita/abbonamenti", phone: true, caption: "Gli addebiti che tornano ogni mese, trovati da soli: quanto pesano e quando arriva il prossimo.", alt: "Abbonamenti: costo mensile e annuale, abbonamenti da confermare e prossimo addebito" },
  { id: "categorie", area: "Liquidità", label: "Categorie", route: "/liquidita/categorie", phone: true, caption: "I quattro gruppi di spesa, le entrate e i giri di soldi tra i tuoi conti.", alt: "Categorie divise per gruppi di spesa, entrate e trasferimenti" },
  { id: "categorizza", area: "Liquidità", label: "Categorizza", route: "/categorizza", phone: true, caption: "L'app mette la categoria da sola quando è sicura; a te restano solo i dubbi.", alt: "Categorizza: una carta per esercente con le date dei movimenti e la categoria proposta con la sua origine" },
  { id: "investimenti", area: "Investimenti", label: "Portafoglio", route: "/investimenti", phone: true, caption: "Quanto vale il portafoglio, quanto ci hai messo e quanto hai guadagnato, titolo per titolo.", alt: "Investimenti: valore del portafoglio, versato contro mercato e posizioni" },
  { id: "performance", area: "Investimenti", label: "Performance", route: "/investimenti/performance", phone: true, caption: "Il guadagno vero, a confronto con il mercato e con l'inflazione.", alt: "Performance: rendimento del portafoglio a confronto con un indice" },
  { id: "diversificazione", area: "Investimenti", label: "Diversificazione", route: "/investimenti/diversificazione", phone: true, caption: "Dove sono i tuoi soldi, per paese e settore, guardando dentro gli ETF.", alt: "Diversificazione: ripartizione del portafoglio per area e settore" },
  { id: "titolo", area: "Investimenti", label: "Scheda titolo", route: "/investimenti/titoli/[id]", open: { route: "/investimenti", clickText: "Ferrari N.V." }, phone: true, maxHeight: 1200, caption: "La pagina di un titolo: prezzo, andamento, rischio, la tua posizione e i conti dell'azienda.", alt: "Scheda di un'azione: prezzo e numeri in breve, grafico con gli acquisti, rischio e posizione" },
  { id: "tasse", area: "Investimenti", label: "Tasse", route: "/investimenti/tasse", phone: true, caption: "Guadagni, perdite da scalare e tasse stimate se vendi.", alt: "Tasse: stima della fiscalità italiana sul portafoglio" },
  { id: "pensione", unavailableIn: ["de"], area: "Pensione", label: "Pensione", route: "/pensione", phone: true, caption: "Quanto hai versato nel fondo, quanto vale e quanto rende davvero.", alt: "Pensione: valore del fondo, contributi versati e rendimento reale" },
  { id: "pensione-scenari", unavailableIn: ["de"], area: "Pensione", label: "Se ritiri oggi", route: "/pensione/scenari", phone: true, caption: "Quanto ti resterebbe prelevando oggi, tasse tolte, e il confronto con il TFR in azienda.", alt: "Pensione: stima netta di un prelievo oggi e confronto con il TFR lasciato in azienda" },
  { id: "debiti", area: "Debiti", label: "Debiti", route: "/debiti", phone: true, caption: "Le prossime rate, dove paghi più interessi e come chiudere prima.", alt: "Debiti: prossime rate, interessi in un anno per debito e percorso per estinguerli prima" },
  { id: "simulatore", area: "Debiti", label: "Simulazione", route: "/debiti/finanziamenti", phone: true, caption: "Un finanziamento con le prove «E se…»: pagare di più, chiudere prima, cambiare banca.", alt: "Dettaglio di un finanziamento con residuo, anello di avanzamento e simulazione", scrollToText: "E se…", maxHeight: 1000 },
  { id: "analitiche", unavailableIn: ["de"], area: "Analitiche", label: "E se…", route: "/analitiche", phone: true, caption: "L'anno in cui puoi smettere di lavorare, che si sposta mentre muovi risparmio, spesa e rendimento.", alt: "Analitiche: l'anno del traguardo, quattro cursori per provare le ipotesi e il grafico del patrimonio verso il numero FIRE" },
] as const satisfies readonly AppScreen[];

/** Id di una schermata (tipo chiuso: finisce negli eventi Umami). */
export type ScreenId = (typeof SCREENS)[number]["id"];

/** Language whose capture is shown for `id` in `language`: the language itself, or its fallback if the screen is missing there. */
export function screenLanguage(id: ScreenId, language: ScreenLanguage): ScreenLanguage {
  const screen: AppScreen | undefined = SCREENS.find((s) => s.id === id);
  let current = language;
  while (screen?.unavailableIn?.includes(current)) current = SCREEN_LANGUAGE_FALLBACK[current] ?? DEFAULT_SCREEN_LANGUAGE;
  return current;
}

/** Folder of a language's captures under `public/` (Italian at the root, for the default). */
export function screenDir(language: ScreenLanguage, theme: ScreenTheme): string {
  return language === DEFAULT_SCREEN_LANGUAGE ? `/screens/${theme}` : `/screens/${language}/${theme}`;
}

/** Percorso pubblico dell'immagine di una schermata nel tema dato (`top`: solo la parte alta, se catturata). */
export function screenSrc(id: ScreenId, theme: ScreenTheme, top = false, language: ScreenLanguage = DEFAULT_SCREEN_LANGUAGE): string {
  return `${screenDir(screenLanguage(id, language), theme)}/${id}${top ? "-top" : ""}.webp`;
}

/** Path of the phone-size version (first screen, 390×751 at 2x), only for screens with `phone`. */
export function screenPhoneSrc(id: ScreenId, theme: ScreenTheme, language: ScreenLanguage = DEFAULT_SCREEN_LANGUAGE): string {
  return `${screenDir(screenLanguage(id, language), theme)}/${id}-phone.webp`;
}

/** Larghezza della versione leggera (`-sm`), catturata a 1x per i telefoni. */
export const SCREEN_SMALL_WIDTH = 1280;

/** Percorso della versione leggera a 1x di una schermata intera. */
export function screenSmallSrc(id: ScreenId, theme: ScreenTheme, language: ScreenLanguage = DEFAULT_SCREEN_LANGUAGE): string {
  return `${screenDir(screenLanguage(id, language), theme)}/${id}-sm.webp`;
}
