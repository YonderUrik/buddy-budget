import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { suggestCategoryForTransaction } from "./suggest-one";

let userId: string;
let accountId: string;
let fallbackId: string;
let leisureId: string;
let groceriesId: string;

const answer = (choice: string, confidence = 0.82) =>
  vi.fn(async () => Response.json({ answers: { m0: { type: "choice", choice, confidence } } })) as unknown as typeof fetch;

async function addTransaction(description: string, categoryId: string, amount = "-10") {
  const [row] = await db.insert(transactions).values({ userId, accountId, categoryId, description, amount, date: "2026-10-11", source: "manuale" }).returning();
  return row.id;
}

beforeEach(async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
  userId = `test-ai-single-${crypto.randomUUID()}`;
  await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, aiCategorizationConsentAt: new Date() });
  const [account] = await db.insert(accounts).values({ userId, name: "Test", type: "Contanti", balance: "0" }).returning();
  accountId = account.id;
  const rows = await db.insert(categories).values([
    { userId, name: "Da categorizzare", type: "voluta" as const, isFallback: true },
    { userId, name: "Svago", type: "voluta" as const },
    { userId, name: "Spesa", type: "dovuta" as const },
  ]).returning();
  [fallbackId, leisureId, groceriesId] = rows.map((row) => row.id);
});
afterEach(async () => {
  await db.delete(authUser).where(eq(authUser.id, userId));
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await client.end();
});

describe("suggestCategoryForTransaction", () => {
  it("returns the model's category and leaves the same merchant out of the examples", async () => {
    const id = await addTransaction("Libreria Feltrinelli", fallbackId);
    await addTransaction("Libreria Feltrinelli", groceriesId);
    await addTransaction("Cinema Odeon", leisureId);
    let sent: { state: { merchants: { name: string }[]; examples: { name: string }[] } } | null = null;
    const fetchImpl = vi.fn(async (_url, options) => {
      sent = JSON.parse(options!.body as string);
      return Response.json({ answers: { m0: { type: "choice", choice: "Svago", confidence: 0.82 } } });
    }) as unknown as typeof fetch;

    expect(await suggestCategoryForTransaction(userId, id, { fetchImpl })).toEqual({ status: "ok", categoryId: leisureId, confidence: 0.82 });
    expect(sent!.state.merchants).toHaveLength(1);
    expect(sent!.state.examples.map((example) => example.name).join(" ")).not.toMatch(/feltrinelli/i);
    expect(await db.select({ categoryId: transactions.categoryId }).from(transactions).where(eq(transactions.id, id))).toEqual([{ categoryId: fallbackId }]);
  });

  it("asks nothing without consent, without a key, for transfers or over the limit", async () => {
    const id = await addTransaction("Negozio Rossi", fallbackId);
    const fetchImpl = answer("Svago");
    expect(await suggestCategoryForTransaction(userId, id, { fetchImpl, consumeQuota: async () => false })).toEqual({ status: "limited" });

    const transfer = await addTransaction("Bonifico a favore di Mario Rossi", fallbackId);
    expect(await suggestCategoryForTransaction(userId, transfer, { fetchImpl })).toMatchObject({ status: "blocked" });

    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(await suggestCategoryForTransaction(userId, id, { fetchImpl })).toEqual({ status: "no_key" });

    await db.update(authUser).set({ aiCategorizationConsentAt: null }).where(eq(authUser.id, userId));
    expect(await suggestCategoryForTransaction(userId, id, { fetchImpl })).toEqual({ status: "disabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails softly on a model error and ignores someone else's transaction", async () => {
    const id = await addTransaction("Negozio Rossi", fallbackId);
    const broken = vi.fn(async () => new Response(null, { status: 502 })) as unknown as typeof fetch;
    expect(await suggestCategoryForTransaction(userId, id, { fetchImpl: broken })).toEqual({ status: "failed" });
    expect(await suggestCategoryForTransaction(`${userId}-other`, id, { fetchImpl: answer("Svago") })).toBeNull();
  });
});
