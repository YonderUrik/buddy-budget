import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, getRequisition: vi.fn() };
});

import { getRequisition } from "@/lib/gocardless/client";
import { GET } from "./route";

describe("GET /api/gocardless/callback", () => {
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
    expect(response.headers.get("location")).toContain("/conti?bankError=missing_ref");
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
  });

  it("con requisition non completata, marca 'error' e redirige a /conti", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-2", status: "pending" })
      .returning();
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-2", status: "RJ", link: "", accounts: [] });

    const response = await GET(new NextRequest(`http://localhost/api/gocardless/callback?ref=${connection.id}`));
    expect(response.headers.get("location")).toContain("/conti?bankError=consent_failed");

    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(updated.status).toBe("error");
  });
});
