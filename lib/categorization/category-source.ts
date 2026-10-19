/**
 * Where a transaction's category comes from: a user rule, a confident proposal from the user's past choices
 * (`storico`) or from the AI assistant, the category the bank wrote in an imported file (`banca`), all applied without
 * the user, or a choice of the user. No database dependency: client components use it too.
 */
export const CATEGORY_SOURCES = ["regola", "storico", "assistente", "utente", "banca"] as const;
export type CategorySource = (typeof CATEGORY_SOURCES)[number];
/** The origins where the category was applied without a choice of the user. */
export const AUTOMATIC_CATEGORY_SOURCES = ["regola", "storico", "assistente", "banca"] as const satisfies readonly CategorySource[];
export type AutomaticCategorySource = (typeof AUTOMATIC_CATEGORY_SOURCES)[number];

/** The given origin is one of the automatic ones (rule, past choices, AI, bank). */
export function isAutomaticCategorySource(source: string | null | undefined): source is AutomaticCategorySource {
  return (AUTOMATIC_CATEGORY_SOURCES as readonly string[]).includes(source ?? "");
}
