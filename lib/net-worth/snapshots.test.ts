import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { backfillDerivedHistory, writeDailySnapshot } from "./snapshots";

const TODAY = new Date(2026, 8, 13);

describe("net-worth snapshots", () => {
  let userId: string;
  let categoryId: string;

  async function createAccount(source: "auto" | "manuale", balance: string) {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: `Conto ${source}`, type: "Conto corrente", balance, source })
      .returning();
    return account.id;
  }

  async function snapshotRows() {
    return db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId))
      .orderBy(netWorthSnapshots.date);
  }

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-net-worth-${crypto.randomUUID()}`,
        name: "Test Net Worth",
        email: `test-net-worth-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Varie", type: "voluta" })
      .returning();
    categoryId = category.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("backfillDerivedHistory scrive righe derivate di liquidità dai movimenti Auto", async () => {
    const autoId = await createAccount("auto", "1000.00");
    await db.insert(transactions).values([
      { userId, accountId: autoId, categoryId, description: "Spesa", amount: "-100.00", date: "2026-09-11", source: "auto" },
      { userId, accountId: autoId, categoryId, description: "Rimborso", amount: "50.00", date: "2026-09-12", source: "auto" },
    ]);

    const written = await backfillDerivedHistory(userId, TODAY);

    expect(written).toBe(2);
    const rows = await snapshotRows();
    expect(rows.map((r) => [r.date, r.amount, r.assetClass, r.source])).toEqual([
      ["2026-09-11", "950.00", "liquidita", "derivato"],
      ["2026-09-12", "1000.00", "liquidita", "derivato"],
    ]);
  });

  it("backfillDerivedHistory non fa nulla se l'utente ha già snapshot", async () => {
    const autoId = await createAccount("auto", "1000.00");
    await db.insert(transactions).values({
      userId,
      accountId: autoId,
      categoryId,
      description: "Spesa",
      amount: "-100.00",
      date: "2026-09-11",
      source: "auto",
    });
    await backfillDerivedHistory(userId, TODAY);

    expect(await backfillDerivedHistory(userId, TODAY)).toBe(0);
    expect(await snapshotRows()).toHaveLength(2);
  });

  it("backfillDerivedHistory non scrive nulla senza conti Auto", async () => {
    const manualId = await createAccount("manuale", "300.00");
    await db.insert(transactions).values({
      userId,
      accountId: manualId,
      categoryId,
      description: "Spesa",
      amount: "-10.00",
      date: "2026-09-11",
    });

    expect(await backfillDerivedHistory(userId, TODAY)).toBe(0);
    expect(await snapshotRows()).toHaveLength(0);
  });

  it("writeDailySnapshot scrive la somma dei saldi correnti come snapshot reale", async () => {
    await createAccount("auto", "1000.00");
    await createAccount("manuale", "200.00");

    await writeDailySnapshot(userId, TODAY);

    const rows = await snapshotRows();
    expect(rows.map((r) => [r.date, r.amount, r.source])).toEqual([["2026-09-13", "1200.00", "snapshot"]]);
  });

  it("writeDailySnapshot è idempotente e aggiorna l'importo dello stesso giorno", async () => {
    const accountId = await createAccount("manuale", "200.00");
    await writeDailySnapshot(userId, TODAY);
    await db.update(accounts).set({ balance: "350.00" }).where(eq(accounts.id, accountId));

    await writeDailySnapshot(userId, TODAY);

    const rows = await snapshotRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("350.00");
  });

  it("uno snapshot reale sovrascrive una riga derivata dello stesso giorno", async () => {
    await createAccount("manuale", "500.00");
    await db
      .insert(netWorthSnapshots)
      .values({ userId, date: "2026-09-13", assetClass: "liquidita", amount: "1.00", source: "derivato" });

    await writeDailySnapshot(userId, TODAY);

    const [row] = await db
      .select()
      .from(netWorthSnapshots)
      .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.date, "2026-09-13")));
    expect(row.source).toBe("snapshot");
    expect(row.amount).toBe("500.00");
  });
});
