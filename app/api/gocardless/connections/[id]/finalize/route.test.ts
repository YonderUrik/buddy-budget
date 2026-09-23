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
  return {
    ...actual,
    syncAccountLink: vi.fn().mockResolvedValue({
      status: "synced",
      newTransactionsCount: 0,
      categorizedCount: 0,
      uncategorizedCount: 0,
      balanceUpdated: true,
    }),
  };
});

import { auth } from "@/lib/auth";
import { syncAccountLink } from "@/lib/gocardless/sync";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { POST } from "./route";

const afterTasks: Promise<unknown>[] = [];

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("POST /api/gocardless/connections/[id]/finalize", () => {
  let userId: string;
  let connectionId: string;

  beforeEach(async () => {
    const testId = `test-finalize-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Finalize",
        email: `test-finalize-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-1", status: "linked" })
      .returning();
    connectionId = connection.id;
    vi.mocked(syncAccountLink).mockClear();
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

  it("crea un nuovo conto per una selezione 'new' e lancia il sync", async () => {
    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [{ externalAccountId: "ext-1", name: "Conto Corrente", type: "Conto corrente", mode: "new" }],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(201);
    const { jobId } = await response.json();
    await Promise.all(afterTasks);
    expect(syncAccountLink).toHaveBeenCalledTimes(1);
    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.kind).toBe("initial-import");
    expect(job?.accounts).toHaveLength(1);
    expect(job?.accounts[0]).toMatchObject({ name: "Conto Corrente", phase: "done" });

    const [createdAccount] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(createdAccount.source).toBe("auto");

    const [link] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.accountId, createdAccount.id));
    expect(link.externalAccountId).toBe("ext-1");
  });

  it("ricollega un conto esistente per una selezione 'existing'", async () => {
    const [existingAccount] = await db
      .insert(accounts)
      .values({ userId, name: "Vecchio Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [oldConnection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "expired" })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: oldConnection.id, accountId: existingAccount.id, externalAccountId: "old-ext" });

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [
            {
              externalAccountId: "ext-new",
              name: "Conto Corrente",
              type: "Conto corrente",
              mode: "existing",
              existingAccountId: existingAccount.id,
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(201);

    const [link] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.accountId, existingAccount.id));
    expect(link.externalAccountId).toBe("ext-new");
    expect(link.connectionId).toBe(connectionId);
  });

  it("risponde 400 se 'existing' senza existingAccountId", async () => {
    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [{ externalAccountId: "ext-1", name: "Conto", type: "Conto corrente", mode: "existing" }],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(400);
  });

  it("risponde comunque 201 se il sync iniziale fallisce (l'account resta creato)", async () => {
    vi.mocked(syncAccountLink).mockRejectedValueOnce(new Error("GoCardless down"));

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [{ externalAccountId: "ext-fail", name: "Conto Corrente", type: "Conto corrente", mode: "new" }],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );

    expect(response.status).toBe(201);
    const { jobId } = await response.json();
    await Promise.all(afterTasks);
    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.accounts[0].phase).toBe("error");

    const [createdAccount] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(createdAccount.source).toBe("auto");
  });

  it("risponde 404 se existingAccountId appartiene a un altro utente", async () => {
    const otherUserId = `test-finalize-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherUserId,
        name: "Altro Utente",
        email: `test-finalize-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    const [otherAccount] = await db
      .insert(accounts)
      .values({ userId: otherUser.id, name: "Conto Altrui", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();

    try {
      const response = await POST(
        new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
          method: "POST",
          body: JSON.stringify({
            selections: [
              {
                externalAccountId: "ext-hijack",
                name: "Conto Corrente",
                type: "Conto corrente",
                mode: "existing",
                existingAccountId: otherAccount.id,
              },
            ],
          }),
        }),
        { params: Promise.resolve({ id: connectionId }) }
      );
      expect(response.status).toBe(404);
      expect(syncAccountLink).not.toHaveBeenCalled();

      const links = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.accountId, otherAccount.id));
      expect(links).toHaveLength(0);
      expect(await redisSyncJobStore.listJobs(userId)).toEqual([]);
    } finally {
      await db.delete(authUser).where(eq(authUser.id, otherUser.id));
    }
  });

  it("risponde 404 se la connessione non è dell'utente", async () => {
    mockedGetSession.mockResolvedValueOnce({ user: { id: "altro-utente" } } as never);
    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [{ externalAccountId: "ext-1", name: "Conto", type: "Conto corrente", mode: "new" }],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(404);
  });

  function postFinalize(selections: unknown[]) {
    return POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({ selections }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
  }

  it("sincronizza più conti nello stesso job", async () => {
    const response = await postFinalize([
      { externalAccountId: "ext-1", name: "Conto A", type: "Conto corrente", mode: "new" },
      { externalAccountId: "ext-2", name: "Conto B", type: "Conto corrente", mode: "new" },
    ]);
    const { jobId } = await response.json();
    await Promise.all(afterTasks);

    expect(syncAccountLink).toHaveBeenCalledTimes(2);
    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.accounts.map((a) => a.name)).toEqual(["Conto A", "Conto B"]);
    expect(job?.status).toBe("done");
  });

  it("risponde 503 senza creare conti se lo store dei job non risponde", async () => {
    vi.spyOn(redisSyncJobStore, "createJob").mockRejectedValueOnce(new Error("Redis giù"));
    const response = await postFinalize([
      { externalAccountId: "ext-1", name: "Conto A", type: "Conto corrente", mode: "new" },
    ]);
    expect(response.status).toBe(503);
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toEqual([]);
  });

  it("chiude il job se un conto 'existing' non ha nessun bank_account_links da aggiornare", async () => {
    const [orphanAccount] = await db
      .insert(accounts)
      .values({ userId, name: "Conto senza link", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();

    const response = await postFinalize([
      {
        externalAccountId: "ext-orphan",
        name: "Conto Corrente",
        type: "Conto corrente",
        mode: "existing",
        existingAccountId: orphanAccount.id,
      },
    ]);
    expect(response.status).toBe(404);

    const jobs = await redisSyncJobStore.listJobs(userId);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.dismissed)).toBe(true);
  });
});
