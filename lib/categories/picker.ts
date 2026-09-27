/**
 * Logica pura del selettore categorie (`CategoryPicker`): sezioni "Più usate" + gruppi di spesa quando
 * non si cerca, lista unica ordinata per pertinenza quando si cerca. Nessuna dipendenza da React o DB.
 */

import { EXPENSE_GROUP_KEYS, EXPENSE_GROUPS, CATEGORY_TYPE_LABELS, type CategoryType } from "./groups";

/** Quante categorie mostrare nella sezione "Più usate". */
export const MOST_USED_LIMIT = 5;

/** Sotto questo numero di categorie la sezione "Più usate" è superflua: la lista intera si vede già a colpo d'occhio. */
export const MOST_USED_MIN_TOTAL = 8;

/** Finestra (in giorni) su cui si contano gli utilizzi di ogni categoria. */
export const CATEGORY_USAGE_WINDOW_DAYS = 365;

/** Conteggio utilizzi per id categoria (id assenti = mai usata nella finestra). */
export type CategoryUsageCounts = Record<string, number>;

/** Campi minimi di una categoria necessari al selettore. */
export interface PickerCategory {
  id: string;
  name: string;
  type: string;
  isFallback: boolean;
}

export interface CategoryPickerSection<T> {
  key: string;
  /** `null` = sezione senza intestazione (es. risultati di ricerca, fallback in coda). */
  label: string | null;
  categories: T[];
}

/** Minuscolo, senza accenti e spazi superflui: "Caffè " → "caffe". */
export function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function groupLabel(type: string): string {
  return CATEGORY_TYPE_LABELS[type as CategoryType] ?? "";
}

function byUsageThenName<T extends PickerCategory>(usage: CategoryUsageCounts) {
  return (a: T, b: T) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name);
}

/**
 * Pertinenza di una categoria per la ricerca (più basso = più pertinente), `null` se non corrisponde.
 * Ogni parola della ricerca deve comparire nel nome; in alternativa la ricerca può indicare il gruppo
 * ("volute" → tutte le Volute), con priorità più bassa di un match sul nome.
 */
function searchRank(category: PickerCategory, normalizedQuery: string): number | null {
  const name = normalizeForSearch(category.name);
  const terms = normalizedQuery.split(/\s+/);
  if (terms.every((term) => name.includes(term))) {
    if (name.startsWith(normalizedQuery)) return 0;
    const words = name.split(/[^a-z0-9]+/);
    if (terms.every((term) => words.some((word) => word.startsWith(term)))) return 1;
    return 2;
  }
  // La fallback non appartiene davvero a un gruppo: si trova solo per nome.
  if (category.isFallback) return null;
  const group = normalizeForSearch(groupLabel(category.type));
  if (group !== "" && group.startsWith(normalizedQuery)) return 3;
  return null;
}

/**
 * Sezioni da mostrare nel selettore.
 * - Con ricerca: un'unica sezione con le sole categorie corrispondenti, ordinate per pertinenza, poi utilizzo, poi nome.
 * - Senza ricerca: "Più usate" (se ci sono abbastanza categorie e almeno una è stata usata), poi una sezione per
 *   gruppo di spesa e una per le entrate (ordine alfabetico), infine la fallback senza intestazione.
 *   Le più usate compaiono anche nel loro gruppo: la sezione è una scorciatoia, non uno spostamento.
 */
export function buildCategoryPickerSections<T extends PickerCategory>(
  categories: T[],
  usage: CategoryUsageCounts,
  query: string,
  mostUsedLimit: number = MOST_USED_LIMIT
): CategoryPickerSection<T>[] {
  const normalizedQuery = normalizeForSearch(query);

  if (normalizedQuery !== "") {
    const ranked = categories
      .map((category) => ({ category, rank: searchRank(category, normalizedQuery) }))
      .filter((entry): entry is { category: T; rank: number } => entry.rank !== null)
      .sort((a, b) => a.rank - b.rank || byUsageThenName<T>(usage)(a.category, b.category))
      .map((entry) => entry.category);
    return ranked.length > 0 ? [{ key: "results", label: null, categories: ranked }] : [];
  }

  const sections: CategoryPickerSection<T>[] = [];
  const regular = categories.filter((c) => !c.isFallback);

  if (categories.length >= MOST_USED_MIN_TOTAL) {
    const mostUsed = regular
      .filter((c) => (usage[c.id] ?? 0) > 0)
      .sort(byUsageThenName<T>(usage))
      .slice(0, mostUsedLimit);
    if (mostUsed.length > 0) sections.push({ key: "most-used", label: "Più usate", categories: mostUsed });
  }

  const alphabetical = [...regular].sort((a, b) => a.name.localeCompare(b.name));
  const groupTypes: string[] = [...EXPENSE_GROUP_KEYS, "entrata"];
  for (const type of groupTypes) {
    const inGroup = alphabetical.filter((c) => c.type === type);
    if (inGroup.length === 0) continue;
    const label = type === "entrata" ? "Entrate" : EXPENSE_GROUPS[type as keyof typeof EXPENSE_GROUPS].label;
    sections.push({ key: `type-${type}`, label, categories: inGroup });
  }

  // Tipi sconosciuti (dati legacy): mai nascosti, in coda ai gruppi.
  const unknown = alphabetical.filter((c) => !groupTypes.includes(c.type));
  if (unknown.length > 0) sections.push({ key: "type-other", label: "Altre", categories: unknown });

  const fallback = categories.filter((c) => c.isFallback);
  if (fallback.length > 0) sections.push({ key: "fallback", label: null, categories: fallback });

  return sections;
}

/**
 * Categoria da preselezionare quando l'utente non ha ancora scelto (es. nuova transazione manuale):
 * la più usata, altrimenti la prima in ordine alfabetico, mai la fallback se esiste un'alternativa.
 */
export function pickDefaultCategoryId<T extends PickerCategory>(categories: T[], usage: CategoryUsageCounts): string {
  const regular = categories.filter((c) => !c.isFallback);
  const pool = regular.length > 0 ? regular : categories;
  return [...pool].sort(byUsageThenName<T>(usage))[0]?.id ?? "";
}
