import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "./client";
import { authUser } from "./schema/auth";
import { accounts } from "./schema/accounts";
import { bankAccountLinks, bankConnections } from "./schema/bank-connections";
import { categories, DEFAULT_CATEGORIES } from "./schema/categories";

describe("bank_connections / bank_account_links — round trip", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("crea connessione + link conto, e li rilegge tramite join", async () => {
    const testId = `test-bank-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Bank User",
        email: `test-bank-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();

    const [connection] = await db
      .insert(bankConnections)
      .values({
        userId,
        institutionId: "SANDBOXFINANCE_SFIN0000",
        institutionName: "Sandbox Finance",
        status: "pending",
      })
      .returning();
    expect(connection.requisitionId).toBeNull();

    const [link] = await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-123" })
      .returning();

    const rows = await db
      .select({ status: bankConnections.status, externalAccountId: bankAccountLinks.externalAccountId })
      .from(bankAccountLinks)
      .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
      .where(eq(bankAccountLinks.id, link.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ status: "pending", externalAccountId: "ext-123" });
  });

  it("include 'Da categorizzare' tra le categorie seed", () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toContain("Da categorizzare");
  });
});
