import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnectionAttempts, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/bank-data/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bank-data/gocardless/client")>();
  return { ...actual, createRequisition: vi.fn() };
});
vi.mock("@/lib/bank-data/enablebanking/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bank-data/enablebanking/client")>();
  return { ...actual, listAspsps: vi.fn(), startAuthorization: vi.fn() };
});

import { auth } from "@/lib/auth";
import { listAspsps, startAuthorization } from "@/lib/bank-data/enablebanking/client";
import { GoCardlessError, createRequisition } from "@/lib/bank-data/gocardless/client";
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET/POST /api/bank/connections", () => {
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
    vi.unstubAllEnvs();
    await db.delete(bankConnectionAttempts).where(eq(bankConnectionAttempts.userId, userId));
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await POST(new NextRequest("http://localhost/api/bank/connections", { method: "POST" }));
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
      new NextRequest("http://localhost/api/bank/connections", {
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
      new NextRequest("http://localhost/api/bank/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "INST_1", institutionName: "Banca Test", transactionTotalDays: 90 }),
      })
    );
    expect(response.status).toBe(502);

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.userId, userId));
    expect(connection.status).toBe("error");
  });

  it("GET restituisce lo stato delle connessioni per conto, incluso il nome della banca, l'ultimo sync e l'eleggibilità", async () => {
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

    const response = await GET(new NextRequest("http://localhost/api/bank/connections"));
    const body = await response.json();
    expect(body).toEqual([
      {
        accountId: account.id,
        connectionId: connection.id,
        institutionName: "Banca Test",
        status: "expired",
        consentExpiresAt: null,
        lastSyncedAt: null,
        eligible: true,
        nextEligibleAt: null,
        syncsRemainingToday: 4,
      },
    ]);
  });

  it("risponde 409 con il motivo quando l'utente ha già una banca collegata", async () => {
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "checking", source: "auto" }).returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_A", institutionName: "Banca A", requisitionId: "req-a", status: "linked" })
      .returning();
    await db.insert(bankAccountLinks).values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-a" });

    const response = await POST(
      new NextRequest("http://localhost/api/bank/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "INST_B", institutionName: "Banca B", transactionTotalDays: 90 }),
      })
    );
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("user_limit");
    expect(createRequisition).not.toHaveBeenCalled();
    expect(await db.select().from(bankConnections).where(eq(bankConnections.userId, userId))).toHaveLength(1);
  });

  it("traduce il 402 di GoCardless (posti del piano finiti) in posti esauriti", async () => {
    vi.mocked(createRequisition).mockRejectedValue(new GoCardlessError("CompanyRequisitionLimitReached", 402));
    const response = await POST(
      new NextRequest("http://localhost/api/bank/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "INST_1", institutionName: "Banca Test", transactionTotalDays: 90 }),
      })
    );
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("provider_limit");
  });

  it("con Enable Banking avvia l'autorizzazione, aspetta la sessione al ritorno e chiede il consenso più lungo della banca", async () => {
    vi.stubEnv("BANK_DATA_PROVIDER", "enablebanking");
    vi.mocked(listAspsps).mockResolvedValue([{ name: "Banca Test", country: "IT", maximum_consent_validity: 180 * 86_400 }]);
    vi.mocked(startAuthorization).mockResolvedValue({ url: "https://bank.example/auth", authorization_id: "auth-1" });

    const response = await POST(
      new NextRequest("http://localhost/api/bank/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "IT:Banca Test", institutionName: "Banca Test" }),
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).link).toBe("https://bank.example/auth");
    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.userId, userId));
    expect(connection).toMatchObject({ provider: "enablebanking", requisitionId: null, status: "pending" });
    const call = vi.mocked(startAuthorization).mock.calls[0][0];
    expect(call).toMatchObject({ aspsp: { name: "Banca Test", country: "IT" }, state: connection.id, redirectUrl: "http://localhost:3000/api/bank/callback" });
    const days = (call.validUntil.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(179.9);
    expect(createRequisition).not.toHaveBeenCalled();
    const [attempt] = await db.select().from(bankConnectionAttempts).where(eq(bankConnectionAttempts.userId, userId));
    expect(attempt.provider).toBe("enablebanking");
  });

  it("una banca collegata con GoCardless non blocca il passaggio a Enable Banking (limite di una banca a testa)", async () => {
    vi.stubEnv("BANK_DATA_PROVIDER", "enablebanking");
    vi.mocked(listAspsps).mockResolvedValue([]);
    vi.mocked(startAuthorization).mockResolvedValue({ url: "https://bank.example/auth", authorization_id: "auth-2" });
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "checking", source: "auto" }).returning();
    const [old] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_A", institutionName: "Banca A", requisitionId: "req-a", status: "linked" })
      .returning();
    await db.insert(bankAccountLinks).values({ connectionId: old.id, accountId: account.id, externalAccountId: "ext-a" });

    const response = await POST(
      new NextRequest("http://localhost/api/bank/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "IT:Banca A", institutionName: "Banca A" }),
      })
    );

    expect(response.status).toBe(200);
  });
});
