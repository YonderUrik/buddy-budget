import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function post(body: unknown) {
  return POST(new NextRequest("http://localhost/api/budgets/accept-proposals", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/budgets/accept-proposals", () => {
  let userId: string;
  let otherUserId: string;
  const ids: Record<string, string> = {};

  beforeEach(async () => {
    userId = `test-accept-${crypto.randomUUID()}`;
    otherUserId = `test-accept-other-${crypto.randomUUID()}`;
    await db.insert(authUser).values([
      { id: userId, name: "U", email: `${userId}@example.com`, emailVerified: false, currency: "EUR" },
      { id: otherUserId, name: "O", email: `${otherUserId}@example.com`, emailVerified: false, currency: "EUR" },
    ]);
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    const rows = await db
      .insert(categories)
      .values([
        { userId, name: "Spesa", type: "dovuta" },
        { userId, name: "Regali", type: "saltuaria" },
        { userId, name: "Stipendio", type: "entrata" },
        { userId: otherUserId, name: "Altrui", type: "voluta" },
      ])
      .returning();
    for (const row of rows) ids[row.name] = row.id;
  });

  afterEach(async () => {
    await db.delete(budgets).where(eq(budgets.userId, userId));
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("creates the kept budgets and leaves an existing one alone", async () => {
    await db.insert(budgets).values({ userId, categoryId: ids.Spesa, monthlyAmount: "300.00" });
    const response = await post({ items: [{ categoryId: ids.Spesa, amount: 420, rollover: false }, { categoryId: ids.Regali, amount: 45, rollover: true }] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 1 });
    const rows = await db.select().from(budgets).where(eq(budgets.userId, userId));
    expect(rows.find((r) => r.categoryId === ids.Spesa)?.monthlyAmount).toBe("300.00");
    expect(rows.find((r) => r.categoryId === ids.Regali)).toMatchObject({ monthlyAmount: "45.00", rollover: true });
  });

  it("refuses another user's category and income categories", async () => {
    expect((await post({ items: [{ categoryId: ids.Altrui, amount: 10, rollover: false }] })).status).toBe(404);
    expect((await post({ items: [{ categoryId: ids.Stipendio, amount: 10, rollover: false }] })).status).toBe(404);
    expect(await db.select().from(budgets).where(eq(budgets.userId, userId))).toHaveLength(0);
  });
});
