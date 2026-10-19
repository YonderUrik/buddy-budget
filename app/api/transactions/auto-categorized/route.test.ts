import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("«Messe dall'app»: GET /api/transactions/auto-categorized", () => {
  let userId: string;
  let accountId: string;
  let svagoId: string;

  async function insertAuto(description: string, categorizedAt: Date, source: "regola" | "assistente" | "utente" = "assistente") {
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: svagoId,
      description,
      amount: "-9.99",
      date: "2026-10-01",
      source: "manuale",
      categorySource: source,
      categoryConfidence: source === "assistente" ? "0.9600" : null,
      categorizedAt,
    });
  }

  async function list() {
    return (await GET(new NextRequest("http://localhost/api/transactions/auto-categorized"))).json();
  }

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-auto-categorized-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-auto-categorized-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Contanti", balance: "0.00" }).returning();
    accountId = account.id;
    const [svago] = await db.insert(categories).values({ userId, name: "Svago", type: "voluta" }).returning();
    svagoId = svago.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await GET(new NextRequest("http://localhost/api/transactions/auto-categorized"))).status).toBe(401);
  });

  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

  it("shows the automatic categories of the last 30 days grouped by merchant, never the user's own choices", async () => {
    await insertAuto("NETFLIX.COM", daysAgo(2));
    await insertAuto("NETFLIX.COM", daysAgo(1));
    await insertAuto("SPOTIFY AB", daysAgo(31));
    await insertAuto("BAR DA MARIO", daysAgo(1), "utente");

    const body = await list();

    expect(body.total).toBe(2);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].transactionIds).toHaveLength(2);
    expect(body.groups[0].source).toBe("assistente");
    expect(body.groups[0].confidence).toBeCloseTo(0.96);
  });

  it("keeps a category in the history after it was listed: nothing waits for a confirmation", async () => {
    await insertAuto("NETFLIX.COM", daysAgo(3), "regola");
    expect((await list()).total).toBe(1);
    expect((await list()).total).toBe(1);
  });
});
