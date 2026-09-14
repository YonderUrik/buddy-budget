import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { resolveCategorization } from "./resolve";

async function createUser(label: string) {
  const testId = `test-resolve-${label}-${crypto.randomUUID()}`;
  const [user] = await db
    .insert(authUser)
    .values({
      id: testId,
      name: `Test Resolve ${label}`,
      email: `test-resolve-${label}-${Date.now()}@example.com`,
      emailVerified: false,
      currency: "EUR",
    })
    .returning();
  return user.id;
}

describe("resolveCategorization", () => {
  let userId: string;
  let otherUserId: string;
  let spesaCategoryId: string;
  let entrataCategoryId: string;

  beforeAll(async () => {
    userId = await createUser("user");
    otherUserId = await createUser("other");

    const [spesaCategory] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();
    spesaCategoryId = spesaCategory.id;

    const [entrataCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    entrataCategoryId = entrataCategory.id;
  });

  afterAll(async () => {
    if (userId) await db.delete(authUser).where(eq(authUser.id, userId));
    if (otherUserId) await db.delete(authUser).where(eq(authUser.id, otherUserId));
    await client.end();
  });

  it("ritorna null quando l'utente non ha regole", async () => {
    expect(
      await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 })
    ).toBeNull();
  });

  it("applica una regola merchant sulla chiave normalizzata, non sul testo grezzo", async () => {
    await db.insert(categorizationRules).values({
      userId,
      matchType: "merchant",
      pattern: "esselunga via roma",
      categoryId: spesaCategoryId,
    });

    const result = await resolveCategorization(userId, {
      description: "PAGAMENTO POS ESSELUNGA SPA VIA ROMA COD.4471",
      amount: -30,
    });
    expect(result?.categoryId).toBe(spesaCategoryId);
  });

  it("incrementa hitCount e aggiorna lastAppliedAt quando una regola vince", async () => {
    const [before] = await db
      .select()
      .from(categorizationRules)
      .where(eq(categorizationRules.pattern, "esselunga via roma"));
    const hitCountBefore = before.hitCount;

    await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 });

    const [after] = await db
      .select()
      .from(categorizationRules)
      .where(eq(categorizationRules.id, before.id));
    expect(after.hitCount).toBe(hitCountBefore + 1);
    expect(after.lastAppliedAt).not.toBeNull();
  });

  it("non applica una regola di categoria entrata a una spesa", async () => {
    await db.insert(categorizationRules).values({
      userId,
      matchType: "merchant",
      pattern: "stipendio acme",
      categoryId: entrataCategoryId,
    });

    expect(
      await resolveCategorization(userId, { description: "STIPENDIO ACME", amount: -50 })
    ).toBeNull();
  });

  it("deriva excludedAmount dallo splitPercentage della regola col segno dell'importo", async () => {
    await db.insert(categorizationRules).values({
      userId,
      matchType: "merchant",
      pattern: "affitto casa",
      categoryId: spesaCategoryId,
      splitPercentage: "0.5",
    });

    const result = await resolveCategorization(userId, { description: "AFFITTO CASA", amount: -30 });
    expect(result?.excludedAmount).toBe(-15);
  });

  it("ritorna excludedAmount 0 quando la regola non ha splitPercentage", async () => {
    const result = await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 });
    expect(result?.excludedAmount).toBe(0);
  });

  it("non vede le regole di un altro utente", async () => {
    expect(
      await resolveCategorization(otherUserId, { description: "ESSELUNGA VIA ROMA", amount: -30 })
    ).toBeNull();
  });
});
