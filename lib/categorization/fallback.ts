import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";

export const FALLBACK_CATEGORY_NAME = "Da categorizzare";

/**
 * Id della categoria di fallback dell'utente, risolta per flag `isFallback` (non per nome: il nome
 * è solo il default alla creazione). Creata al volo se non esiste ancora.
 */
export async function getFallbackCategoryId(userId: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(categories)
    .values({
      userId,
      name: FALLBACK_CATEGORY_NAME,
      type: "voluta", // valore arbitrario: la fallback non viene mai classificata per type
      color: "red",
      icon: "help-circle",
      isFallback: true,
    })
    .returning();
  return created.id;
}
