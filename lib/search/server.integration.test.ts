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
async function seed(userId: string, accountName: string, movements: { description: string; date: string; amount?: string; excluded?: string }[]) {
  await db.insert(authUser).values({ id: userId, name: "Search test", email: `${userId}@example.test`, emailVerified: false, currency: "EUR" });
  const [account] = await db.insert(accounts).values({ userId, name: accountName, type: "Conto corrente", balance: "1000.00", source: "manuale" }).returning();
  const [category] = await db.insert(categories).values({ userId, name: `Svago ${userId.slice(-4)}`, type: "voluta" }).returning();
  const rows = movements.map((m) => ({ userId, accountId: account.id, categoryId: category.id, description: m.description, amount: m.amount ?? "-10.00", excludedAmount: m.excluded ?? "0", date: m.date, source: "manuale" as const }));
  for (let i = 0; i < rows.length; i += 1000) await db.insert(transactions).values(rows.slice(i, i + 1000));
}

beforeAll(async () => {
  await seed(alice, "Conto di Alice", [
    { description: "Netflix", date: "2026-10-17", amount: "-13.99" },
    { description: "Netflix", date: "2026-09-17", amount: "-13.99" },
    { description: "Netflix", date: "2026-08-17", amount: "-13.99" },
    { description: "Bonifico a favore di Luca", date: "2026-10-18", amount: "-50.00" },
    // Half of it split away with «Dividi», and a transfer excluded in full: only 30 € and nothing count.
    { description: "Cena da Mario", date: "2026-10-03", amount: "-60.00", excluded: "-30.00" },
    { description: "Giroconto", date: "2026-10-05", amount: "-200.00", excluded: "-200.00" },
    { description: "Stipendio", date: "2026-10-27", amount: "2000.00" },
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

describe("answers to questions", () => {
  const answerOf = async (userId: string, query: string) => (await searchEverything(userId, query, NOW)).hits.find((h) => h.group === "risposte");

  it("sums one merchant over a year, on the user's movements only, and lists them too", async () => {
    const result = await searchEverything(alice, "soldi spesi su Netflix nel 2026", NOW);
    expect(result.question).toBe("totale");
    expect(result.hits[0]).toMatchObject({
      group: "risposte",
      title: "Netflix",
      amount: -41.97,
      answer: { kind: "totale", direction: "uscite", count: 3, category: false, partial: false, source: "regole" },
      href: "/liquidita?testo=netflix&periodo=anno&data=2026-01-01",
    });
    expect(result.hits.some((h) => h.group === "movimenti" && h.title === "Netflix")).toBe(true);
    expect(await answerOf(bob, "soldi spesi su Netflix nel 2026")).toMatchObject({ amount: -13.99, answer: { count: 1 } });
  });

  it("sums a month after «Dividi», leaving out transfers excluded in full", async () => {
    expect(await answerOf(alice, "spese di ottobre")).toMatchObject({ title: "", amount: -93.99, answer: { count: 3 }, href: "/liquidita?periodo=mese&data=2026-10-01" });
    expect(await answerOf(alice, "entrate di ottobre")).toMatchObject({ amount: 2000, answer: { direction: "entrate", count: 1 } });
  });

  it("sums a category in SQL and says when part of a period is older than what «Cerca» reads", async () => {
    const svago = await answerOf(alice, "quanto ho speso in svago quest'anno");
    expect(svago).toMatchObject({ icon: "categoria", amount: -121.97, answer: { category: true, count: 5 } });
    expect(svago?.href).toMatch(/^\/liquidita\?categoria=[0-9a-f-]{36}&periodo=anno&data=2026-01-01$/);
    expect(await answerOf(alice, "quanto ho speso in palestra nel 2024")).toMatchObject({ amount: 0, answer: { count: 0, partial: true } });
  });

  it("answers balances only for the user's own accounts, and the next instalment when there is none", async () => {
    expect(await answerOf(alice, "saldo conto di Alice")).toMatchObject({ title: "Conto di Alice", amount: 1000, answer: { kind: "saldo", accounts: 1 } });
    expect(await answerOf(alice, "saldo")).toMatchObject({ title: "", amount: 1000, answer: { accounts: 1 } });
    expect(await answerOf(alice, "saldo segreto")).toBeUndefined();
    expect(await answerOf(alice, "prossima rata")).toMatchObject({ title: "", href: "/debiti", answer: { kind: "rata", date: null } });
  });
});
