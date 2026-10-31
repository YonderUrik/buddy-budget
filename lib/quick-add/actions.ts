/**
 * «Aggiungi»: everything the global add button offers, split by how often people add it (a movement every week, an
 * account once). Data and pure rules only (texts are Italian source keys translated by the UI); the chooser and the forms
 * it opens live in `components/domain/quick-add`.
 */

import { isCountryPathAvailable } from "@/lib/localization/config";

export const QUICK_ADD_SECTION_IDS = ["liquidita", "investimenti", "debiti", "pensione", "analitiche"] as const;
export type QuickAddSectionId = (typeof QUICK_ADD_SECTION_IDS)[number];

export const QUICK_ADD_ACTION_IDS = ["movimento", "operazione", "file", "conto", "abbonamento", "debito", "pensione", "obiettivo"] as const;
export type QuickAddActionId = (typeof QUICK_ADD_ACTION_IDS)[number];

/** Actions that open a form over the current page; the others go to the page where the thing is added. */
export const QUICK_ADD_FORM_IDS = ["movimento", "conto", "abbonamento", "operazione", "debito"] as const satisfies readonly QuickAddActionId[];
export type QuickAddFormId = (typeof QUICK_ADD_FORM_IDS)[number];

/** Pages that do the adding themselves: the one import page (bank and broker files alike), the pension data tab (a new fund or today's values) and the goal form. */
export const QUICK_ADD_PAGE_HREFS: Record<Exclude<QuickAddActionId, QuickAddFormId>, string> = {
  file: "/importazioni",
  pensione: "/pensione/dati",
  obiettivo: "/analitiche/obiettivi?nuovo=1",
};

/** Query parameter that opens «Aggiungi» from a link: a form id opens that form, any other value the chooser. */
export const QUICK_ADD_PARAM = "aggiungi";

/** Address of `path` that opens a form (or, without `form`, the chooser) once loaded, e.g. from «Primi passi». */
export function quickAddHref(path: string, form?: QuickAddFormId): string {
  return `${path}?${QUICK_ADD_PARAM}=${form ?? "1"}`;
}

/** True when the action opens a form over the current page instead of going to another page. */
export function isQuickAddForm(id: QuickAddActionId): id is QuickAddFormId {
  return (QUICK_ADD_FORM_IDS as readonly string[]).includes(id);
}

export interface QuickAddSection {
  id: QuickAddSectionId;
  title: string;
  /** Root of the section: the current page inside it decides the `here` of the product events. */
  path: string;
}

/**
 * How often people add it: `frequent` things (movements, investment operations, and the files that bring them in) come
 * first and bigger; `occasional` ones (an account, a subscription, a loan, the pension fund, a goal) are added once or a
 * few times and sit below, smaller.
 */
export type QuickAddTier = "frequent" | "occasional";

export interface QuickAddAction {
  id: QuickAddActionId;
  section: QuickAddSectionId;
  tier: QuickAddTier;
  /** Full name («Un movimento»): the answer to «Cosa vuoi aggiungere?». */
  title: string;
  /** Shorter name for a small tile («Conto»); the title when missing. */
  short?: string;
  /** One line on what it is, in plain words. */
  description: string;
  /** Page the thing lives on: the action exists only where the user's country has that page. */
  path: string;
}

export const QUICK_ADD_SECTIONS: readonly QuickAddSection[] = [
  { id: "liquidita", title: "Liquidità", path: "/liquidita" },
  { id: "investimenti", title: "Investimenti", path: "/investimenti" },
  { id: "debiti", title: "Debiti", path: "/debiti" },
  { id: "pensione", title: "Pensione", path: "/pensione" },
  { id: "analitiche", title: "Obiettivi", path: "/analitiche" },
];

/** In the order they are shown: the frequent ones (typed by hand, then any file), then the others. */
export const QUICK_ADD_ACTIONS: readonly QuickAddAction[] = [
  { id: "movimento", section: "liquidita", tier: "frequent", title: "Un movimento", description: "Una spesa o un'entrata su un conto manuale", path: "/liquidita" },
  { id: "operazione", section: "investimenti", tier: "frequent", title: "Un'operazione", description: "Un acquisto, una vendita o un dividendo", path: "/investimenti" },
  { id: "file", section: "liquidita", tier: "frequent", title: "Importa un file", description: "L'estratto conto della banca o il rendiconto del broker", path: "/importazioni" },
  { id: "conto", section: "liquidita", tier: "occasional", title: "Un conto", short: "Conto", description: "A mano, con il nome e il saldo di oggi", path: "/liquidita/conti" },
  { id: "abbonamento", section: "liquidita", tier: "occasional", title: "Un abbonamento", short: "Abbonamento", description: "Ne seguiamo gli addebiti tra i movimenti", path: "/liquidita/abbonamenti" },
  { id: "debito", section: "debiti", tier: "occasional", title: "Un mutuo o un prestito", short: "Mutuo o prestito", description: "Calcoliamo il piano rate e gli interessi", path: "/debiti" },
  { id: "pensione", section: "pensione", tier: "occasional", title: "Il fondo pensione", short: "Fondo pensione", description: "Un nuovo fondo o i valori di oggi", path: "/pensione/dati" },
  { id: "obiettivo", section: "analitiche", tier: "occasional", title: "Un obiettivo di risparmio", short: "Obiettivo", description: "Una casa, un viaggio, un cuscinetto", path: "/analitiche/obiettivi" },
];

/** Where «Aggiungi» was opened from, for the product events (`link`: an address with `?aggiungi=`). */
export const QUICK_ADD_SOURCES = ["barra", "sidebar", "link"] as const;
export type QuickAddSource = (typeof QUICK_ADD_SOURCES)[number];

/** Page area «Aggiungi» was opened on, for the product events (closed set: never a path). */
export type QuickAddArea = QuickAddSectionId | "panoramica" | "altro";

export interface QuickAddMenu {
  frequent: QuickAddAction[];
  occasional: QuickAddAction[];
}

const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Section of `pathname` among those «Aggiungi» knows (the file import page counts as Liquidità). */
function sectionOf(pathname: string): QuickAddSectionId | null {
  if (within(pathname, "/importazioni")) return "liquidita";
  return QUICK_ADD_SECTIONS.find((s) => within(pathname, s.path))?.id ?? null;
}

/** Area of the page for the product events: a section, Panoramica, or anything else. */
export function quickAddArea(pathname: string): QuickAddArea {
  return sectionOf(pathname) ?? (within(pathname, "/panoramica") ? "panoramica" : "altro");
}

/** True when the action belongs to the section of `pathname` (it tells the events whether people add where they are). */
export function isQuickAddHere(id: QuickAddActionId, pathname: string): boolean {
  return QUICK_ADD_ACTIONS.find((a) => a.id === id)?.section === sectionOf(pathname);
}

/** Section name shown next to an action. */
export function quickAddSectionTitle(id: QuickAddSectionId): string {
  return QUICK_ADD_SECTIONS.find((s) => s.id === id)?.title ?? "";
}

/**
 * What a user of `country` can add, frequent first: actions whose page the country does not have are left out (the
 * Italian pension fund outside Italy). The order never depends on the page, so the same thing is always in the same place.
 */
export function quickAddMenu(country: string): QuickAddMenu {
  const offered = QUICK_ADD_ACTIONS.filter((a) => isCountryPathAvailable(country, a.path));
  return { frequent: offered.filter((a) => a.tier === "frequent"), occasional: offered.filter((a) => a.tier === "occasional") };
}
