import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, getRequisition: vi.fn(), getAccountDetails: vi.fn() };
});

import { auth } from "@/lib/auth";
import { GoCardlessError, getAccountDetails, getRequisition } from "@/lib/gocardless/client";
import { bankConnectionCompletedSchema } from "@/lib/views";
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function complete(id: string) {
  return POST(new NextRequest(`http://localhost/api/gocardless/connections/${id}/complete`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("POST /api/gocardless/connections/[id]/complete", () => {
  let userId: string;
  let connectionId: string;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-complete-${crypto.randomUUID()}`, name: "Test Complete", email: `test-complete-${Date.now()}@example.com`, emailVerified: false, currency: "EUR" })
      .returning();
    userId = user.id;
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "SANDBOXFINANCE_SFIN0000", institutionName: "Sandbox Finance", requisitionId: "req-native", status: "pending" })
      .returning();
    connectionId = connection.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(getRequisition).mockReset();
    vi.mocked(getAccountDetails).mockReset();
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("401 without a session", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await complete(connectionId)).status).toBe(401);
  });

  it("linked consent: marks the connection linked and answers the accounts to select", async () => {
    const [existing] = await db.insert(accounts).values({ userId, name: "Vecchio conto", type: "Conto corrente", source: "auto" }).returning();
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-native", status: "LN", link: "", accounts: ["ext-1", "ext-2"] });
    vi.mocked(getAccountDetails).mockImplementation(async (id) => (id === "ext-1" ? { iban: "IT60X0542811101000000123456", name: "Conto principale" } : { name: "Carta" }));

    const response = await complete(connectionId);
    expect(response.status).toBe(200);
    const body = bankConnectionCompletedSchema.parse(await response.json());
    expect(body).toMatchObject({
      connectionId,
      status: "linked",
      institutionId: "SANDBOXFINANCE_SFIN0000",
      institutionName: "Sandbox Finance",
      externalAccounts: [
        { externalAccountId: "ext-1", details: { iban: "IT60X0542811101000000123456", name: "Conto principale" } },
        { externalAccountId: "ext-2", details: { name: "Carta" } },
      ],
      existingAutoAccounts: [{ id: existing.id, name: "Vecchio conto" }],
    });
    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connectionId));
    expect(updated.status).toBe("linked");
    const days = (updated.consentExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(body.consentExpiresAt).toBe(updated.consentExpiresAt!.toISOString());

    // Idempotent: a retry answers the same accounts and keeps the consent expiry set by the first call.
    const again = bankConnectionCompletedSchema.parse(await (await complete(connectionId)).json());
    expect(again.consentExpiresAt).toBe(body.consentExpiresAt);
  });

  it("consent still in progress: 409 bank_consent_pending, nothing changes", async () => {
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-native", status: "UA", link: "", accounts: [] });
    const response = await complete(connectionId);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "bank_consent_pending", requisitionStatus: "UA" });
    const [unchanged] = await db.select().from(bankConnections).where(eq(bankConnections.id, connectionId));
    expect(unchanged.status).toBe("pending");
  });

  it("consent rejected: 422 bank_consent_failed and the connection is marked error", async () => {
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-native", status: "RJ", link: "", accounts: [] });
    const response = await complete(connectionId);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "bank_consent_failed", requisitionStatus: "RJ" });
    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connectionId));
    expect(updated.status).toBe("error");
  });

  it("never downgrades an already linked connection", async () => {
    await db.update(bankConnections).set({ status: "linked" }).where(eq(bankConnections.id, connectionId));
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-native", status: "EX", link: "", accounts: [] });
    expect((await complete(connectionId)).status).toBe(422);
    const [unchanged] = await db.select().from(bankConnections).where(eq(bankConnections.id, connectionId));
    expect(unchanged.status).toBe("linked");
  });

  it("404 bank_connection_not_found for another user's connection, a malformed id or no requisition", async () => {
    mockedGetSession.mockResolvedValueOnce({ user: { id: "someone-else" } } as never);
    const foreign = await complete(connectionId);
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({ code: "bank_connection_not_found" });
    expect((await complete("not-a-uuid")).status).toBe(404);
    await db.update(bankConnections).set({ requisitionId: null }).where(eq(bankConnections.id, connectionId));
    expect((await complete(connectionId)).status).toBe(404);
    expect(getRequisition).not.toHaveBeenCalled();
  });

  it("502 bank_unavailable when GoCardless cannot be reached", async () => {
    vi.mocked(getRequisition).mockRejectedValue(new GoCardlessError("down", 503));
    const response = await complete(connectionId);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "bank_unavailable" });
  });
});
