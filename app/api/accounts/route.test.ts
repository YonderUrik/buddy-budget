import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET/POST /api/accounts", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-accounts-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-accounts-${Date.now()}@example.com`,
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
    const response = await GET(new NextRequest("http://localhost/api/accounts"));
    expect(response.status).toBe(401);
  });

  it("crea un conto manuale e lo restituisce nella lista", async () => {
    const postResponse = await POST(
      new NextRequest("http://localhost/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name: "Conto corrente", type: "Conto corrente", balance: 1000 }),
      })
    );
    expect(postResponse.status).toBe(201);
    const created = await postResponse.json();
    expect(created.source).toBe("manuale");
    expect(created.balance).toBe("1000.00");

    const getResponse = await GET(new NextRequest("http://localhost/api/accounts"));
    expect(getResponse.status).toBe(200);
    const list = await getResponse.json();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it("risponde 400 su nome vuoto", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name: "", type: "Conto corrente", balance: 100 }),
      })
    );
    expect(response.status).toBe(400);
  });
});
