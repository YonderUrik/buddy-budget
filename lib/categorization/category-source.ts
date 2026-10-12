/**
 * Da dove viene la categoria di un movimento: una regola dell'utente, una proposta sicura ricavata dalle sue scelte
 * passate (`storico`) o dall'assistente AI, applicata da sola, oppure una scelta dell'utente. File senza dipendenze dal
 * database: lo usano anche i componenti client.
 */
export const CATEGORY_SOURCES = ["regola", "storico", "assistente", "utente"] as const;
export type CategorySource = (typeof CATEGORY_SOURCES)[number];
/** Le origini in cui la categoria è stata applicata senza una scelta dell'utente. */
export const AUTOMATIC_CATEGORY_SOURCES = ["regola", "storico", "assistente"] as const satisfies readonly CategorySource[];
export type AutomaticCategorySource = (typeof AUTOMATIC_CATEGORY_SOURCES)[number];

/** L'origine indicata è una di quelle automatiche (regola, scelte passate, AI). */
export function isAutomaticCategorySource(source: string | null | undefined): source is AutomaticCategorySource {
  return (AUTOMATIC_CATEGORY_SOURCES as readonly string[]).includes(source ?? "");
}
