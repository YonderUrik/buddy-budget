import { NextRequest, after } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/sync-jobs/redis-store", async () => {
  const { createMemorySyncJobKv, createSyncJobStore } = await import("@/lib/sync-jobs/store");
  return { redisSyncJobStore: createSyncJobStore(createMemorySyncJobKv()) };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/gocardless/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/sync")>();
  return { ...actual, syncAccountLink: vi.fn() };
});

import { auth } from "@/lib/auth";
import { syncAccountLink } from "@/lib/gocardless/sync";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { POST } from "./route";

const afterTasks: Promise<unknown>[] = [];

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("POST /api/gocardless/accounts/[accountId]/sync", () => {
  let userId: string;
  let accountId: string;

  async function createLinkedAccount(syncTimestamps: string[] = []) {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "linked" })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1", syncTimestamps });
    accountId = account.id;
  }

  beforeEach(async () => {
    const testId = `test-manual-sync-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Manual Sync",
        email: `test-manual-sync-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(syncAccountLink).mockReset();
    afterTasks.length = 0;
    vi.mocked(after).mockClear();
    vi.mocked(after).mockImplementation((task) => {
      afterTasks.push(Promise.resolve(typeof task === "function" ? task() : task));
    });
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 404 se il conto non è dell'utente collegato", async () => {
    await createLinkedAccount();
    mockedGetSession.mockResolvedValueOnce({ user: { id: "altro-utente" } } as never);

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }),
      { params: Promise.resolve({ accountId }) }
    );
    expect(response.status).toBe(404);
    expect(syncAccountLink).not.toHaveBeenCalled();
  });

  it("risponde 429 senza chiamare syncAccountLink se il budget condiviso è esaurito", async () => {
    const recentTimestamps = [0, 6, 12, 18].map((h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString());
    await createLinkedAccount(recentTimestamps);

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }),
      { params: Promise.resolve({ accountId }) }
    );
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.status).toBe("not-eligible");
    expect(syncAccountLink).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  function postSync() {
    return POST(new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }), {
      params: Promise.resolve({ accountId }),
    });
  }

  it("risponde 202 con jobId e completa il job in background", async () => {
    await createLinkedAccount();
    vi.mocked(syncAccountLink).mockResolvedValue({
      status: "synced",
      newTransactionsCount: 3,
      categorizedCount: 2,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });

    const response = await postSync();
    expect(response.status).toBe(202);
    const { jobId } = await response.json();
    await Promise.all(afterTasks);

    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.kind).toBe("manual-sync");
    expect(job?.accounts[0]).toMatchObject({ accountId, name: "Conto Auto", phase: "done", inserted: 3 });
    expect(await redisSyncJobStore.acquireAccountLock(accountId)).toBe(true);
  });

  it("risponde 409 senza avviare nulla se il conto ha già un sync in corso", async () => {
    await createLinkedAccount();
    await redisSyncJobStore.acquireAccountLock(accountId);

    const response = await postSync();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: "already-running" });
    expect(after).not.toHaveBeenCalled();
    expect(syncAccountLink).not.toHaveBeenCalled();
  });

  it("risponde 503 e rilascia il lock se lo store dei job non risponde", async () => {
    await createLinkedAccount();
    vi.spyOn(redisSyncJobStore, "createJob").mockRejectedValueOnce(new Error("Redis giù"));

    const response = await postSync();
    expect(response.status).toBe(503);
    expect(await redisSyncJobStore.acquireAccountLock(accountId)).toBe(true);
  });
});
