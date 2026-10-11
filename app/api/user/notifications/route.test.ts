import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { GET, PATCH } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const userId = `test-notif-route-${crypto.randomUUID()}`;

function patch(body: unknown) {
  return PATCH(new NextRequest("http://localhost/api/user/notifications", { method: "PATCH", body: JSON.stringify(body) }));
}

beforeEach(async () => {
  await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, onboardingCompleted: true }).onConflictDoNothing();
  mockedGetSession.mockReset().mockResolvedValue({ user: { id: userId }, session: { createdAt: new Date() } } as never);
});

afterAll(async () => {
  await db.delete(authUser).where(eq(authUser.id, userId));
  await client.end();
});

describe("/api/user/notifications", () => {
  it("senza sessione risponde 401", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    expect((await GET(new NextRequest("http://localhost/api/user/notifications"))).status).toBe(401);
    expect((await patch({ digestEnabled: true })).status).toBe(401);
  });

  it("all'inizio è tutto spento", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/notifications"));
    expect(await response.json()).toEqual({ digestEnabled: false, digestFrequency: "mensile", budgetAlertsEnabled: false, deadlineAlertsEnabled: false });
  });

  it("attiva, cambia frequenza e poi spegne", async () => {
    expect(await (await patch({ digestEnabled: true, digestFrequency: "settimanale" })).json()).toMatchObject({ digestEnabled: true, digestFrequency: "settimanale" });
    expect(await (await patch({ digestEnabled: false })).json()).toMatchObject({ digestEnabled: false, digestFrequency: "settimanale" });
  });

  it("rifiuta corpo vuoto, campi sconosciuti e frequenze non ammesse", async () => {
    expect((await patch({})).status).toBe(400);
    expect((await patch({ digestFrequency: "giornaliera" })).status).toBe(400);
    expect((await patch({ digestEnabled: true, email: "x@y.z" })).status).toBe(400);
    expect((await patch(null)).status).toBe(400);
  });
});
