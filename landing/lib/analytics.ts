import type { FeatureArea } from "@/content/catalog.generated";
import type { ShowcaseId } from "@/content/home";
import type { ScreenId } from "@/content/screens";
import type { Locale } from "@/lib/i18n";

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
    /** Language of the page the click came from. */
    lang: Locale;
  };
  /** «Prova la demo» / "Try the demo": the button towards the app's public read-only demo. */
  demo_click: { location: LandingEvents["cta_click"]["location"]; lang: Locale };
  /** The language menu, or the "also available in English" bar of the Italian home. */
  language_switch_click: { from: Locale; to: Locale; location: "nav" | "menu" | "footer" | "hint" };
  /** An Italian page replaced by its English counterpart because the visitor's country does not speak Italian (no country sent). */
  language_auto_switched: { from: "it"; to: "en" };
  /** The "also available in English" bar closed without following it. */
  language_hint_dismissed: undefined;
  section_view: { section: SectionId };
  /** Home, «Da quattro posti»: the visitor typed an amount of their own (once per page view), or put the sample back. */
  sum_edited: undefined;
  sum_reset: undefined;
  /** Home: a tab of «Cosa ti dice» chosen (by tap or by swipe). */
  showcase_tab_selected: { tab: ShowcaseId };
  screen_selected: { screen: ScreenId };
  catalog_area_selected: { area: FeatureArea };
  theme_toggled: { theme: "light" | "dark" };
  source_link_click: { location: "footer" | "sezione" };
  /** A link to one of the brand's social profiles. */
  social_link_click: { network: "instagram"; location: "footer" };
  /** Home, «Sotto il cofano»: the self-hosting commands copied. */
  self_host_command_copied: undefined;
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
