import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { addDays, toDateKey } from "@/lib/calc/net-worth";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(query: string) {
  return new NextRequest(`http://localhost/api/net-worth/snapshots${query}`);
}

describe("GET /api/net-worth/snapshots", () => {
  let userId: string;
  let otherUserId: string;
  const today = new Date();
  const range = `?from=${toDateKey(addDays(today, -30))}&to=${toDateKey(today)}`;

  async function createUser(prefix: string) {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `${prefix}-${crypto.randomUUID()}`,
        name: "Test Net Worth API",
        email: `${prefix}-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    return user.id;
  }

  beforeEach(async () => {
    userId = await createUser("test-net-worth-api");
    otherUserId = await createUser("test-net-worth-api-other");
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(request(range));
    expect(response.status).toBe(401);
  });

  it("risponde 400 se from/to mancano o non sono date valide", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("?from=13-09-2026&to=2026-09-13"))).status).toBe(400);
  });

  it("ricostruisce lo storico alla prima chiamata e non lo riscrive alle successive", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "1000.00", source: "auto" })
      .returning();
    const [category] = await db.insert(categories).values({ userId, name: "Varie", type: "voluta" }).returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Spesa",
      amount: "-100.00",
      date: toDateKey(addDays(today, -2)),
      source: "auto",
    });

    const first = await (await GET(request(range))).json();
    const second = await (await GET(request(range))).json();

    expect(first).toHaveLength(2);
    expect(first.every((row: { source: string }) => row.source === "derivato")).toBe(true);
    expect(second).toHaveLength(2);
    const stored = await db.select().from(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId));
    expect(stored).toHaveLength(2);
  });

  it("restituisce solo le righe dell'utente autenticato", async () => {
    await db.insert(netWorthSnapshots).values({
      userId: otherUserId,
      date: toDateKey(addDays(today, -1)),
      assetClass: "liquidita",
      amount: "999.00",
      source: "snapshot",
    });

    const response = await GET(request(range));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
