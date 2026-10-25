import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { MOVEMENT_SCAN_LIMIT, searchEverything } from "./server";

const NOW = new Date(Date.UTC(2026, 9, 25, 12));
const [alice, bob, carla] = ["alice", "bob", "carla"].map((name) => `test-search-${name}-${crypto.randomUUID()}`);

/** One user with an account, a category and the given movements (newest dates first are fine: order does not matter). */
async function seed(userId: string, accountName: string, movements: { description: string; date: string; amount?: string }[]) {
  await db.insert(authUser).values({ id: userId, name: "Search test", email: `${userId}@example.test`, emailVerified: false, currency: "EUR" });
  const [account] = await db.insert(accounts).values({ userId, name: accountName, type: "Conto corrente", balance: "1000.00", source: "manuale" }).returning();
  const [category] = await db.insert(categories).values({ userId, name: `Svago ${userId.slice(-4)}`, type: "voluta" }).returning();
  const rows = movements.map((m) => ({ userId, accountId: account.id, categoryId: category.id, description: m.description, amount: m.amount ?? "-10.00", date: m.date, source: "manuale" as const }));
  for (let i = 0; i < rows.length; i += 1000) await db.insert(transactions).values(rows.slice(i, i + 1000));
}

beforeAll(async () => {
  await seed(alice, "Conto di Alice", [
    { description: "Netflix", date: "2026-10-17", amount: "-13.99" },
    { description: "Netflix", date: "2026-09-17", amount: "-13.99" },
    { description: "Netflix", date: "2026-08-17", amount: "-13.99" },
    { description: "Bonifico a favore di Luca", date: "2026-10-18", amount: "-50.00" },
    // Older than the 24-month window: never read.
    { description: "Vecchio abbonamento palestra", date: "2024-08-01" },
  ]);
  await seed(bob, "Conto segreto di Bob", [
    { description: "Netflix", date: "2026-10-10", amount: "-13.99" },
    { description: "Bonifico a favore di Bob", date: "2026-10-11" },
  ]);
  // More movements in the window than the scan reads: the oldest one is past the cap.
  await seed(carla, "Conto di Carla", [
    { description: "Ferramenta rara", date: "2025-01-02" },
    ...Array.from({ length: MOVEMENT_SCAN_LIMIT }, (_, i) => ({ description: `Spesa ${i}`, date: i % 2 ? "2026-10-01" : "2026-09-01" })),
  ]);
}, 60_000);

afterAll(async () => {
  await db.delete(authUser).where(inArray(authUser.id, [alice, bob, carla]));
  await client.end();
});

describe("searchEverything", () => {
  it("finds only the user's own data", async () => {
    const result = await searchEverything(alice, "netflix", NOW);
    const movements = result.hits.filter((h) => h.group === "movimenti");
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ title: "Netflix", count: 3 });
    expect((await searchEverything(alice, "segreto", NOW)).hits).toEqual([]);
    expect((await searchEverything(alice, "Bob", NOW)).hits).toEqual([]);
    expect((await searchEverything(bob, "Luca", NOW)).hits).toEqual([]);
  });

  it("opens one movement in place and a repeated merchant, an account or a category in Movimenti", async () => {
    const [single] = (await searchEverything(alice, "bonifico", NOW)).hits;
    expect(single).toMatchObject({ group: "movimenti", count: 1 });
    expect(single.movementId).toBeTypeOf("string");
    expect(single.href).toBeUndefined();
    const [repeated] = (await searchEverything(alice, "netflix", NOW)).hits;
    expect(repeated.href).toBe("/liquidita?testo=Netflix");
    const account = (await searchEverything(alice, "alice", NOW)).hits.find((h) => h.group === "conti");
    expect(account?.href).toMatch(/^\/liquidita\?conto=[0-9a-f-]{36}$/);
    const category = (await searchEverything(alice, "svago", NOW)).hits.find((h) => h.group === "categorie");
    expect(category?.href).toMatch(/^\/liquidita\?categoria=[0-9a-f-]{36}$/);
  });

  it("matches an exact amount and reads only the last 24 months", async () => {
    const byAmount = (await searchEverything(alice, "13,99", NOW)).hits.filter((h) => h.group === "movimenti");
    expect(byAmount.length).toBeGreaterThan(0);
    expect(byAmount.every((h) => h.amount === -13.99)).toBe(true);
    expect((await searchEverything(alice, "palestra", NOW)).hits).toEqual([]);
  });

  it("stops at the scan cap and says so", async () => {
    const capped = await searchEverything(carla, "ferramenta", NOW);
    expect(capped.movementScanCapped).toBe(true);
    expect(capped.hits).toEqual([]);
    expect((await searchEverything(alice, "netflix", NOW)).movementScanCapped).toBe(false);
  });
});
