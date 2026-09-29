import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, userInstrumentBreakdowns } from "@/lib/db/schema/investments";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { PUT } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function put(instrumentId: string, body: unknown) {
  return PUT(new NextRequest(`http://localhost/api/instruments/${instrumentId}/breakdown`, { method: "PUT", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: instrumentId }),
  });
}

describe("PUT /api/instruments/[id]/breakdown", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;

  async function createUser() {
    const id = `test-breakdown-${crypto.randomUUID()}`;
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

  async function saved(instrumentId: string) {
    const [row] = await db
      .select()
      .from(userInstrumentBreakdowns)
      .where(and(eq(userInstrumentBreakdowns.userId, userId), eq(userInstrumentBreakdowns.instrumentId, instrumentId)));
    return row ?? null;
  }

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  it("salva e aggiorna la correzione di una dimensione, entrambe null la cancellano", async () => {
    const id = await createInstrument(userId);
    expect((await put(id, { sectors: null, areas: { europa: 0.6, italia: 0.4 } })).status).toBe(200);
    expect(await saved(id)).toMatchObject({ sectors: null, areas: { europa: 0.6, italia: 0.4 } });
    await put(id, { sectors: { tecnologia: 1 }, areas: null });
    expect(await saved(id)).toMatchObject({ sectors: { tecnologia: 1 }, areas: null });
    await put(id, { sectors: null, areas: null });
    expect(await saved(id)).toBeNull();
  });

  it("400 su chiavi sconosciute, somma oltre 100% o ripartizione vuota", async () => {
    const id = await createInstrument(userId);
    expect((await put(id, { sectors: null, areas: { marte: 1 } })).status).toBe(400);
    expect((await put(id, { sectors: null, areas: { europa: 0.7, italia: 0.4 } })).status).toBe(400);
    expect((await put(id, { sectors: {}, areas: null })).status).toBe(400);
    expect((await put(id, { sectors: null, areas: { non_classificato: 1 } })).status).toBe(400);
  });

  it("404 con lo strumento manuale di un altro utente", async () => {
    const other = await createUser();
    const foreign = await createInstrument(other);
    expect((await put(foreign, { sectors: null, areas: { europa: 1 } })).status).toBe(404);
  });
});
