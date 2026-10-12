import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";
import { POST as markSeen } from "./seen/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("«Fatte da sole»: GET /api/transactions/auto-categorized e POST …/seen", () => {
  let userId: string;
  let accountId: string;
  let svagoId: string;

  async function insertAuto(description: string, categorizedAt: Date, source: "regola" | "assistente" | "utente" = "assistente") {
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: svagoId,
      description,
      amount: "-9.99",
      date: "2026-10-01",
      source: "manuale",
      categorySource: source,
      categoryConfidence: source === "assistente" ? "0.9600" : null,
      categorizedAt,
    });
  }

  async function list() {
    return (await GET(new NextRequest("http://localhost/api/transactions/auto-categorized"))).json();
  }

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-auto-categorized-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-auto-categorized-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
        autoCategorizedSeenAt: new Date("2026-10-01T00:00:00Z"),
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Contanti", balance: "0.00" }).returning();
    accountId = account.id;
    const [svago] = await db.insert(categories).values({ userId, name: "Svago", type: "voluta" }).returning();
    svagoId = svago.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await GET(new NextRequest("http://localhost/api/transactions/auto-categorized"))).status).toBe(401);
  });

  it("mostra solo le categorie automatiche arrivate dopo l'ultimo controllo, raggruppate per esercente", async () => {
    await insertAuto("NETFLIX.COM", new Date("2026-10-05T08:00:00Z"));
    await insertAuto("NETFLIX.COM", new Date("2026-10-06T08:00:00Z"));
    await insertAuto("SPOTIFY AB", new Date("2026-09-20T08:00:00Z"));
    await insertAuto("BAR DA MARIO", new Date("2026-10-06T08:00:00Z"), "utente");

    const body = await list();

    expect(body.total).toBe(2);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].transactionIds).toHaveLength(2);
    expect(body.groups[0].source).toBe("assistente");
    expect(body.groups[0].confidence).toBeCloseTo(0.96);
  });

  it("«Va tutto bene» toglie quelle viste ma non quelle arrivate dopo", async () => {
    await insertAuto("NETFLIX.COM", new Date("2026-10-05T08:00:00Z"));
    const { groups } = await list();

    await insertAuto("SPOTIFY AB", new Date("2026-10-07T08:00:00Z"), "regola");
    const response = await markSeen(
      new NextRequest("http://localhost/api/transactions/auto-categorized/seen", {
        method: "POST",
        body: JSON.stringify({ until: groups[0].lastCategorizedAt, count: 1 }),
      })
    );
    expect(response.status).toBe(200);

    const after = await list();
    expect(after.total).toBe(1);
    expect(after.groups[0].source).toBe("regola");
  });

  it("rifiuta una data non valida", async () => {
    const response = await markSeen(
      new NextRequest("http://localhost/api/transactions/auto-categorized/seen", { method: "POST", body: JSON.stringify({ until: "ieri" }) })
    );
    expect(response.status).toBe(400);
  });
});
