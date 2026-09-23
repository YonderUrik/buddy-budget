import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/gocardless/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/sync")>();
  return { ...actual, syncAccountLink: vi.fn() };
});

vi.mock("@/lib/sync-jobs/redis-store", async () => {
  const { createMemorySyncJobKv, createSyncJobStore } = await import("@/lib/sync-jobs/store");
  return { redisSyncJobStore: createSyncJobStore(createMemorySyncJobKv()) };
});

import { syncAccountLink } from "./sync";
import { findDueLinks, runDueSyncs } from "./scheduler";

describe("scheduler", () => {
  let userId: string;

  async function createLink(nextSyncEligibleAt: Date, status: "linked" | "expired" = "linked") {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1", nextSyncEligibleAt });
  }

  beforeEach(async () => {
    const testId = `test-scheduler-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Scheduler",
        email: `test-scheduler-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    vi.mocked(syncAccountLink)
      .mockReset()
      .mockResolvedValue({
        status: "synced",
        newTransactionsCount: 0,
        categorizedCount: 0,
        uncategorizedCount: 0,
        balanceUpdated: true,
      });
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("trova solo i link scaduti e con connessione 'linked'", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    await createLink(past, "linked");
    await createLink(past, "expired");
    await createLink(future, "linked");

    const due = await findDueLinks();
    expect(due).toHaveLength(1);
  });

  it("runDueSyncs chiama syncAccountLink una volta per ogni link dovuto", async () => {
    const past = new Date(Date.now() - 60_000);
    await createLink(past, "linked");
    await createLink(past, "linked");

    await runDueSyncs();

    expect(syncAccountLink).toHaveBeenCalledTimes(2);
  });

  it("salta i link che hanno esaurito il budget condiviso di sync anche se nextSyncEligibleAt è passato", async () => {
    const past = new Date(Date.now() - 60_000);
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "linked" })
      .returning();
    const recentTimestamps = [0, 6, 12, 18].map((h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString());
    await db.insert(bankAccountLinks).values({
      connectionId: connection.id,
      accountId: account.id,
      externalAccountId: "ext-1",
      nextSyncEligibleAt: past,
      syncTimestamps: recentTimestamps,
    });

    await runDueSyncs();

    expect(syncAccountLink).not.toHaveBeenCalled();
  });
});
