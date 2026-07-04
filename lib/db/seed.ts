import { client, db } from "./client";
import { categories, DEFAULT_CATEGORIES } from "./schema/categories";
import { users } from "./schema/users";

async function seed() {
  const [user] = await db.insert(users).values({}).returning();

  const insertedCategories = await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((category) => ({
        userId: user.id,
        name: category.name,
        type: category.type,
      }))
    )
    .returning();

  console.log(`Utente dev creato: ${user.id}`);
  console.log(`Categorie create: ${insertedCategories.length}`);
  await client.end();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
