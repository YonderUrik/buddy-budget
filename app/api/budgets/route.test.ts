import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET /api/budgets", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-budgets-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-budgets-${Date.now()}@example.com`,
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
    const response = await GET(new NextRequest("http://localhost/api/budgets"));
    expect(response.status).toBe(401);
  });

  it("ritorna i budget dell'utente", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Affitto", type: "dovuta" })
      .returning();
    await db.insert(budgets).values({ userId, categoryId: category.id, monthlyAmount: "700.00" });

    const response = await GET(new NextRequest("http://localhost/api/budgets"));
    expect(response.status).toBe(200);
    const list = await response.json();
    expect(list).toHaveLength(1);
    expect(list[0].monthlyAmount).toBe("700.00");
  });
});
