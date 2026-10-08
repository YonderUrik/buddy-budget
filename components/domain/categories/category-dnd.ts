/** Stato e handler del drag & drop tra gruppi, condivisi dalle due viste della board (le colonne della board). */

import type { Category } from "@/lib/db/schema/categories";
import type { CategoryType } from "@/lib/categories/groups";

export interface CategoryDnd {
  dragged: Category | null;
  /** Tipo della colonna/sezione sopra cui si trova il cursore durante il trascinamento. */
  overType: CategoryType | null;
  /** Categoria il cui spostamento è in corso di salvataggio. */
  movingId: string | null;
  onOpen: (category: Category) => void;
  onDragStart: (category: Category) => void;
  onDragEnd: () => void;
  onDragEnter: (type: CategoryType | undefined) => void;
  onDrop: (type: CategoryType) => void;
}

/** True se la sezione `type` va evidenziata come destinazione valida del trascinamento in corso. */
export function isDropTarget(dnd: CategoryDnd, type: CategoryType | undefined): boolean {
  return type !== undefined && dnd.dragged !== null && dnd.dragged.type !== type && dnd.overType === type;
}
