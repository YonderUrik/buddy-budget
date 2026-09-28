import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  instrumentPrices,
  instruments,
  investmentPortfolios,
  investmentTransactions,
} from "@/lib/db/schema/investments";

describe("schema investimenti", () => {
  let userId: string;
  let instrumentId: string;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-investments-schema-${crypto.randomUUID()}`,
        name: "Test Investimenti",
        email: `test-investments-schema-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
      })
      .returning();
    userId = user.id;
    const [instrument] = await db
      .insert(instruments)
      .values({ name: `Test ETF ${crypto.randomUUID()}`, type: "etf", currency: "EUR", createdByUserId: userId })
      .returning();
    instrumentId = instrument.id;
  });

  afterEach(async () => {
    await db.delete(investmentPortfolios).where(eq(investmentPortfolios.userId, userId));
    await db.delete(instruments).where(eq(instruments.id, instrumentId));
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("rifiuta due chiusure dello stesso strumento nello stesso giorno", async () => {
    await db.insert(instrumentPrices).values({ instrumentId, date: "2026-09-25", close: "100", source: "yahoo" });
    await expect(
      db.insert(instrumentPrices).values({ instrumentId, date: "2026-09-25", close: "101", source: "stooq" })
    ).rejects.toThrow();
  });

  it("impedisce di cancellare uno strumento usato da un'operazione", async () => {
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "Portafoglio" }).returning();
    await db.insert(investmentTransactions).values({
      userId,
      portfolioId: portfolio.id,
      instrumentId,
      type: "acquisto",
      date: "2026-09-25",
      quantity: "1",
      price: "100",
    });
    await expect(db.delete(instruments).where(eq(instruments.id, instrumentId))).rejects.toThrow();
  });
});
