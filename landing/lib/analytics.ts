import type { FeatureArea } from "@/content/catalog.generated";
import type { ShowcaseId } from "@/content/home";
import type { ScreenId } from "@/content/screens";

/** Sections measured with `section_view`: the home sections, the closing (home and content pages) and the screen gallery. */
export type SectionId = "come" | "dentro" | "sicurezza" | "codice" | "domande" | "fine" | "schermate";

/**
 * Product events of the landing sent to Umami (the landing's own Umami site, not the app's).
 * Categorical props only: never personal data. Add an event here before using it (the type is closed on purpose).
 */
export interface LandingEvents {
  cta_click: {
    location: "nav" | "hero" | "mobile_bar" | "dentro" | "closing" | "funzioni" | "schermate" | "strumenti" | "calcolatore_zainetto" | "calcolatore_ammortamento" | "calcolatore_obiettivo" | "guida_zainetto" | "funzione_investimenti" | "sicurezza";
    target: "signup" | "login" | "calculator" | "how";
  };
  section_view: { section: SectionId };
  /** Home: a tab of «Cosa ti dice» chosen (by tap or by swipe). */
  showcase_tab_selected: { tab: ShowcaseId };
  screen_selected: { screen: ScreenId };
  catalog_area_selected: { area: FeatureArea };
  theme_toggled: { theme: "light" | "dark" };
  /** /sicurezza page: step opened in the data path diagram. */
  security_node_selected: { node: "tu" | "banca" | "gocardless" | "buddybudget" };
  source_link_click: { location: "footer" | "sezione" };
  /** «‹» back link above the title of an internal page. */
  back_link_click: { to: "home" | "strumenti" | "funzioni" | "altro" };
}

export type LandingEventName = keyof LandingEvents;

type UmamiTracker = { track: (event: string, data?: Record<string, string | number | boolean>) => unknown };

function getUmami(): UmamiTracker | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { umami?: UmamiTracker }).umami;
}

/** Sends an event to Umami. No-op without the tracker (dev, adblock) and never throws: the landing does not depend on the measure. */
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
    // the tracker can be blocked by the browser: ignore
  }
}
