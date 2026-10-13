import type { FeatureArea } from "@/content/catalog.generated";
import type { ScreenId } from "@/content/screens";
import type { TourId } from "@/content/sheet";

/** Sezioni della pagina misurate con `section_view`. */
export type SectionId =
  | "hero" | "fonti" | "app" | "italia" | "schermate" | "funzioni" | "sicurezza" | "codice" | "perchi" | "confronto"
  | "domande" | "fine";

/**
 * Eventi di prodotto della landing inviati a Umami (sito Umami proprio della landing, non quello dell'app).
 * Props solo categoriche: mai dati personali. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface LandingEvents {
  cta_click: { location: "nav" | "hero" | "closing" | "funzioni" | "schermate" | "calcolatore_zainetto" | "calcolatore_ammortamento" | "calcolatore_risparmio" | "strumenti" | "fonti" | "guida_zainetto" | "funzione_investimenti" | "sicurezza"; target: "signup" | "login" | "calculator" };
  section_view: { section: SectionId };
  /** Apertura: il foglio d'esempio passa alla Panoramica dell'app, o torna al foglio. */
  sheet_view_toggled: { view: "foglio" | "app" };
  /** «L'app, area per area»: scheda aperta (conti, investimenti, tasse, debiti, pensione, futuro, limiti). */
  tour_tab_selected: { tab: TourId };
  screen_selected: { screen: ScreenId };
  catalog_area_selected: { area: FeatureArea };
  simulator_used: { instrument: "azioni_etf" | "titoli_stato" };
  /** Calcolatore dell'obiettivo di risparmio: prima modifica di un campo (con o senza il risparmio in più). */
  savings_goal_used: { field: "obiettivo" | "partenza" | "mensile" | "rendimento" | "extra" };
  hide_amounts_toggled: { hidden: boolean };
  theme_toggled: { theme: "light" | "dark" };
  /** Pagina /sicurezza: passaggio aperto nel diagramma del percorso dei dati. */
  security_node_selected: { node: "tu" | "banca" | "gocardless" | "buddybudget" };
  source_link_click: { location: "footer" | "sezione" };
  /** Fonti supportate: clic su una banca o un broker, che porta all'accesso. */
  source_card_click: { kind: "banca" | "broker" };
}

export type LandingEventName = keyof LandingEvents;

type UmamiTracker = { track: (event: string, data?: Record<string, string | number | boolean>) => unknown };

function getUmami(): UmamiTracker | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { umami?: UmamiTracker }).umami;
}

/** Invia un evento a Umami. No-op senza tracker (dev, adblock) e non lancia mai: la landing non dipende dalla misura. */
export function track<E extends LandingEventName>(
  name: E,
  ...args: LandingEvents[E] extends undefined ? [] : [props: LandingEvents[E]]
): void {
  try {
    const umami = getUmami();
    if (!umami) return;
    const [props] = args as [Record<string, string | number | boolean>?];
    if (props) umami.track(name, props);
    else umami.track(name);
  } catch {
    // il tracker può essere bloccato dal browser: ignorare
  }
}
