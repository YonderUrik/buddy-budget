import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, investmentPortfolios, investmentTransactions, userWatchlistItems } from "@/lib/db/schema/investments";
import { searchKnownInstruments } from "./instruments";

const TAG = `Isolamento${crypto.randomUUID().slice(0, 8)}`;

describe("ricerca degli strumenti già noti: isolamento tra utenti", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let alice: string;
  let bob: string;
  let sharedOfBob: string;
  let sharedOfAlice: string;
  let sharedNobody: string;
  let manualOfBob: string;

  async function newUser(label: string) {
    const [u] = await db
      .insert(authUser)
      .values({ id: `test-search-${label}-${crypto.randomUUID()}`, name: label, email: `test-search-${crypto.randomUUID()}@example.com`, emailVerified: false })
      .returning();
    userIds.push(u.id);
    return u.id;
  }
  async function newInstrument(name: string, createdByUserId: string | null = null) {
    const [i] = await db.insert(instruments).values({ name: `${TAG} ${name}`, type: "etf", currency: "EUR", createdByUserId }).returning();
    instrumentIds.push(i.id);
    return i.id;
  }
  async function buy(userId: string, instrumentId: string) {
    const [p] = await db.insert(investmentPortfolios).values({ userId, name: "P" }).returning();
    await db.insert(investmentTransactions).values({ userId, portfolioId: p.id, instrumentId, type: "acquisto", date: "2026-09-25", quantity: "1", price: "100" });
  }

  beforeEach(async () => {
    alice = await newUser("alice");
    bob = await newUser("bob");
    sharedOfAlice = await newInstrument("di Alice");
    sharedOfBob = await newInstrument("di Bob");
    sharedNobody = await newInstrument("di nessuno");
    manualOfBob = await newInstrument("manuale di Bob", bob);
    await buy(alice, sharedOfAlice);
    await buy(bob, sharedOfBob);
  });

  afterEach(async () => {
    await db.delete(investmentPortfolios).where(inArray(investmentPortfolios.userId, userIds));
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
  });

  it("non mostra gli strumenti comuni che solo altri utenti hanno nel portafoglio", async () => {
    const ids = (await searchKnownInstruments(alice, TAG)).map((i) => i.id);
    expect(ids).toContain(sharedOfAlice);
    expect(ids).not.toContain(sharedOfBob);
    expect(ids).not.toContain(sharedNobody);
  });

  it("non mostra mai i manuali di un altro utente", async () => {
    expect((await searchKnownInstruments(alice, TAG)).map((i) => i.id)).not.toContain(manualOfBob);
    expect((await searchKnownInstruments(bob, TAG)).map((i) => i.id)).toContain(manualOfBob);
  });

  it("include gli strumenti in watchlist dell'utente", async () => {
    await db.insert(userWatchlistItems).values({ userId: alice, instrumentId: sharedNobody });
    expect((await searchKnownInstruments(alice, TAG)).map((i) => i.id)).toContain(sharedNobody);
    expect((await searchKnownInstruments(bob, TAG)).map((i) => i.id)).not.toContain(sharedNobody);
    await db.delete(userWatchlistItems).where(eq(userWatchlistItems.userId, alice));
  });
});
