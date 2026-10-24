/**
 * «Aggiungi»: everything the global add button offers, grouped by the section that holds it. Data and pure rules only
 * (texts are Italian source keys translated by the UI); the sheet and the forms it opens live in
 * `components/domain/quick-add`.
 */

import { isCountryPathAvailable } from "@/lib/localization/config";

export const QUICK_ADD_SECTION_IDS = ["liquidita", "investimenti", "debiti", "pensione", "analitiche"] as const;
export type QuickAddSectionId = (typeof QUICK_ADD_SECTION_IDS)[number];

export const QUICK_ADD_ACTION_IDS = ["movimento", "conto", "file", "abbonamento", "operazione", "rendiconto", "debito", "pensione", "obiettivo"] as const;
export type QuickAddActionId = (typeof QUICK_ADD_ACTION_IDS)[number];

/** Actions that open a form over the current page; the others go to the page where the thing is added. */
export const QUICK_ADD_FORM_IDS = ["movimento", "conto", "abbonamento", "operazione", "rendiconto", "debito"] as const satisfies readonly QuickAddActionId[];
export type QuickAddFormId = (typeof QUICK_ADD_FORM_IDS)[number];

/** Pages that do the adding themselves: the import page, the pension data tab (a new fund or today's values) and the goal form. */
export const QUICK_ADD_PAGE_HREFS: Record<Exclude<QuickAddActionId, QuickAddFormId>, string> = {
  file: "/importazioni",
  pensione: "/pensione/dati",
  obiettivo: "/analitiche/obiettivi?nuovo=1",
};

/** True when the action opens a form over the current page instead of going to another page. */
export function isQuickAddForm(id: QuickAddActionId): id is QuickAddFormId {
  return (QUICK_ADD_FORM_IDS as readonly string[]).includes(id);
}

export interface QuickAddSection {
  id: QuickAddSectionId;
  title: string;
  /** Root of the section: the current page inside it puts its group first. */
  path: string;
}

export interface QuickAddAction {
  id: QuickAddActionId;
  section: QuickAddSectionId;
  /** Full name in the list («Un movimento»). */
  title: string;
  /** Short name on a tile («Movimento»). */
  short: string;
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

export const QUICK_ADD_ACTIONS: readonly QuickAddAction[] = [
  { id: "movimento", section: "liquidita", title: "Un movimento", short: "Movimento", description: "Una spesa o un'entrata su un conto manuale", path: "/liquidita" },
  { id: "conto", section: "liquidita", title: "Un conto", short: "Conto", description: "A mano, con il nome e il saldo di oggi", path: "/liquidita/conti" },
  { id: "file", section: "liquidita", title: "Movimenti da un file", short: "Movimenti da file", description: "Il CSV o l'Excel della tua banca", path: "/importazioni" },
  { id: "abbonamento", section: "liquidita", title: "Un abbonamento", short: "Abbonamento", description: "Ne seguiamo gli addebiti tra i movimenti", path: "/liquidita/abbonamenti" },
  { id: "operazione", section: "investimenti", title: "Un'operazione", short: "Operazione", description: "Un acquisto, una vendita o un dividendo", path: "/investimenti" },
  { id: "rendiconto", section: "investimenti", title: "Il rendiconto del broker", short: "Rendiconto broker", description: "Tutte le operazioni da un file", path: "/investimenti" },
  { id: "debito", section: "debiti", title: "Un mutuo o un prestito", short: "Mutuo o prestito", description: "Calcoliamo il piano rate e gli interessi", path: "/debiti" },
  { id: "pensione", section: "pensione", title: "Il fondo pensione", short: "Fondo pensione", description: "Un nuovo fondo o i valori di oggi", path: "/pensione/dati" },
  { id: "obiettivo", section: "analitiche", title: "Un obiettivo di risparmio", short: "Obiettivo", description: "Una casa, un viaggio, un cuscinetto", path: "/analitiche/obiettivi" },
];

export interface QuickAddGroup {
  section: QuickAddSection;
  actions: QuickAddAction[];
  /** The user is on a page of this section: its group comes first. */
  current: boolean;
}

const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Groups offered to a user of `country` standing on `pathname`: actions whose page the country does not have are left
 * out (the Italian pension fund outside Italy), empty sections disappear, and the section of the current page comes
 * first. The order is otherwise fixed, so the same thing is always in the same place.
 */
export function quickAddGroups(country: string, pathname: string): QuickAddGroup[] {
  const groups = QUICK_ADD_SECTIONS.map((section) => ({
    section,
    actions: QUICK_ADD_ACTIONS.filter((a) => a.section === section.id && isCountryPathAvailable(country, a.path)),
    current: within(pathname, section.path) || (section.id === "liquidita" && within(pathname, "/importazioni")),
  })).filter((g) => g.actions.length > 0);
  const current = groups.filter((g) => g.current);
  return [...current, ...groups.filter((g) => !g.current)];
}
