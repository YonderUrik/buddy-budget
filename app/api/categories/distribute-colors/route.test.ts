import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("POST /api/categories/distribute-colors", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-distribute-colors-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-distribute-colors-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await POST(new NextRequest("http://localhost/api/categories/distribute-colors", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("ritorna lista vuota se non ci sono categorie non-fallback", async () => {
    const response = await POST(new NextRequest("http://localhost/api/categories/distribute-colors", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("assegna colori distinti alle categorie non-fallback e non tocca la fallback", async () => {
    await db.insert(categories).values([
      { userId, name: "Affitto", type: "fissa", color: "blue" },
      { userId, name: "Svago", type: "variabile", color: "blue" },
      { userId, name: "Da categorizzare", type: "variabile", color: "red", isFallback: true },
    ]);

    const response = await POST(new NextRequest("http://localhost/api/categories/distribute-colors", { method: "POST" }));
    expect(response.status).toBe(200);
    const updated: { name: string; color: string; isFallback: boolean }[] = await response.json();

    expect(updated).toHaveLength(2);
    const colors = updated.map((c) => c.color);
    expect(new Set(colors).size).toBe(2);

    const [stillFallback] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
    expect(stillFallback?.color).toBe("red");
  });
});
