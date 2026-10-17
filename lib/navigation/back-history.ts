/**
 * In-app navigation history behind the «‹ Back» link: a short stack of visited addresses (path + query), kept in
 * sessionStorage so it survives a reload but never leaves the tab. The link goes to the page the user actually came
 * from when it is a known app page, and to the logical parent page otherwise (first visit, link from an email or
 * from outside the app). It never calls `history.back()`, which could leave the app.
 */

/** Visible names of the app pages the link can lead back to (Italian, translated by the link). */
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

/** Detail pages, matched by prefix (the id after it is not shown). */
const PREFIX_NAMES: readonly (readonly [prefix: string, name: string])[] = [
  ["/investimenti/titoli/", "Titolo"],
  ["/analitiche/obiettivi/", "Obiettivo"],
];

/** Maximum remembered entries: enough for any real back chain, small enough for sessionStorage. */
export const BACK_HISTORY_LIMIT = 20;

/** sessionStorage key of the stack. */
export const BACK_HISTORY_STORAGE_KEY = "bb.back-history";

export interface BackTarget {
  href: string;
  /** Name of the page, as shown after «‹». */
  label: string;
  /** `previous`: the page the user came from; `parent`: the logical parent page (fallback). */
  source: "previous" | "parent";
}

/** Path of an address, without query and hash. */
export function pathOf(href: string): string {
  return href.split(/[?#]/, 1)[0] || "/";
}

/** Name of an app page, or `null` for pages the link should not lead back to (callbacks, unknown addresses). */
export function pageName(path: string): string | null {
  const exact = EXACT_NAMES[path];
  if (exact) return exact;
  for (const [prefix, name] of PREFIX_NAMES) {
    if (path.startsWith(prefix) && path.length > prefix.length && !path.slice(prefix.length).includes("/")) return name;
  }
  return null;
}

/**
 * Records a visit. Same page with a different query → replaces the last entry; the page before the last one →
 * treated as going back (pops); anything else → pushed (oldest entries dropped beyond the limit).
 */
export function recordVisit(stack: readonly string[], href: string, limit = BACK_HISTORY_LIMIT): string[] {
  const path = pathOf(href);
  const last = stack.at(-1);
  if (last === undefined) return [href];
  if (pathOf(last) === path) return [...stack.slice(0, -1), href];
  const beforeLast = stack.at(-2);
  if (beforeLast !== undefined && pathOf(beforeLast) === path) return [...stack.slice(0, -2), href];
  return [...stack, href].slice(-limit);
}

/**
 * Where «‹» leads from `currentPath`. Reads the stack as it is during render, also before the visit to the current
 * page has been recorded (the recorder runs in an effect), so the label does not change after the first paint.
 */
export function resolveBackTarget(stack: readonly string[], currentPath: string, parent: { href: string; label: string }): BackTarget {
  const fallback: BackTarget = { ...parent, source: "parent" };
  const at = (i: number) => stack.at(i);
  let previous: string | undefined;
  if (at(-1) !== undefined && pathOf(at(-1)!) === currentPath) previous = at(-2);
  else if (at(-2) !== undefined && pathOf(at(-2)!) === currentPath) previous = at(-3);
  else previous = at(-1);
  if (previous === undefined) return fallback;
  const path = pathOf(previous);
  if (path === currentPath) return fallback;
  const label = pageName(path);
  return label ? { href: previous, label, source: "previous" } : fallback;
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
