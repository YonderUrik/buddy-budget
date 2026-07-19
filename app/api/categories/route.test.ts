import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET /api/categories", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-categories-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-categories-${Date.now()}@example.com`,
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
    const response = await GET(new NextRequest("http://localhost/api/categories"));
    expect(response.status).toBe(401);
  });

  it("ritorna solo le categorie dell'utente autenticato", async () => {
    await db.insert(categories).values([
      { userId, name: "Affitto", type: "fissa" },
      { userId, name: "Svago", type: "variabile" },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/categories"));
    expect(response.status).toBe(200);
    const list = await response.json();
    expect(list).toHaveLength(2);
  });
});
