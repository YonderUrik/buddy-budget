import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/bank-data/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bank-data/gocardless/client")>();
  return { ...actual, getRequisition: vi.fn() };
});
vi.mock("@/lib/bank-data/enablebanking/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bank-data/enablebanking/client")>();
  return { ...actual, createSession: vi.fn() };
});

import { auth } from "@/lib/auth";
import { createSession } from "@/lib/bank-data/enablebanking/client";
import { getRequisition } from "@/lib/bank-data/gocardless/client";
import { GET } from "./route";

describe("GET /api/bank/callback", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-callback-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Callback",
        email: `test-callback-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    vi.mocked(getRequisition).mockReset();
    vi.mocked(createSession).mockReset();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    if (userId) await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("senza ref, redirige a /conti con errore", async () => {
    const response = await GET(new NextRequest("http://localhost/api/gocardless/callback"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/liquidita/conti?bankError=missing_ref");
  });

  it("con requisition linkata (status LN), redirige alla pagina di selezione e marca 'linked'", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-1", status: "pending" })
      .returning();
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-1", status: "LN", link: "", accounts: ["ext-1"] });

    const response = await GET(new NextRequest(`http://localhost/api/gocardless/callback?ref=${connection.id}`));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(`/conti/collega/${connection.id}`);

    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(updated.status).toBe("linked");
    // Il conto alla rovescia del consenso parte dal collegamento: 90 giorni da adesso.
    const days = (updated.consentExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThanOrEqual(90);
  });

  it("con requisition non completata, marca 'error' e redirige a /conti", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-2", status: "pending" })
      .returning();
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-2", status: "RJ", link: "", accounts: [] });

    const response = await GET(new NextRequest(`http://localhost/api/gocardless/callback?ref=${connection.id}`));
    expect(response.headers.get("location")).toContain("/liquidita/conti?bankError=consent_failed");

    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(updated.status).toBe("error");
  });

  it("non tocca la connessione di un altro utente", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-3", status: "pending" })
      .returning();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "altro-utente" } } as never);

    const response = await GET(new NextRequest(`http://localhost/api/gocardless/callback?ref=${connection.id}`));
    expect(response.headers.get("location")).toContain("bankError=not_found");
    expect(getRequisition).not.toHaveBeenCalled();
    const [unchanged] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(unchanged.status).toBe("pending");
  });

  it("Enable Banking: scambia il code con la sessione e salva id e scadenza che dà il fornitore", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, provider: "enablebanking", institutionId: "IT:Banca Test", institutionName: "Banca Test", status: "pending" })
      .returning();
    vi.mocked(createSession).mockResolvedValue({
      session_id: "11111111-2222-3333-4444-555555555555",
      accounts: [{ uid: "uid-1" }],
      access: { valid_until: "2027-04-13T19:00:00Z" },
    });

    const response = await GET(new NextRequest(`http://localhost/api/bank/callback?state=${connection.id}&code=abc`));

    expect(response.headers.get("location")).toContain(`/conti/collega/${connection.id}`);
    expect(createSession).toHaveBeenCalledWith("abc");
    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(updated).toMatchObject({ status: "linked", requisitionId: "11111111-2222-3333-4444-555555555555" });
    expect(updated.consentExpiresAt?.toISOString()).toBe("2027-04-13T19:00:00.000Z");
  });

  it("Enable Banking: consenso annullato in banca (error) segna l'errore senza creare sessioni", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, provider: "enablebanking", institutionId: "IT:Banca Test", institutionName: "Banca Test", status: "pending" })
      .returning();

    const response = await GET(new NextRequest(`http://localhost/api/bank/callback?state=${connection.id}&error=access_denied`));

    expect(response.headers.get("location")).toContain("bankError=consent_failed");
    expect(createSession).not.toHaveBeenCalled();
    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(updated.status).toBe("error");
  });
});
