import { DEFAULT_CATEGORIES, type NewCategory } from "@/lib/db/schema/categories";

/** Righe delle categorie di default per un utente: usate alla creazione dell'utente e dal reset dei dati. */
export function defaultCategoryRows(userId: string): NewCategory[] {
  return DEFAULT_CATEGORIES.map((category) => ({
    userId,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
    isFallback: category.isFallback ?? false,
  }));
}
