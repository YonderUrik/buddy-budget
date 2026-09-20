import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { PATCH, DELETE } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PATCH/DELETE /api/categorization-rules/[id]", () => {
  let userId: string;
  let otherUserId: string;
  let categoryId: string;

  beforeEach(async () => {
    const testId = `test-rule-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-rule-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-rule-id-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-rule-id-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();
    categoryId = category.id;

    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("rifiuta con 400 lo spostamento di una regola sulla categoria di fallback", async () => {
    const [fallbackCategory] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    const [rule] = await db
      .insert(categorizationRules)
      .values({ userId, matchType: "merchant", pattern: "esselunga", categoryId })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categorization-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: fallbackCategory.id }),
      }),
      { params: Promise.resolve({ id: rule.id }) }
    );

    expect(response.status).toBe(400);
  });

  it("aggiorna il tipo di match di una regola propria", async () => {
    const [rule] = await db
      .insert(categorizationRules)
      .values({ userId, matchType: "merchant", pattern: "esselunga", categoryId })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categorization-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ matchType: "contains" }),
      }),
      { params: Promise.resolve({ id: rule.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.matchType).toBe("contains");
  });

  it("risponde 404 sulla regola di un altro utente (PATCH e DELETE)", async () => {
    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "variabile" })
      .returning();
    const [otherRule] = await db
      .insert(categorizationRules)
      .values({ userId: otherUserId, matchType: "merchant", pattern: "conad", categoryId: otherCategory.id })
      .returning();

    const patchResponse = await PATCH(
      new NextRequest(`http://localhost/api/categorization-rules/${otherRule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ matchType: "contains" }),
      }),
      { params: Promise.resolve({ id: otherRule.id }) }
    );
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await DELETE(
      new NextRequest(`http://localhost/api/categorization-rules/${otherRule.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: otherRule.id }) }
    );
    expect(deleteResponse.status).toBe(404);
  });

  it("elimina una regola propria", async () => {
    const [rule] = await db
      .insert(categorizationRules)
      .values({ userId, matchType: "merchant", pattern: "esselunga", categoryId })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/categorization-rules/${rule.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: rule.id }) }
    );

    expect(response.status).toBe(204);
    const remaining = await db.select().from(categorizationRules).where(eq(categorizationRules.id, rule.id));
    expect(remaining).toHaveLength(0);
  });
});
