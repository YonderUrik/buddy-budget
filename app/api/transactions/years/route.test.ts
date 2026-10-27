import { afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { auth } from "@/lib/auth";
import { db, client } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { GET } from "./route";

let userId: string;
beforeEach(async () => {
  userId = `test-years-${crypto.randomUUID()}`;
  await db.insert(authUser).values({ id: userId, name: "Synthetic", email: `${userId}@example.com` });
  const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente" }).returning();
  const [category] = await db.insert(categories).values({ userId, name: "Altro", type: "voluta", color: "red", icon: "help-circle", isFallback: true }).returning();
  await db.insert(transactions).values(["2022-04-12", "2024-11-03", "2026-10-01", "2026-02-01"].map((date) => ({ userId, accountId: account.id, categoryId: category.id, date, amount: "-1.00", description: "x", source: "manuale" as const })));
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: userId } } as never);
});
afterEach(async () => { await db.delete(authUser).where(eq(authUser.id, userId)); });
afterAll(async () => { await client.end(); });

describe("GET /api/transactions/years", () => {
  it("lists the years with movements, newest first, only for the signed-in user", async () => {
    const response = await GET(new NextRequest("http://localhost/api/transactions/years"));
    expect(await response.json()).toEqual({ years: [2026, 2024, 2022] });
  });
  it("requires a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never);
    expect((await GET(new NextRequest("http://localhost/api/transactions/years"))).status).toBe(401);
  });
});
