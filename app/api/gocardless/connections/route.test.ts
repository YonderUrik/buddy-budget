import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, createRequisition: vi.fn() };
});

import { auth } from "@/lib/auth";
import { createRequisition } from "@/lib/gocardless/client";
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET/POST /api/gocardless/connections", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-connections-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Connections",
        email: `test-connections-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(createRequisition).mockReset();
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await POST(new NextRequest("http://localhost/api/gocardless/connections", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("crea la connessione e restituisce il link di consenso", async () => {
    vi.mocked(createRequisition).mockResolvedValue({
      id: "req-1",
      status: "CR",
      link: "https://ob.gocardless.com/psd2/start/req-1",
      accounts: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/gocardless/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "INST_1", institutionName: "Banca Test", transactionTotalDays: 90 }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.link).toBe("https://ob.gocardless.com/psd2/start/req-1");

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.userId, userId));
    expect(connection.requisitionId).toBe("req-1");
  });

  it("marca la connessione 'error' se GoCardless fallisce", async () => {
    vi.mocked(createRequisition).mockRejectedValue(new Error("GoCardless down"));

    const response = await POST(
      new NextRequest("http://localhost/api/gocardless/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "INST_1", institutionName: "Banca Test", transactionTotalDays: 90 }),
      })
    );
    expect(response.status).toBe(502);

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.userId, userId));
    expect(connection.status).toBe("error");
  });

  it("GET restituisce lo stato delle connessioni per conto, incluso l'ultimo sync e l'eleggibilità", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "expired" })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1" });

    const response = await GET(new NextRequest("http://localhost/api/gocardless/connections"));
    const body = await response.json();
    expect(body).toEqual([
      {
        accountId: account.id,
        status: "expired",
        lastSyncedAt: null,
        eligible: true,
        nextEligibleAt: null,
        syncsRemainingToday: 4,
      },
    ]);
  });
});
