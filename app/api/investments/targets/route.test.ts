import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, investmentPortfolios, investmentTargets } from "@/lib/db/schema/investments";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { PUT } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function put(body: unknown) {
  return PUT(new NextRequest("http://localhost/api/investments/targets", { method: "PUT", body: JSON.stringify(body) }));
}

describe("PUT /api/investments/targets", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;

  async function createUser() {
    const id = `test-targets-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(id);
    return id;
  }

  async function createInstrument(ownerId: string) {
    const [row] = await db
      .insert(instruments)
      .values({ name: "Manuale", type: "etf", currency: "EUR", priceMode: "manuale", createdByUserId: ownerId })
      .returning();
    instrumentIds.push(row.id);
    return row.id;
  }

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(investmentPortfolios).where(inArray(investmentPortfolios.userId, userIds));
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  it("401 senza sessione", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    expect((await put({ targets: [] })).status).toBe(401);
  });

  it("salva l'obiettivo e lo sostituisce per intero", async () => {
    const a = await createInstrument(userId);
    const b = await createInstrument(userId);
    const first = await put({ targets: [{ instrumentId: a, weight: 0.7 }, { instrumentId: b, weight: 0.3 }] });
    expect(first.status).toBe(200);
    const second = await put({ targets: [{ instrumentId: b, weight: 1 }] });
    expect((await second.json()).targets).toEqual([{ instrumentId: b, weight: "1.000000" }]);
    const [portfolio] = await db.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId));
    const rows = await db.select().from(investmentTargets).where(eq(investmentTargets.portfolioId, portfolio.id));
    expect(rows.map((r) => r.instrumentId)).toEqual([b]);
  });

  it("una lista vuota toglie l'obiettivo", async () => {
    const a = await createInstrument(userId);
    await put({ targets: [{ instrumentId: a, weight: 1 }] });
    expect((await (await put({ targets: [] })).json()).targets).toEqual([]);
  });

  it("400 se i pesi non sommano a 100% o uno strumento è ripetuto", async () => {
    const a = await createInstrument(userId);
    const b = await createInstrument(userId);
    expect((await put({ targets: [{ instrumentId: a, weight: 0.5 }, { instrumentId: b, weight: 0.4 }] })).status).toBe(400);
    expect((await put({ targets: [{ instrumentId: a, weight: 0.5 }, { instrumentId: a, weight: 0.5 }] })).status).toBe(400);
  });

  it("404 con lo strumento manuale di un altro utente", async () => {
    const other = await createUser();
    const foreign = await createInstrument(other);
    expect((await put({ targets: [{ instrumentId: foreign, weight: 1 }] })).status).toBe(404);
  });
});
