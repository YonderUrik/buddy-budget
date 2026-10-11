import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, deleteRequisition: vi.fn() };
});

import { deleteRequisition } from "./client";
import { releaseConnectionIfUnused } from "./release";

describe("releaseConnectionIfUnused", () => {
  let userId: string;

  beforeEach(async () => {
    userId = `test-release-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "Test Release", email: `${userId}@example.com`, emailVerified: false, currency: "EUR" });
    vi.mocked(deleteRequisition).mockReset();
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  async function connection(withAccount: boolean) {
    const [row] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_A", institutionName: "Banca A", requisitionId: "req-release", status: "linked" })
      .returning();
    if (withAccount) {
      const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "checking", source: "auto" }).returning();
      await db.insert(bankAccountLinks).values({ connectionId: row.id, accountId: account.id, externalAccountId: "ext-1" });
    }
    return row.id;
  }

  it("senza più conti elimina la requisition su GoCardless e la riga", async () => {
    const id = await connection(false);
    expect(await releaseConnectionIfUnused(id, "account_removed")).toBe(true);
    expect(deleteRequisition).toHaveBeenCalledWith("req-release");
    expect(await db.select().from(bankConnections).where(eq(bankConnections.id, id))).toHaveLength(0);
  });

  it("con un conto ancora collegato non tocca nulla", async () => {
    const id = await connection(true);
    expect(await releaseConnectionIfUnused(id, "account_removed")).toBe(false);
    expect(deleteRequisition).not.toHaveBeenCalled();
    expect(await db.select().from(bankConnections).where(eq(bankConnections.id, id))).toHaveLength(1);
  });

  it("se GoCardless non risponde lascia la riga alla pulizia giornaliera, senza lanciare", async () => {
    vi.mocked(deleteRequisition).mockRejectedValue(new Error("GoCardless down"));
    const id = await connection(false);
    expect(await releaseConnectionIfUnused(id, "renewed")).toBe(false);
    expect(await db.select().from(bankConnections).where(eq(bankConnections.id, id))).toHaveLength(1);
  });
});
