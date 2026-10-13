import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, DEFAULT_CATEGORIES, OPTIONAL_DEFAULT_CATEGORIES } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import type { LocaleProfile } from "./config";
import { localizedCategoryProposal } from "./categories";
import { translate } from "./messages";
/** Called only during onboarding. Existing financial activity and user-written descriptions are never rewritten. */
export async function localizeStarterCategories(userId: string, profile: LocaleProfile) {
  if (profile.language === "it" && profile.productCountry === "IT") return;
  await db.transaction(async tx => {
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.userId, userId));
    if (count > 0) return;
    const existing = await tx.select().from(categories).where(eq(categories.userId, userId));
    const proposals = localizedCategoryProposal(profile);
    for (const original of [...DEFAULT_CATEGORIES, ...OPTIONAL_DEFAULT_CATEGORIES]) {
      const translatedName = translate(profile.language, original.name);
      const row = existing.find(c => (c.name === original.name || c.name === translatedName) && c.isFallback === Boolean(original.isFallback) && c.description === (original.description ?? null));
      if (!row) continue;
      const name = existing.some(c => c.id !== row.id && c.name === translatedName) ? row.name : translatedName;
      const description = proposals.find(c => c.key === original.key)?.description ?? translate(profile.language, original.description ?? null);
      await tx.update(categories).set({ name, description }).where(and(eq(categories.id, row.id), eq(categories.userId, userId)));
    }
  });
}
