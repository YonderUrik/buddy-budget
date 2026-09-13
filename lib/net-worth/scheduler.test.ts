import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { findUsersWithAccounts, snapshotUser } from "./scheduler";

// runDailySnapshots() non viene mai chiamata qui: girerebbe su tutti gli utenti del DB di sviluppo condiviso.
const TODAY = new Date(2026, 8, 13);

describe("net-worth scheduler", () => {
  let userId: string;
  let userWithoutAccountsId: string;

  async function createUser(prefix: string) {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `${prefix}-${crypto.randomUUID()}`,
        name: "Test Net Worth Scheduler",
        email: `${prefix}-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    return user.id;
  }

  beforeEach(async () => {
    userId = await createUser("test-net-worth-scheduler");
    userWithoutAccountsId = await createUser("test-net-worth-scheduler-empty");
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, userWithoutAccountsId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("findUsersWithAccounts include solo gli utenti con almeno un conto", async () => {
    await db.insert(accounts).values({ userId, name: "Contanti", type: "Contanti", balance: "10.00" });

    const userIds = await findUsersWithAccounts();

    expect(userIds).toContain(userId);
    expect(userIds).not.toContain(userWithoutAccountsId);
  });

  it("snapshotUser ricostruisce lo storico prima di scrivere lo snapshot del giorno", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "1000.00", source: "auto" })
      .returning();
    const [category] = await db.insert(categories).values({ userId, name: "Varie", type: "variabile" }).returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Spesa",
      amount: "-100.00",
      date: "2026-09-12",
      source: "auto",
    });

    await snapshotUser(userId, TODAY);

    const rows = await db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId))
      .orderBy(netWorthSnapshots.date);
    expect(rows.map((r) => [r.date, r.amount, r.source])).toEqual([
      ["2026-09-12", "1000.00", "derivato"],
      ["2026-09-13", "1000.00", "snapshot"],
    ]);
  });
});
