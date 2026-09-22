/**
 * Gruppi di spesa delle categorie (Dovute / Volute / Te futuro / Saltuarie) e tipo "entrata": unica fonte
 * di verità per valori, ordine, etichette e token colore. Modulo puro, senza dipendenze da React o DB.
 */

export const CATEGORY_TYPES = ["dovuta", "voluta", "futuro", "saltuaria", "entrata"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const EXPENSE_GROUP_KEYS = ["dovuta", "voluta", "futuro", "saltuaria"] as const;
export type ExpenseGroup = (typeof EXPENSE_GROUP_KEYS)[number];

/** Bucket statistico delle spese su categoria fallback (o non classificabile): non è un tipo categoria. */
export const UNCATEGORIZED_GROUP_KEY = "daCategorizzare";
export type CategoryGroupKey = ExpenseGroup | typeof UNCATEGORIZED_GROUP_KEY;

export interface GroupDisplay {
  label: string;
  /** Token CSS del colore del gruppo, da usare come `fill` nei grafici. */
  colorVar: string;
  /** Classe Tailwind letterale per il pallino colore (letterale per il JIT). */
  dotClassName: string;
}

export interface ExpenseGroupInfo extends GroupDisplay {
  shortDescription: string;
}

export const EXPENSE_GROUPS: Record<ExpenseGroup, ExpenseGroupInfo> = {
  dovuta: {
    label: "Dovute",
    shortDescription: "Necessarie per vivere: senza queste avresti problemi pratici o legali.",
    colorVar: "var(--group-dovuta)",
    dotClassName: "bg-group-dovuta",
  },
  voluta: {
    label: "Volute",
    shortDescription: "Migliorano la qualità della vita, ma potresti farne a meno.",
    colorVar: "var(--group-voluta)",
    dotClassName: "bg-group-voluta",
  },
  futuro: {
    label: "Te futuro",
    shortDescription: "Risparmio e investimenti come spesa prioritaria, non come avanzo.",
    colorVar: "var(--group-futuro)",
    dotClassName: "bg-group-futuro",
  },
  saltuaria: {
    label: "Saltuarie",
    shortDescription: "Necessarie ma non mensili: tasse annuali, manutenzioni, regali.",
    colorVar: "var(--group-saltuaria)",
    dotClassName: "bg-group-saltuaria",
  },
};

export const GROUP_DISPLAY: Record<CategoryGroupKey, GroupDisplay> = {
  ...EXPENSE_GROUPS,
  daCategorizzare: {
    label: "Da categorizzare",
    colorVar: "var(--group-uncategorized)",
    dotClassName: "bg-group-uncategorized",
  },
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  dovuta: EXPENSE_GROUPS.dovuta.label,
  voluta: EXPENSE_GROUPS.voluta.label,
  futuro: EXPENSE_GROUPS.futuro.label,
  saltuaria: EXPENSE_GROUPS.saltuaria.label,
  entrata: "Entrata",
};

/** Tipo proposto di default quando l'utente crea una nuova categoria. */
export const DEFAULT_NEW_CATEGORY_TYPE: CategoryType = "voluta";

/** True se `type` è uno dei quattro gruppi di spesa (esclude "entrata" e valori sconosciuti). */
export function isExpenseGroup(type: string): type is ExpenseGroup {
  return (EXPENSE_GROUP_KEYS as readonly string[]).includes(type);
}

/**
 * Bucket statistico di una categoria: la fallback e i tipi sconosciuti vanno in "daCategorizzare",
 * i gruppi di spesa in se stessi, le entrate in `null` (non sono spese).
 */
export function categoryGroupKey(category: { type: string; isFallback: boolean }): CategoryGroupKey | null {
  if (category.isFallback) return UNCATEGORIZED_GROUP_KEY;
  if (category.type === "entrata") return null;
  return isExpenseGroup(category.type) ? category.type : UNCATEGORIZED_GROUP_KEY;
}

export interface CategorySections<T> {
  /** Sempre tutti e quattro i gruppi, nell'ordine di EXPENSE_GROUP_KEYS, anche se vuoti. */
  groups: { key: ExpenseGroup; categories: T[] }[];
  uncategorized: T[];
  income: T[];
}

/** Divide le categorie in sezioni per la pagina Categorie, preservando l'ordine di input dentro ogni sezione. */
export function groupCategoriesByType<T extends { type: string; isFallback: boolean }>(
  categories: T[]
): CategorySections<T> {
  const sections: CategorySections<T> = {
    groups: EXPENSE_GROUP_KEYS.map((key) => ({ key, categories: [] as T[] })),
    uncategorized: [],
    income: [],
  };
  for (const category of categories) {
    const key = categoryGroupKey(category);
    if (key === null) sections.income.push(category);
    else if (key === UNCATEGORIZED_GROUP_KEY) sections.uncategorized.push(category);
    else sections.groups.find((group) => group.key === key)!.categories.push(category);
  }
  return sections;
}
