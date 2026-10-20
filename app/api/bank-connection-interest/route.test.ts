import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankConnectionInterest } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { DELETE, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const request = (method: string) => new NextRequest("http://localhost/api/bank-connection-interest", { method });

describe("POST/DELETE /api/bank-connection-interest", () => {
  let userId: string;

  beforeEach(async () => {
    userId = `test-bank-interest-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "Test Interest", email: `${userId}@example.com`, emailVerified: false, currency: "EUR", productCountry: "DE" });
    mockedGetSession.mockResolvedValue({ user: { id: userId, productCountry: "DE" } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("answers 401 without a session", async () => {
    mockedGetSession.mockResolvedValueOnce(null);
    expect((await POST(request("POST"))).status).toBe(401);
  });

  it("records the request once, with the product country, and withdraws it", async () => {
    expect((await POST(request("POST"))).status).toBe(201);
    expect((await POST(request("POST"))).status).toBe(200);
    const rows = await db.select().from(bankConnectionInterest).where(eq(bankConnectionInterest.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ country: "DE", notifiedAt: null });

    const response = await DELETE(request("DELETE"));
    expect(await response.json()).toEqual({ interested: false });
    expect(await db.select().from(bankConnectionInterest).where(eq(bankConnectionInterest.userId, userId))).toHaveLength(0);
  });
});
