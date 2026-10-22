import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { saveAssumptions } from "./data";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import { analyticsInputsFingerprint, loadAnalyticsDigest, type AnalyticsDigestStore } from "./digest";
import { loadAnalyticsSnapshot } from "./snapshot";

vi.mock("./snapshot", async (original) => {
  const actual = await original<typeof import("./snapshot")>();
  return { ...actual, loadAnalyticsSnapshot: vi.fn(actual.loadAnalyticsSnapshot) };
});

const NOW = new Date(2026, 9, 22, 12);

function memoryStore(): AnalyticsDigestStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: async (userId) => values.get(userId) ?? null,
    set: async (userId, value) => void values.set(userId, value),
  };
}

describe("analytics digest", () => {
  let userId: string;
  let categoryId: string;

  beforeEach(async () => {
    vi.mocked(loadAnalyticsSnapshot).mockClear();
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-digest-${crypto.randomUUID()}`, name: "Test Digest", email: `test-digest-${crypto.randomUUID()}@example.com`, emailVerified: false, currency: "EUR" })
      .returning();
    userId = user.id;
    const [category] = await db.insert(categories).values({ userId, name: "Varie", type: "voluta" }).returning();
    categoryId = category.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("keeps the same fingerprint while nothing changes", async () => {
    expect(await analyticsInputsFingerprint(userId, NOW)).toBe(await analyticsInputsFingerprint(userId, NOW));
  });

  it("changes the fingerprint with transactions, categories, assumptions and the day", async () => {
    const seen = new Set([await analyticsInputsFingerprint(userId, NOW)]);
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "1000.00", source: "manuale" }).returning();
    seen.add(await analyticsInputsFingerprint(userId, NOW));
    await db.insert(transactions).values({ userId, accountId: account.id, categoryId, description: "Spesa", amount: "-20.00", date: "2026-10-20", source: "manuale" });
    seen.add(await analyticsInputsFingerprint(userId, NOW));
    await db.update(categories).set({ type: "dovuta" }).where(eq(categories.id, categoryId));
    seen.add(await analyticsInputsFingerprint(userId, NOW));
    await saveAssumptions(userId, { ...DEFAULT_ASSUMPTIONS, withdrawalRate: DEFAULT_ASSUMPTIONS.withdrawalRate + 0.005 });
    seen.add(await analyticsInputsFingerprint(userId, NOW));
    seen.add(await analyticsInputsFingerprint(userId, new Date(2026, 9, 23, 12)));
    expect(seen.size).toBe(6);
  });

  it("computes once, then serves the cached digest until the data changes", async () => {
    const store = memoryStore();
    const first = await loadAnalyticsDigest(userId, NOW, store);
    expect(loadAnalyticsSnapshot).toHaveBeenCalledTimes(1);
    expect(store.values.has(userId)).toBe(true);

    expect(await loadAnalyticsDigest(userId, NOW, store)).toEqual(first);
    expect(loadAnalyticsSnapshot).toHaveBeenCalledTimes(1);

    await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "500.00", source: "manuale" });
    const after = await loadAnalyticsDigest(userId, NOW, store);
    expect(loadAnalyticsSnapshot).toHaveBeenCalledTimes(2);
    expect(after.accounts.map((a) => a.balance)).toEqual([500]);
  });

  it("shares one computation between parallel calls", async () => {
    const store = memoryStore();
    const [a, b] = await Promise.all([loadAnalyticsDigest(userId, NOW, store), loadAnalyticsDigest(userId, NOW, store)]);
    expect(a).toBe(b);
    expect(loadAnalyticsSnapshot).toHaveBeenCalledTimes(1);
  });

  it("still answers when the cache cannot be read or written", async () => {
    const broken: AnalyticsDigestStore = {
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => {
        throw new Error("redis down");
      },
    };
    const digest = await loadAnalyticsDigest(userId, NOW, broken);
    expect(digest.currency).toBe("EUR");
    expect(digest.sidebarFire.currency).toBe("EUR");
  });
});
