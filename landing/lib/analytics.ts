import type { FeatureArea } from "@/content/catalog.generated";
import type { ScreenId } from "@/content/screens";
import type { StoryStepId } from "@/content/story";

/** Sezioni misurate con `section_view`: la storia e le sezioni in coda della home, più la galleria delle schermate. */
export type SectionId = "storia" | "con" | "sicurezza" | "codice" | "regole" | "strumenti" | "domande" | "fine" | "schermate";

/**
 * Eventi di prodotto della landing inviati a Umami (sito Umami proprio della landing, non quello dell'app).
 * Props solo categoriche: mai dati personali. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface LandingEvents {
  cta_click: {
    location: "nav" | "hero" | "story" | "closing" | "funzioni" | "schermate" | "strumenti" | "calcolatore_zainetto" | "calcolatore_ammortamento" | "calcolatore_obiettivo" | "guida_zainetto" | "funzione_investimenti" | "sicurezza";
    target: "signup" | "login" | "calculator";
  };
  section_view: { section: SectionId };
  /** Home: un passo della storia è entrato in vista per la prima volta (fin dove arriva chi legge). */
  story_step_viewed: { step: StoryStepId };
  /** Home: «Vedi la schermata vera» acceso o spento su un passo con il pannello vivo. */
  story_real_toggled: { step: StoryStepId; real: boolean };
  screen_selected: { screen: ScreenId };
  catalog_area_selected: { area: FeatureArea };
  theme_toggled: { theme: "light" | "dark" };
  /** Pagina /sicurezza: passaggio aperto nel diagramma del percorso dei dati. */
  security_node_selected: { node: "tu" | "banca" | "fornitore" | "buddybudget" };
  source_link_click: { location: "footer" | "sezione" };
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
