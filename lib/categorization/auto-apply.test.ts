import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
import { transactions } from "@/lib/db/schema/transactions";
import { autoApplyCategories, totalApplied } from "./auto-apply";
import { merchantKey } from "./merchant-key";

describe("autoApplyCategories", () => {
  let userId: string;
  let accountId: string;
  let fallbackId: string;
  let spesaId: string;
  let svagoId: string;

  async function insertMovement(description: string, categoryId: string, date = "2026-10-01", amount = "-20.00") {
    const [row] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId, description, amount, date, source: "manuale" })
      .returning();
    return row;
  }

  async function reload(id: string) {
    const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
    return row;
  }

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-auto-apply-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-auto-apply-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
        categorizationAutoApply: true,
      })
      .returning();
    userId = user.id;
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Contanti", balance: "0.00" }).returning();
    accountId = account.id;
    const inserted = await db
      .insert(categories)
      .values([
        { userId, name: "Da categorizzare", type: "voluta", isFallback: true },
        { userId, name: "Spesa", type: "dovuta" },
        { userId, name: "Svago", type: "voluta" },
      ])
      .returning();
    fallbackId = inserted[0].id;
    spesaId = inserted[1].id;
    svagoId = inserted[2].id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("applica le regole e le scelte passate sicure, segnando origine, sicurezza e quando", async () => {
    await db.insert(categorizationRules).values({ userId, matchType: "merchant", pattern: merchantKey("NETFLIX.COM"), categoryId: svagoId, source: "appresa" });
    for (const date of ["2026-07-01", "2026-08-01", "2026-09-01"]) await insertMovement("ESSELUNGA VIA ROMA", spesaId, date);
    const netflix = await insertMovement("NETFLIX.COM", fallbackId);
    const esselunga = await insertMovement("ESSELUNGA VIA ROMA", fallbackId);
    const now = new Date("2026-10-12T10:00:00Z");

    const result = await autoApplyCategories(userId, { now });

    expect(result.applied).toEqual({ regola: 1, storico: 1, assistente: 0, banca: 0 });
    const rule = await reload(netflix.id);
    expect(rule.categoryId).toBe(svagoId);
    expect(rule.categorySource).toBe("regola");
    expect(rule.categoryConfidence).toBeNull();
    const history = await reload(esselunga.id);
    expect(history.categoryId).toBe(spesaId);
    expect(history.categorySource).toBe("storico");
    expect(Number(history.categoryConfidence)).toBeGreaterThanOrEqual(0.9);
    expect(history.categorizedAt?.toISOString()).toBe(now.toISOString());
    // Rilanciarla non cambia nulla.
    expect(totalApplied(await autoApplyCategories(userId))).toBe(0);
  });

  it("con l'opzione spenta applica solo le regole", async () => {
    await db.update(authUser).set({ categorizationAutoApply: false }).where(eq(authUser.id, userId));
    for (const date of ["2026-07-01", "2026-08-01", "2026-09-01"]) await insertMovement("ESSELUNGA VIA ROMA", spesaId, date);
    const esselunga = await insertMovement("ESSELUNGA VIA ROMA", fallbackId);

    const result = await autoApplyCategories(userId);

    expect(totalApplied(result)).toBe(0);
    expect((await reload(esselunga.id)).categoryId).toBe(fallbackId);
  });

  it("non applica le scelte passate con meno di 3 movimenti d'accordo", async () => {
    await insertMovement("ESSELUNGA VIA ROMA", spesaId, "2026-09-01");
    const esselunga = await insertMovement("ESSELUNGA VIA ROMA", fallbackId);

    await autoApplyCategories(userId);

    expect((await reload(esselunga.id)).categoryId).toBe(fallbackId);
  });

  it("applica una proposta sicura dell'AI solo con il consenso attivo", async () => {
    const spotify = await insertMovement("SPOTIFY AB", fallbackId);
    await db.insert(categorizationSuggestions).values({
      userId,
      merchantKey: merchantKey("SPOTIFY AB"),
      direction: "uscita",
      categoryId: svagoId,
      confidence: "0.9500",
      model: "test",
      promptVersion: 1,
    });

    expect(totalApplied(await autoApplyCategories(userId))).toBe(0);

    await db.update(authUser).set({ aiCategorizationConsentAt: new Date() }).where(eq(authUser.id, userId));
    const result = await autoApplyCategories(userId);

    expect(result.applied.assistente).toBe(1);
    const row = await reload(spotify.id);
    expect(row.categoryId).toBe(svagoId);
    expect(row.categorySource).toBe("assistente");
    expect(Number(row.categoryConfidence)).toBeCloseTo(0.95);
  });

  it("lascia da decidere una proposta dell'AI sotto il 90%", async () => {
    await db.update(authUser).set({ aiCategorizationConsentAt: new Date() }).where(eq(authUser.id, userId));
    const shop = await insertMovement("NEGOZIO XYZ", fallbackId);
    await db.insert(categorizationSuggestions).values({
      userId,
      merchantKey: merchantKey("NEGOZIO XYZ"),
      direction: "uscita",
      categoryId: svagoId,
      confidence: "0.8000",
      model: "test",
      promptVersion: 1,
    });

    await autoApplyCategories(userId);

    expect((await reload(shop.id)).categoryId).toBe(fallbackId);
  });
});
