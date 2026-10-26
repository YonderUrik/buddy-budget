import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, client } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { tradeRepublicConnections } from "@/lib/db/schema/trade-republic";
vi.mock("@/lib/sync-jobs/redis-store", () => ({ redisSyncJobStore: { updateAccount: vi.fn().mockResolvedValue(undefined), acquireAccountLock: vi.fn().mockResolvedValue(true), releaseAccountLock: vi.fn().mockResolvedValue(undefined), createJob: vi.fn().mockResolvedValue({ id: "synthetic-job" }) } }));
vi.mock("@/lib/categorization/auto-apply", () => ({ categorizeNewMovementsSafely: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./socket", () => ({ openTradeRepublicReader: vi.fn() }));
import { openTradeRepublicReader } from "./socket";
import { connectTradeRepublic, listTradeRepublicConnections } from "./connections";
import { prepareTradeRepublicSync, runTradeRepublicSync } from "./sync";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { openTradeRepublicSession } from "./session";
let userId: string;
let accountId: string;
const providerSession = () => ({ cookies: { JSESSIONID: "synthetic-token" }, deviceId: "synthetic-device" });
const providerEvent = (eventType = "CARD_TRANSACTION") => ({ id: "synthetic-event", timestamp: "2026-10-01T09:00:00Z", eventType, title: "Synthetic shop", amount: { value: -12, currency: "EUR" } });
beforeEach(async () => {
  vi.stubEnv("DATA_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
  userId = `test-tr-${crypto.randomUUID()}`;
  await db.insert(authUser).values({ id: userId, name: "Synthetic TR user", email: `${userId}@example.com`, currency: "EUR" });
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => url.endsWith("/auth/account") ? Response.json({ personId: "synthetic-person", cashAccount: { iban: "DE00000000000000000000" } }) : new Response(null, { status: 204 })));
  accountId = await connectTradeRepublic(userId, providerSession());
  vi.mocked(openTradeRepublicReader).mockImplementation(async () => ({ read: vi.fn().mockResolvedValueOnce([{ currencyId: "EUR", amount: "100" }]).mockResolvedValueOnce({ items: [providerEvent()] }), close: vi.fn() }));
});
afterEach(async () => { await db.delete(authUser).where(eq(authUser.id, userId)); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => { await client.end(); });
describe("direct Trade Republic cash sync persistence", () => {
  it("reconnects the same account, stores encrypted credentials, and excludes them from status", async () => {
    expect(await connectTradeRepublic(userId, providerSession())).toBe(accountId);
    const [stored] = await db.select().from(tradeRepublicConnections).where(eq(tradeRepublicConnections.userId, userId));
    expect(stored.session).toMatch(/^enc:v1:/); expect(stored.session).not.toContain("synthetic-token");
    expect(openTradeRepublicSession(stored.session).cookies.JSESSIONID).toBe("synthetic-token");
    expect(JSON.stringify(await listTradeRepublicConnections(userId))).not.toMatch(/synthetic-token|session|cookies/);
  });
  it("imports once and preserves notes and categories on repeat syncs", async () => {
    await runTradeRepublicSync(userId, accountId, "job-1");
    const [first] = await db.select().from(transactions).where(eq(transactions.accountId, accountId));
    expect(first.amount).toBe("-12.00");
    await db.update(transactions).set({ note: "Keep this note", categorySource: "utente" }).where(eq(transactions.id, first.id));
    await runTradeRepublicSync(userId, accountId, "job-2");
    const saved = await db.select().from(transactions).where(eq(transactions.accountId, accountId));
    expect(saved).toHaveLength(1); expect(saved[0].note).toBe("Keep this note"); expect(saved[0].categorySource).toBe("utente");
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)); expect(account.balance).toBe("100.00");
  });
  it("rejects a different user's account before acquiring a sync lock", async () => {
    vi.mocked(redisSyncJobStore.acquireAccountLock).mockClear();
    expect(await prepareTradeRepublicSync("other-user", accountId)).toEqual({ status: "not-found" });
    expect(redisSyncJobStore.acquireAccountLock).not.toHaveBeenCalled();
  });
  it("imports known movements and the balance, and reports an unknown event type instead of guessing it", async () => {
    vi.mocked(openTradeRepublicReader).mockResolvedValueOnce({ read: vi.fn().mockResolvedValueOnce([{ currencyId: "EUR", amount: "123" }]).mockResolvedValueOnce({ items: [providerEvent(), { ...providerEvent("NEW_EVENT"), id: "synthetic-new" }] }), close: vi.fn() });
    await runTradeRepublicSync(userId, accountId, "job-unknown");
    const saved = await db.select().from(transactions).where(eq(transactions.accountId, accountId));
    expect(saved.map(row => row.externalId)).toEqual(["trade-republic:synthetic-event"]);
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)); expect(account.balance).toBe("123.00");
    expect(redisSyncJobStore.updateAccount).toHaveBeenCalledWith(userId, "job-unknown", accountId, expect.objectContaining({ phase: "done", inserted: 1, unrecognized: 1 }));
  });
  it("does not partially update cash or balance when an item is malformed", async () => {
    const foreign = { ...providerEvent(), id: "synthetic-usd", amount: { value: -5, currency: "USD" } };
    vi.mocked(openTradeRepublicReader).mockResolvedValueOnce({ read: vi.fn().mockResolvedValueOnce([{ currencyId: "EUR", amount: "123" }]).mockResolvedValueOnce({ items: [providerEvent(), foreign] }), close: vi.fn() });
    await runTradeRepublicSync(userId, accountId, "job-error");
    expect(await db.select().from(transactions).where(eq(transactions.accountId, accountId))).toHaveLength(0);
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)); expect(account.balance).toBe("0.00");
    expect(redisSyncJobStore.updateAccount).toHaveBeenCalledWith(userId, "job-error", accountId, { phase: "error" });
  });
  it("clears expired credentials and allows deletion of the cash account to remove the connection", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));
    await runTradeRepublicSync(userId, accountId, "job-expired");
    const [expired] = await db.select().from(tradeRepublicConnections).where(eq(tradeRepublicConnections.accountId, accountId));
    expect(expired.status).toBe("expired"); expect(expired.session).toBe("");
    await db.delete(accounts).where(eq(accounts.id, accountId));
    expect(await listTradeRepublicConnections(userId)).toEqual([]);
  });
});
