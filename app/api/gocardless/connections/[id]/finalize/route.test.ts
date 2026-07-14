import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/gocardless/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/sync")>();
  return { ...actual, syncAccountLink: vi.fn().mockResolvedValue(undefined) };
});

import { auth } from "@/lib/auth";
import { syncAccountLink } from "@/lib/gocardless/sync";
import { POST } from "./route";

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
    expect(syncAccountLink).toHaveBeenCalledTimes(1);

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
});
