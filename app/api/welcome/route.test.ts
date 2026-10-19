import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { instruments, userPriceAlerts } from "@/lib/db/schema/investments";
import { transactions } from "@/lib/db/schema/transactions";
import type { WelcomeResponse } from "@/lib/welcome";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET, PATCH } from "./route";
import { POST } from "../visits/route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const HOUR = 60 * 60 * 1000;

function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
}

async function welcome(): Promise<WelcomeResponse> {
  const response = await GET(request("/api/welcome"));
  expect(response.status).toBe(200);
  return response.json();
}

describe("GET/PATCH /api/welcome and POST /api/visits", () => {
  let userId: string;
  let accountId: string;
  let fallbackId: string;
  let foodId: string;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-welcome-${crypto.randomUUID()}`, name: "Test", email: `test-welcome-${crypto.randomUUID()}@example.com` })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "0.00" }).returning();
    accountId = account.id;
    const [fallback] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true })
      .returning();
    fallbackId = fallback.id;
    const [food] = await db.insert(categories).values({ userId, name: "Spesa", type: "dovuta", icon: "cart", color: "green" }).returning();
    foodId = food.id;
  });

  afterAll(async () => {
    await client.end();
  });

  /** The user was last here `hoursAgo` hours ago (a finished visit). */
  async function lastSeen(hoursAgo: number) {
    const seen = new Date(Date.now() - hoursAgo * HOUR);
    await db.update(authUser).set({ appSeenAt: seen, visitStartedAt: new Date(seen.getTime() - HOUR) }).where(eq(authUser.id, userId));
    return seen;
  }

  async function add(values: { categoryId: string; amount: string; createdAt: Date; excludedAmount?: string }) {
    await db.insert(transactions).values({ userId, accountId, description: "Test", date: "2026-10-18", source: "auto", ...values });
  }

  it("answers 401 without a session", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    expect((await GET(request("/api/welcome"))).status).toBe(401);
    expect((await POST(request("/api/visits", "POST"))).status).toBe(401);
  });

  it("shows nothing on the first visit", async () => {
    await add({ categoryId: fallbackId, amount: "-10.00", createdAt: new Date(Date.now() - 2 * HOUR) });
    expect((await welcome()).summary).toBeNull();
    const [row] = await db.select().from(authUser).where(eq(authUser.id, userId));
    expect(row.visitStartedAt).not.toBeNull();
    expect(row.visitSinceAt).toBeNull();
  });

  it("sums up what arrived while away and what waits", async () => {
    const seen = await lastSeen(20);
    // Before the previous visit ended: not news.
    await add({ categoryId: foodId, amount: "-99.00", createdAt: new Date(seen.getTime() - HOUR) });
    await add({ categoryId: foodId, amount: "-30.00", createdAt: new Date(seen.getTime() + HOUR), excludedAmount: "-10.00" });
    await add({ categoryId: fallbackId, amount: "1200.00", createdAt: new Date(seen.getTime() + 2 * HOUR) });
    const [instrument] = await db.insert(instruments).values({ name: "Enel", type: "azione", currency: "EUR" }).returning();
    await db.insert(userPriceAlerts).values({
      userId,
      instrumentId: instrument.id,
      direction: "sopra",
      targetPrice: "7",
      status: "scattato",
      triggeredAt: new Date(seen.getTime() + 3 * HOUR),
      triggeredPrice: "7.2",
    });

    const { summary } = await welcome();
    expect(summary?.since).toBe(seen.toISOString());
    expect(summary?.happened).toEqual([
      { kind: "movements", count: 2, income: 1200, expenses: 20 },
      { kind: "price_alerts", count: 1, first: { name: "Enel", direction: "sopra", price: 7.2, currency: "EUR" } },
    ]);
    expect(summary?.waiting).toEqual([{ kind: "to_decide", count: 1 }]);

    // Reading again in the same visit gives the same summary (the window does not move).
    expect((await welcome()).summary?.since).toBe(seen.toISOString());
    await db.delete(instruments).where(eq(instruments.id, instrument.id));
  });

  it("is not said again in the same visit once shown", async () => {
    await lastSeen(5);
    await add({ categoryId: foodId, amount: "-5.00", createdAt: new Date(Date.now() - HOUR) });
    expect((await welcome()).summary).not.toBeNull();
    expect((await PATCH(request("/api/welcome", "PATCH", { shown: true }))).status).toBe(204);
    expect((await welcome()).summary).toBeNull();
    expect((await PATCH(request("/api/welcome", "PATCH", { shown: false }))).status).toBe(400);
  });

  it("starts a new visit from the heartbeat after a pause", async () => {
    await lastSeen(2);
    expect(await (await POST(request("/api/visits", "POST"))).json()).toEqual({ newVisit: true });
    expect(await (await POST(request("/api/visits", "POST"))).json()).toEqual({ newVisit: false });
  });

  it("never records visits for the shared demo account", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "public-demo-it-it" } } as never);
    expect((await welcome()).summary).toBeNull();
    expect(await (await POST(request("/api/visits", "POST"))).json()).toEqual({ newVisit: false });
  });
});
