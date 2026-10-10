import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { clearDemo, rejectIfDemoActive, startDemo } from "./demo";
import { hasDemoData, loadStartStatus, setChecklistDismissed } from "./status";

const userIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = `start-test-${crypto.randomUUID()}`;
  userIds.push(id);
  await db.insert(authUser).values({ id, name: "Start", email: `${id}@example.com`, onboardingCompleted: true });
  await db.insert(categories).values(defaultCategoryRows(id));
  return id;
}

afterAll(async () => {
  if (userIds.length) await db.delete(authUser).where(inArray(authUser.id, userIds));
  await client.end();
});

describe("dati d'esempio", () => {
  it("crea conti e movimenti demo, li esclude dai passi e li azzera", async () => {
    const userId = await makeUser();
    const before = await loadStartStatus(userId);
    expect(before.steps).toEqual({ conto: false, import: false, investimento: false, obiettivo: false });
    expect(before.demoActive).toBe(false);

    const result = await startDemo(userId);
    expect(result.ok).toBe(true);
    expect(await hasDemoData(userId)).toBe(true);
    const during = await loadStartStatus(userId);
    expect(during.demoActive).toBe(true);
    expect(during.steps.conto).toBe(false);
    expect((await rejectIfDemoActive(userId))?.status).toBe(409);
    expect((await startDemo(userId)).ok).toBe(false);
    expect((await db.select().from(transactions).where(eq(transactions.userId, userId))).length).toBeGreaterThan(50);

    expect(await clearDemo(userId)).toBe(2);
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(0);
    expect(await db.select().from(transactions).where(eq(transactions.userId, userId))).toHaveLength(0);
    expect(await db.select().from(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId))).toHaveLength(0);
    expect(await rejectIfDemoActive(userId)).toBeNull();
  });

  it("non parte per chi ha già un conto vero", async () => {
    const userId = await makeUser();
    await db.insert(accounts).values({ userId, name: "Vero", type: "Conto corrente", balance: "10" });
    expect(await startDemo(userId)).toEqual({ ok: false, reason: "has_data" });
    expect((await loadStartStatus(userId)).steps.conto).toBe(true);
  });

  it("ricorda la checklist chiusa", async () => {
    const userId = await makeUser();
    await setChecklistDismissed(userId, true);
    expect((await loadStartStatus(userId)).dismissed).toBe(true);
    await setChecklistDismissed(userId, false);
    expect((await loadStartStatus(userId)).dismissed).toBe(false);
  });
});
