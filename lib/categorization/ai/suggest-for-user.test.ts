import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
import { suggestCategoriesForUser } from "./suggest-for-user";
let userId: string;
beforeEach(async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
  userId = `test-ai-batch-${crypto.randomUUID()}`;
  await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, aiCategorizationConsentAt: new Date(), aiCategorizationInstructions: "Libri in Svago" });
  const [account] = await db.insert(accounts).values({ userId, name: "Test", type: "Contanti", balance: "0" }).returning();
  const [fallback] = await db.insert(categories).values([
    { userId, name: "Da categorizzare", type: "voluta" as const, isFallback: true },
    { userId, name: "Svago", type: "voluta" as const },
  ]).returning();
  await db.insert(transactions).values(Array.from({ length: 12 }, (_, i) => ({ userId, accountId: account.id, categoryId: fallback.id, description: `Negozio${String.fromCharCode(97+i)}`, amount: "-10", date: "2026-10-11", source: "manuale" as const })));
});
afterEach(async () => { await db.delete(authUser).where(eq(authUser.id, userId)); vi.unstubAllEnvs(); });
afterAll(async () => { await client.end(); });
it("distribuisce dodici esercenti in richieste da cinque e trasmette le istruzioni", async () => {
  const sizes: number[] = [];
  const fetchImpl = vi.fn(async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    sizes.push(body.state.merchants.length);
    expect(body.state.instructions).toBe("Libri in Svago");
    return Response.json({ answers: Object.fromEntries(Object.keys(body.questions).map((key) => [key, { type: "choice", choice: "Svago", confidence: 0.9 }])) });
  }) as unknown as typeof fetch;
  expect(await suggestCategoriesForUser(userId, { fetchImpl })).toMatchObject({ stored: 12, outcome: "done" });
  expect(sizes).toEqual([5, 5, 2]);
});
it("non salva una risposta in volo se le istruzioni sono cambiate", async () => {
  const fetchImpl = vi.fn(async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    await db.update(authUser).set({ aiCategorizationInstructions: "Preferenze aggiornate" }).where(eq(authUser.id, userId));
    return Response.json({ answers: Object.fromEntries(Object.keys(body.questions).map((key) => [key, { type: "choice", choice: "Svago", confidence: 0.9 }])) });
  }) as unknown as typeof fetch;
  expect(await suggestCategoriesForUser(userId, { fetchImpl })).toMatchObject({ stored: 0 });
  expect(await db.select().from(categorizationSuggestions).where(eq(categorizationSuggestions.userId, userId))).toHaveLength(0);
});
