import { inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, investmentPortfolios, investmentTargets, investmentTransactions } from "@/lib/db/schema/investments";
import { loadInvestmentData } from "./data";
import { buildTaxView } from "./tax-view";

const TODAY = new Date("2026-10-11T12:00:00Z");

describe("lista Aliquote degli strumenti: solo i titoli dell'utente", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];

  async function newUser(label: string) {
    const [u] = await db
      .insert(authUser)
      .values({ id: `test-ratelist-${label}-${crypto.randomUUID()}`, name: label, email: `test-ratelist-${crypto.randomUUID()}@example.com`, emailVerified: false })
      .returning();
    userIds.push(u.id);
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId: u.id, name: "Portafoglio" }).returning();
    return { userId: u.id, portfolioId: portfolio.id };
  }
  async function newInstrument(name: string, createdByUserId: string | null) {
    const [row] = await db.insert(instruments).values({ name, type: "etf", currency: "EUR", priceMode: "manuale", createdByUserId }).returning();
    instrumentIds.push(row.id);
    return row.id;
  }
  async function trade(owner: { userId: string; portfolioId: string }, instrumentId: string, type: "acquisto" | "vendita", date: string) {
    await db.insert(investmentTransactions).values({ userId: owner.userId, portfolioId: owner.portfolioId, instrumentId, type, date, quantity: "10", price: "100" });
  }

  afterEach(async () => {
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
  });

  it("non mostra i titoli di un altro utente né quelli chiusi o solo nell'allocazione", async () => {
    const alice = await newUser("alice");
    const bob = await newUser("bob");
    const aliceShared = await newInstrument("Comune di Alice", null);
    const alicePrivate = await newInstrument("Privato di Alice", alice.userId);
    await trade(alice, aliceShared, "acquisto", "2026-01-10");
    await trade(alice, alicePrivate, "acquisto", "2026-01-10");

    const bobOpen = await newInstrument("Aperto di Bob", null);
    const bobClosedLastYear = await newInstrument("Chiuso nel 2025", null);
    const bobSoldThisYear = await newInstrument("Venduto nel 2026", null);
    const bobTargetOnly = await newInstrument("Solo obiettivo", null);
    await trade(bob, bobOpen, "acquisto", "2026-02-01");
    await trade(bob, bobClosedLastYear, "acquisto", "2025-01-10");
    await trade(bob, bobClosedLastYear, "vendita", "2025-06-10");
    await trade(bob, bobSoldThisYear, "acquisto", "2025-01-10");
    await trade(bob, bobSoldThisYear, "vendita", "2026-03-10");
    await db.insert(investmentTargets).values({ portfolioId: bob.portfolioId, instrumentId: bobTargetOnly, weight: "1" });

    const bobView = buildTaxView(await loadInvestmentData(bob.userId, null), TODAY);
    expect(bobView.instruments.map((i) => i.id)).not.toContain(aliceShared);
    expect(bobView.instruments.map((i) => i.id)).not.toContain(alicePrivate);
    expect(bobView.rateListInstruments.map((i) => i.id).sort()).toEqual([bobOpen, bobSoldThisYear].sort());

    const aliceView = buildTaxView(await loadInvestmentData(alice.userId, null), TODAY);
    expect(aliceView.rateListInstruments.map((i) => i.id).sort()).toEqual([aliceShared, alicePrivate].sort());
  });
});
