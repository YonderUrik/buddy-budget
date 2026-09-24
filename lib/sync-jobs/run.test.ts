import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gocardless/sync", () => ({ syncAccountLink: vi.fn() }));

import { syncAccountLink, type SyncableLink } from "@/lib/gocardless/sync";
import type { RateLimitStore } from "@/lib/gocardless/rate-limit";
import { queuedAccount } from "./types";
import { createMemorySyncJobKv, createSyncJobStore, type SyncJobStore } from "./store";
import { progressToPatch, resultToPatch, runSyncJob } from "./run";

const rateLimitStore: RateLimitStore = { get: async () => null, set: async () => {} };

function link(accountId: string): SyncableLink {
  return { linkId: `l-${accountId}`, connectionId: "c", accountId, externalAccountId: `ext-${accountId}`, userId: "u1" };
}

describe("progressToPatch / resultToPatch", () => {
  it("mappa avanzamento ed esiti sulle fasi del job", () => {
    expect(progressToPatch({ phase: "saving", total: 10, processed: 5 })).toEqual({ phase: "saving", total: 10, processed: 5 });
    expect(
      resultToPatch({ status: "synced", newTransactionsCount: 4, categorizedCount: 3, uncategorizedCount: 1, balanceUpdated: true })
    ).toEqual({ phase: "done", inserted: 4, categorized: 3, uncategorized: 1 });
    expect(resultToPatch({ status: "gocardless-limited" })).toEqual({ phase: "limited" });
    expect(resultToPatch({ status: "expired" })).toEqual({ phase: "expired" });
  });
});

describe("runSyncJob", () => {
  let store: SyncJobStore;

  beforeEach(() => {
    store = createSyncJobStore(createMemorySyncJobKv());
    vi.mocked(syncAccountLink).mockReset();
  });

  it("sincronizza i conti in parallelo, isola gli errori e rilascia sempre i lock", async () => {
    const job = await store.createJob({
      userId: "u1",
      kind: "initial-import",
      accounts: [queuedAccount("a", "A"), queuedAccount("b", "B")],
    });
    await store.acquireAccountLock("a");
    await store.acquireAccountLock("b");

    let markBStarted: () => void = () => {};
    const bStarted = new Promise<void>((resolve) => (markBStarted = resolve));
    vi.mocked(syncAccountLink).mockImplementation(async (l, _store, onProgress) => {
      if (l.accountId === "a") {
        // "a" finisce solo dopo che "b" è partito: in esecuzione sequenziale questo test andrebbe in timeout.
        await bStarted;
        await onProgress?.({ phase: "saving", total: 2, processed: 2, inserted: 2, categorized: 2, uncategorized: 0 });
        return { status: "synced", newTransactionsCount: 2, categorizedCount: 2, uncategorizedCount: 0, balanceUpdated: true };
      }
      markBStarted();
      throw new Error("GoCardless 500");
    });

    await runSyncJob(job, [link("a"), link("b")], { store, rateLimitStore });

    const [stored] = await store.listJobs("u1");
    expect(stored.accounts.map((a) => [a.accountId, a.phase])).toEqual([
      ["a", "done"],
      ["b", "error"],
    ]);
    expect(stored.accounts[0]).toMatchObject({ total: 2, processed: 2, inserted: 2 });
    expect(stored.status).toBe("done");
    expect(await store.acquireAccountLock("a")).toBe(true);
    expect(await store.acquireAccountLock("b")).toBe(true);
  });

  it("non lancia se lo store fallisce durante l'aggiornamento", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "A")] });
    vi.spyOn(store, "updateAccount").mockRejectedValue(new Error("Redis giù"));
    vi.mocked(syncAccountLink).mockResolvedValue({ status: "expired" });

    await expect(runSyncJob(job, [link("a")], { store, rateLimitStore })).resolves.toBeUndefined();
  });

  it("mantiene vivo l'heartbeat mentre syncAccountLink è in attesa, e si ferma alla fine", async () => {
    vi.useFakeTimers();
    try {
      const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "A")] });
      const updateSpy = vi.spyOn(store, "updateAccount");

      let resolveSync: (value: { status: "expired" }) => void = () => {};
      const syncPromise = new Promise<{ status: "expired" }>((resolve) => (resolveSync = resolve));
      vi.mocked(syncAccountLink).mockReturnValue(syncPromise);

      const runPromise = runSyncJob(job, [link("a")], { store, rateLimitStore });

      // 3 tick da 15s: il keep-alive deve aver scritto almeno 3 patch vuote mentre la chiamata pende.
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(15_000);
      }
      const heartbeatCallsWhilePending = updateSpy.mock.calls.filter(
        ([, , , patch]) => Object.keys(patch).length === 0
      ).length;
      expect(heartbeatCallsWhilePending).toBeGreaterThanOrEqual(3);

      resolveSync({ status: "expired" });
      await runPromise;

      const callsAtEnd = updateSpy.mock.calls.length;
      await vi.advanceTimersByTimeAsync(45_000);
      expect(updateSpy.mock.calls.length).toBe(callsAtEnd);
    } finally {
      vi.useRealTimers();
    }
  });
});
