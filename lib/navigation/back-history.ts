/**
 * In-app navigation history behind the «‹» back button: a short stack of visited screens, kept in sessionStorage so
 * it survives a reload but never leaves the tab. The button goes back to the screen the user actually came from
 * (Liquidità → Investimenti → «‹ Liquidità»), also between main sections; with no known previous screen (first
 * visit, link from an email) a second-level page falls back to its logical parent, a main section shows no button.
 * It never calls `history.back()`, which could leave the app.
 */

/** Visible names of the app screens (Italian, translated by the button). */
const EXACT_NAMES: Record<string, string> = {
  "/panoramica": "Panoramica",
  "/liquidita": "Liquidità",
  "/liquidita/analisi": "Analisi",
  "/liquidita/conti": "Conti",
  "/liquidita/abbonamenti": "Abbonamenti",
  "/liquidita/categorie": "Categorie e regole",
  "/liquidita/regole": "Regole",
  "/investimenti": "Portafoglio",
  "/investimenti/performance": "Performance",
  "/investimenti/diversificazione": "Diversificazione",
  "/investimenti/proventi": "Dividendi",
  "/investimenti/tasse": "Tasse",
  "/investimenti/operazioni": "Operazioni",
  "/pensione": "Pensione",
  "/pensione/andamento": "Andamento",
  "/pensione/scenari": "Scenari",
  "/pensione/proiezione": "Proiezione",
  "/pensione/dati": "I tuoi dati",
  "/debiti": "Debiti",
  "/debiti/finanziamenti": "Finanziamenti",
  "/analitiche": "Analitiche",
  "/analitiche/obiettivi": "Obiettivi",
  "/categorizza": "Categorizza",
  "/importazioni": "Importazioni",
  "/impostazioni": "Impostazioni",
  "/aiuto": "Aiuto",
};

/** One-way flows: once finished, «‹» skips them (after creating a group it leads to Gruppi, not back to the form). */
const NOT_BACK_TARGETS = new Set(["/groups/new"]);

/** Detail pages, matched by prefix (the id after it is not shown). */
const PREFIX_NAMES: readonly (readonly [prefix: string, name: string])[] = [
  ["/investimenti/titoli/", "Titolo"],
  ["/analitiche/obiettivi/", "Obiettivo"],
  ["/groups/", "Gruppo"],
];

const PANORAMICA = { href: "/panoramica", label: "Panoramica" };

/** Logical parent of second-level pages, by path prefix (first match wins). Main sections have none. */
const PARENTS: readonly (readonly [prefix: string, parent: ParentPage])[] = [
  ["/investimenti/titoli/", { href: "/investimenti", label: "Portafoglio" }],
  ["/analitiche/obiettivi/", { href: "/analitiche/obiettivi", label: "Obiettivi" }],
  ["/debiti/finanziamenti", { href: "/debiti", label: "Debiti" }],
  ["/categorizza", { href: "/liquidita", label: "Liquidità" }],
  ["/importazioni", { href: "/liquidita", label: "Liquidità" }],
  ["/conti/collega/", { href: "/liquidita/conti", label: "Conti" }],
  ["/country-unavailable", PANORAMICA],
  ["/groups/", { href: "/impostazioni?sezione=gruppi", label: "Gruppi" }],
];

/**
 * Query parameters that make a different screen on the same path (a Settings group, a loan): kept in the history
 * key, so «‹» goes back from a group to the Settings list. Every other parameter (filters, `?conto=`) is the same
 * screen and only updates the last entry.
 */
const SCREEN_PARAMS = ["sezione", "id"] as const;

/** Maximum remembered entries: enough for any real back chain, small enough for sessionStorage. */
export const BACK_HISTORY_LIMIT = 20;

/** sessionStorage key of the stack. */
export const BACK_HISTORY_STORAGE_KEY = "bb.back-history";

export interface ParentPage {
  href: string;
  /** Name shown after «‹». */
  label: string;
}

