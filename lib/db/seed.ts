import { eq } from "drizzle-orm";
import { client, db } from "./client";
import { authUser } from "./schema/auth";
import { categories, DEFAULT_CATEGORIES } from "./schema/categories";

const DEV_USER_ID = "dev-seed-user";

async function seed() {
  await db.delete(categories).where(eq(categories.userId, DEV_USER_ID));
  await db.delete(authUser).where(eq(authUser.id, DEV_USER_ID));

  const [user] = await db
    .insert(authUser)
    .values({
      id: DEV_USER_ID,
      name: "Dev User",
      email: "dev@buddybudget.local",
      emailVerified: true,
      currency: "EUR",
      onboardingCompleted: true,
    })
    .returning();

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
