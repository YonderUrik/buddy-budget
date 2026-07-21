/**
 * Script una tantum: applica icona/colore/isFallback alle categorie create prima
 * di questa feature (che dopo `pnpm db:push` hanno preso i default generici
 * "package"/"slate"/false). Aggiorna per nome esatto contro DEFAULT_CATEGORIES;
 * lascia invariate le categorie che non corrispondono a nessun nome noto.
 * Esegui con: pnpm exec tsx --env-file=.env.local lib/db/backfill-category-appearance.ts
 */

import { and, eq } from "drizzle-orm";
import { client, db } from "./client";
import { categories, DEFAULT_CATEGORIES } from "./schema/categories";

async function main() {
  let updated = 0;
  for (const category of DEFAULT_CATEGORIES) {
    const result = await db
      .update(categories)
      .set({
        icon: category.icon,
        color: category.color,
        isFallback: category.isFallback ?? false,
      })
      .where(and(eq(categories.name, category.name), eq(categories.type, category.type)))
      .returning();
    updated += result.length;
  }
  console.log(`Categorie aggiornate: ${updated}`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
