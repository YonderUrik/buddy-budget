import { isAutomaticCategorySource, type AutomaticCategorySource, type CategorySource } from "./category-source";

/** Un movimento prima della modifica e la categoria che l'utente gli sta dando. */
export interface CategoryChange {
  before: { categoryId: string; categorySource: CategorySource | null };
  categoryId: string;
}

/**
 * Quanti movimenti categorizzati da soli l'utente sta spostando in un'altra categoria, per origine. Una conferma
 * (stessa categoria) non conta: serve a misurare quanto sbaglia l'applicazione automatica.
 */
export function countAutoCorrections(changes: readonly CategoryChange[]): Map<AutomaticCategorySource, number> {
  const counts = new Map<AutomaticCategorySource, number>();
  for (const { before, categoryId } of changes) {
    const source = before.categorySource;
    if (!isAutomaticCategorySource(source) || before.categoryId === categoryId) continue;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return counts;
}