export interface BackTarget extends ParentPage {
  /** `previous`: the screen the user came from; `parent`: the logical parent page (fallback). */
  source: "previous" | "parent";
}

/** Path of an address, without query and hash. */
export function pathOf(href: string): string {
  return href.split(/[?#]/, 1)[0] || "/";
}

/** Identity of a screen: its path plus the parameters in `SCREEN_PARAMS`. */
export function screenKey(href: string): string {
  const [path, rest = ""] = href.split("?", 2);
  const params = new URLSearchParams(rest.split("#", 1)[0]);
  const kept = SCREEN_PARAMS.filter((p) => params.has(p)).map((p) => `${p}=${params.get(p)}`);
  return kept.length > 0 ? `${path}?${kept.join("&")}` : path || "/";
}

/** Name of an app screen, or `null` for pages the button should not lead back to (callbacks, unknown addresses). */
export function pageName(path: string): string | null {
  if (NOT_BACK_TARGETS.has(path)) return null;
  const exact = EXACT_NAMES[path];
  if (exact) return exact;
  for (const [prefix, name] of PREFIX_NAMES) {
    if (path.startsWith(prefix) && path.length > prefix.length && !path.slice(prefix.length).includes("/")) return name;
  }
  return null;
}

/** Logical parent of a screen, or `null` for a main section (reachable from the sidebar and the bottom bar). */
export function parentOf(href: string): ParentPage | null {
  const path = pathOf(href);
  const params = new URLSearchParams(href.split("?", 2)[1]?.split("#", 1)[0] ?? "");
  if (path === "/impostazioni") return params.has("sezione") ? { href: "/impostazioni", label: "Impostazioni" } : PANORAMICA;
  if (path === "/aiuto") {
    // Help is opened from any page with `?da=<that page>`: back there if it is a known screen.
    const from = params.get("da");
    const label = from?.startsWith("/") && !from.startsWith("//") ? pageName(pathOf(from)) : null;
    return from && label ? { href: from, label } : PANORAMICA;
  }
  return PARENTS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;
}

/**
 * Records a visit. Same screen (see `screenKey`) → replaces the last entry; the screen before the last one →
 * treated as going back (pops); anything else → pushed (oldest entries dropped beyond the limit).
 */
export function recordVisit(stack: readonly string[], href: string, limit = BACK_HISTORY_LIMIT): string[] {
  const key = screenKey(href);
  const last = stack.at(-1);
  if (last === undefined) return [href];
  if (screenKey(last) === key) return [...stack.slice(0, -1), href];
  const beforeLast = stack.at(-2);
  if (beforeLast !== undefined && screenKey(beforeLast) === key) return [...stack.slice(0, -2), href];
  return [...stack, href].slice(-limit);
}

/**
 * Where «‹» leads from `currentHref`, or `null` for no button. Reads the stack as it is during render, also before
 * the visit to the current screen has been recorded (the recorder runs in an effect), so the button does not change
 * after the first paint.
 */
export function resolveBackTarget(stack: readonly string[], currentHref: string): BackTarget | null {
  const current = screenKey(currentHref);
  const at = (i: number) => stack.at(i);
  let previous: string | undefined;
  if (at(-1) !== undefined && screenKey(at(-1)!) === current) previous = at(-2);
  else if (at(-2) !== undefined && screenKey(at(-2)!) === current) previous = at(-3);
  else previous = at(-1);
  const label = previous !== undefined && screenKey(previous) !== current ? pageName(pathOf(previous)) : null;
  if (previous !== undefined && label) return { href: previous, label, source: "previous" };
  const parent = parentOf(currentHref);
  return parent ? { ...parent, source: "parent" } : null;
}

/** Parses the stored stack, ignoring anything that is not a list of in-app paths. */
export function parseStoredStack(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string" && v.startsWith("/") && !v.startsWith("//")).slice(-BACK_HISTORY_LIMIT);
  } catch {
    return [];
  }
}
