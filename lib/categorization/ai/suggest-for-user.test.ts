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
it("sends personal names in batch categorization", async () => {
  await db.update(transactions).set({ description: "Mario Rossi" }).where(eq(transactions.userId, userId));
  const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ answers: { m0: { type: "choice", choice: "Svago", confidence: 0.8 } } }));
  const onProgress = vi.fn();
  expect(await suggestCategoriesForUser(userId, { fetchImpl, onProgress })).toEqual({ outcome: "done", stored: 1, blocked: 0 });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchImpl.mock.calls[0][1]!.body as string).state.merchants[0].name).toBe("Mario Rossi");
  expect(onProgress).toHaveBeenLastCalledWith({ processed: 1, total: 1, stored: 1, blocked: 0 });
});
it("finishes without a provider request when nothing remains", async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  const fetchImpl = vi.fn();
  expect(await suggestCategoriesForUser(userId, { fetchImpl })).toEqual({ outcome: "nothing_to_do", stored: 0, blocked: 0 });
  expect(fetchImpl).not.toHaveBeenCalled();
});
it("sends transfers and can save a transfer suggestion in a batch", async () => {
  await db.update(transactions).set({ description: "Bonifico a favore di Mario Rossi" }).where(eq(transactions.userId, userId));
  const [transfer] = await db.insert(categories).values({ userId, name: "Giroconti", type: "trasferimento" }).returning();
  const fetchImpl = vi.fn(async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    expect(body.questions.m0.criteria).toHaveProperty("Giroconti");
    return Response.json({ answers: { m0: { type: "choice", choice: "Giroconti", confidence: 0.9 } } });
  }) as unknown as typeof fetch;
  expect(await suggestCategoriesForUser(userId, { fetchImpl })).toMatchObject({ outcome: "done", stored: 1 });
  const [saved] = await db.select().from(categorizationSuggestions).where(eq(categorizationSuggestions.userId, userId));
  expect(saved.categoryId).toBe(transfer.id);
});
it("keeps a partial provider failure distinguishable from success", async () => {
  let requests = 0;
  const onProgress = vi.fn();
  const fetchImpl = vi.fn(async (_url, options) => {
    if (++requests > 1) return new Response(null, { status: 503 });
    const body = JSON.parse(options!.body as string);
    return Response.json({ answers: Object.fromEntries(Object.keys(body.questions).map((key) => [key, { type: "choice", choice: "Svago", confidence: 0.8 }])) });
  }) as unknown as typeof fetch;
  expect(await suggestCategoriesForUser(userId, { fetchImpl, onProgress })).toMatchObject({ outcome: "failed", stored: 5 });
  expect(onProgress).toHaveBeenLastCalledWith({ processed: 5, total: 12, stored: 5, blocked: 0 });
});

it("includes all transaction types in the same batch workflow", async () => {
  const [original] = await db.select().from(transactions).where(eq(transactions.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.insert(categories).values([{ userId, name: "Stipendio", type: "entrata" }, { userId, name: "Giroconti", type: "trasferimento" }]);
  const descriptions = ["Mario Rossi", "PAYPAL *GIULIA BIANCHI", "Bonifico a favore di Luca Verdi", "Prelievo contanti", "F24", "Stipendio Acme"];
  await db.insert(transactions).values(descriptions.map((description, i) => ({ userId, accountId: original.accountId, categoryId: original.categoryId, description, amount: i === 5 ? "1000" : "-10", date: "2026-10-22" })));
  const sent: { name: string; isIncome: boolean }[] = [];
  const fetchImpl = vi.fn(async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    sent.push(...body.state.merchants);
    return Response.json({ answers: Object.fromEntries(body.state.merchants.map((merchant: { isIncome: boolean }, i: number) => [`m${i}`, { type: "choice", choice: merchant.isIncome ? "Stipendio" : "Svago", confidence: 0.8 }])) });
  }) as unknown as typeof fetch;
  expect(await suggestCategoriesForUser(userId, { fetchImpl })).toMatchObject({ outcome: "done", stored: 6, blocked: 0 });
  expect(sent).toHaveLength(6);
  expect(sent.some((merchant) => merchant.name === "Mario Rossi")).toBe(true);
  expect(sent.some((merchant) => merchant.name === "Giulia Bianchi")).toBe(true);
  expect(sent.filter((merchant) => merchant.isIncome)).toHaveLength(1);
});
