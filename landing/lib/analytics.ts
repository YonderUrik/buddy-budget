import type { FeatureArea } from "@/content/catalog.generated";
import type { ScreenId } from "@/content/screens";

/** Sezioni della pagina misurate con `section_view`. */
export type SectionId = "hero" | "perche" | "prodotto" | "schermate" | "funzioni" | "confronto" | "fine";

/**
 * Eventi di prodotto della landing inviati a Umami (sito Umami proprio della landing, non quello dell'app).
 * Props solo categoriche: mai dati personali. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface LandingEvents {
  cta_click: { location: "nav" | "hero" | "closing"; target: "signup" | "login" | "how_it_works" };
  section_view: { section: SectionId };
  tour_step_viewed: { step: "collega" | "capisci" | "investi" | "decidi" };
  screen_selected: { screen: ScreenId };
  catalog_area_selected: { area: FeatureArea };
  simulator_used: { instrument: "azioni_etf" | "titoli_stato" };
  hide_amounts_toggled: { hidden: boolean };
  theme_toggled: { theme: "light" | "dark" };
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
