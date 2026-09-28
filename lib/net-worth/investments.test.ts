import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instrumentPrices, instruments, investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { backfillDerivedInvestmentHistory, writeInvestmentSnapshot } from "./investments";
import { findUsersWithAccounts } from "./scheduler";
import { hasAnySnapshot } from "./snapshots";

const TODAY = new Date(2026, 8, 20);

describe("patrimonio netto: investimenti", () => {
  let userId: string;
  let instrumentId: string;
  let portfolioId: string;

  async function buy(date: string, quantity: string, price: string) {
    await db.insert(investmentTransactions).values({ userId, portfolioId, instrumentId, type: "acquisto", date, quantity, price });
  }

  async function rows() {
    return db
      .select({ date: netWorthSnapshots.date, amount: netWorthSnapshots.amount, source: netWorthSnapshots.source })
      .from(netWorthSnapshots)
      .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "investimenti")))
      .orderBy(netWorthSnapshots.date);
  }

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-nw-investments-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-nw-investments-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
      })
      .returning();
    userId = user.id;
    const [instrument] = await db
      .insert(instruments)
      .values({ name: "ETF test", type: "etf", currency: "EUR", createdByUserId: userId })
      .returning();
    instrumentId = instrument.id;
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "Portafoglio" }).returning();
    portfolioId = portfolio.id;
    await db.insert(instrumentPrices).values([
      { instrumentId, date: "2026-09-16", close: "110", source: "yahoo" },
      { instrumentId, date: "2026-09-18", close: "120", source: "yahoo" },
    ]);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(instruments).where(eq(instruments.id, instrumentId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("ricostruisce lo storico dalla prima operazione a ieri e scrive lo snapshot di oggi", async () => {
    await buy("2026-09-15", "10", "100");
    expect(await backfillDerivedInvestmentHistory(userId, TODAY)).toBe(5);
    await writeInvestmentSnapshot(userId, TODAY);
    expect(await rows()).toEqual([
      { date: "2026-09-15", amount: "1000.00", source: "derivato" },
      { date: "2026-09-16", amount: "1100.00", source: "derivato" },
      { date: "2026-09-17", amount: "1100.00", source: "derivato" },
      { date: "2026-09-18", amount: "1200.00", source: "derivato" },
      { date: "2026-09-19", amount: "1200.00", source: "derivato" },
      { date: "2026-09-20", amount: "1200.00", source: "snapshot" },
    ]);
    // Seconda chiamata: niente da rifare.
    expect(await backfillDerivedInvestmentHistory(userId, TODAY)).toBe(0);
  });

  it("rifà lo storico derivato se arriva un'operazione più vecchia, senza toccare gli snapshot reali", async () => {
    await buy("2026-09-17", "10", "100");
    await backfillDerivedInvestmentHistory(userId, TODAY);
    await writeInvestmentSnapshot(userId, TODAY);
    await buy("2026-09-14", "5", "100");
    expect(await backfillDerivedInvestmentHistory(userId, TODAY)).toBe(6);
    const all = await rows();
    expect(all[0]).toEqual({ date: "2026-09-14", amount: "500.00", source: "derivato" });
    // Lo snapshot reale di oggi non si tocca: lo riscrive il cron della sera (e la Panoramica mostra oggi il valore live).
    expect(all.at(-1)).toEqual({ date: "2026-09-20", amount: "1200.00", source: "snapshot" });
    expect(all).toHaveLength(7);
  });

  it("le righe investimenti non bloccano la ricostruzione della liquidità e l'utente entra nel cron", async () => {
    await buy("2026-09-15", "1", "100");
    await writeInvestmentSnapshot(userId, TODAY);
    expect(await hasAnySnapshot(userId)).toBe(false);
    expect(await findUsersWithAccounts()).toContain(userId);
  });

  it("senza operazioni non scrive nulla", async () => {
    await writeInvestmentSnapshot(userId, TODAY);
    expect(await backfillDerivedInvestmentHistory(userId, TODAY)).toBe(0);
    expect(await rows()).toEqual([]);
  });
});
