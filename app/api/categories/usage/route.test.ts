import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function createUser(prefix: string) {
  const id = `${prefix}-${crypto.randomUUID()}`;
  await db.insert(authUser).values({
    id,
    name: "Test User",
    email: `${id}@example.com`,
    emailVerified: false,
    currency: "EUR",
  });
  const [account] = await db
    .insert(accounts)
    .values({ userId: id, name: "Contanti", type: "Contanti", balance: "0.00" })
    .returning();
  return { id, accountId: account.id };
}

describe("GET /api/categories/usage", () => {
  let userIds: string[] = [];

  beforeEach(() => {
    userIds = [];
  });

  afterEach(async () => {
    if (userIds.length === 0) return;
    await db.delete(transactions).where(inArray(transactions.userId, userIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/categories/usage"));
    expect(response.status).toBe(401);
  });

  it("conta le transazioni recenti per categoria, solo dell'utente autenticato", async () => {
    const user = await createUser("test-usage");
    const other = await createUser("test-usage-other");
    userIds.push(user.id, other.id);
    mockedGetSession.mockResolvedValue({ user: { id: user.id } } as never);

    const [spesa, bar, mai] = await db
      .insert(categories)
      .values([
        { userId: user.id, name: "Spesa", type: "dovuta" },
        { userId: user.id, name: "Bar", type: "voluta" },
        { userId: user.id, name: "Mai usata", type: "voluta" },
      ])
      .returning();
    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: other.id, name: "Altro utente", type: "voluta" })
      .returning();

    const tx = (userId: string, accountId: string, categoryId: string, date: string) => ({
      userId,
      accountId,
      categoryId,
      description: "x",
      amount: "-10.00",
      date,
    });
    await db.insert(transactions).values([
      tx(user.id, user.accountId, spesa.id, isoDaysAgo(1)),
      tx(user.id, user.accountId, spesa.id, isoDaysAgo(30)),
      tx(user.id, user.accountId, bar.id, isoDaysAgo(2)),
      // Fuori dalla finestra di utilizzo: non conta.
      tx(user.id, user.accountId, bar.id, isoDaysAgo(400)),
      tx(other.id, other.accountId, otherCategory.id, isoDaysAgo(1)),
    ]);

    const response = await GET(new NextRequest("http://localhost/api/categories/usage"));
    expect(response.status).toBe(200);
    const usage = await response.json();
    expect(usage).toEqual({ [spesa.id]: 2, [bar.id]: 1 });
    expect(usage[mai.id]).toBeUndefined();
    expect(usage[otherCategory.id]).toBeUndefined();
  });
});
