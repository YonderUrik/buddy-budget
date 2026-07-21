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
import { GET, POST } from "./route";

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

  describe("POST /api/categories", () => {
    let postUserId: string;

    beforeEach(async () => {
      const testId = `test-categories-post-${crypto.randomUUID()}`;
      const [user] = await db
        .insert(authUser)
        .values({
          id: testId,
          name: "Test User",
          email: `test-categories-post-${Date.now()}@example.com`,
          emailVerified: false,
          currency: "EUR",
        })
        .returning();
      postUserId = user.id;
      mockedGetSession.mockResolvedValue({ user: { id: postUserId } } as never);
    });

    afterEach(async () => {
      await db.delete(authUser).where(eq(authUser.id, postUserId));
    });

    it("crea una categoria con icona/colore di default se omessi", async () => {
      const response = await POST(
        new NextRequest("http://localhost/api/categories", {
          method: "POST",
          body: JSON.stringify({ name: "Palestra", type: "variabile" }),
        })
      );
      expect(response.status).toBe(201);
      const created = await response.json();
      expect(created.name).toBe("Palestra");
      expect(created.color).toBe("slate");
      expect(created.icon).toBe("package");
    });

    it("crea una categoria con icona/colore espliciti", async () => {
      const response = await POST(
        new NextRequest("http://localhost/api/categories", {
          method: "POST",
          body: JSON.stringify({ name: "Palestra", type: "variabile", icon: "dumbbell", color: "teal" }),
        })
      );
      expect(response.status).toBe(201);
      const created = await response.json();
      expect(created.icon).toBe("dumbbell");
      expect(created.color).toBe("teal");
    });

    it("risponde 409 su un nome già usato dallo stesso utente", async () => {
      await db.insert(categories).values({ userId: postUserId, name: "Palestra", type: "variabile" });

      const response = await POST(
        new NextRequest("http://localhost/api/categories", {
          method: "POST",
          body: JSON.stringify({ name: "Palestra", type: "variabile" }),
        })
      );
      expect(response.status).toBe(409);
    });

    it("risponde 400 su nome vuoto", async () => {
      const response = await POST(
        new NextRequest("http://localhost/api/categories", {
          method: "POST",
          body: JSON.stringify({ name: "  ", type: "variabile" }),
        })
      );
      expect(response.status).toBe(400);
    });
  });
});
