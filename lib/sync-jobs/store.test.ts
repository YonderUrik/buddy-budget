import { beforeEach, describe, expect, it } from "vitest";
import { queuedAccount } from "./types";
import { createMemorySyncJobKv, createSyncJobStore, type SyncJobStore } from "./store";

describe("createSyncJobStore", () => {
  let store: SyncJobStore;
  let now: Date;

  beforeEach(() => {
    now = new Date("2026-09-22T10:00:00.000Z");
    store = createSyncJobStore(createMemorySyncJobKv(), () => now);
  });

  it("crea un job running con i conti in coda e lo elenca", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "Conto A")] });
    expect(job.status).toBe("running");
    expect(job.startedAt).toBe("2026-09-22T10:00:00.000Z");

    const jobs = await store.listJobs("u1");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].accounts[0]).toMatchObject({ accountId: "a", name: "Conto A", phase: "queued" });
  });

  it("aggiorna un conto ignorando i campi undefined e avanza l'heartbeat", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "Conto A")] });
    now = new Date("2026-09-22T10:00:05.000Z");
    await store.updateAccount("u1", job.id, "a", { phase: "saving", total: 100, processed: 50 });
    now = new Date("2026-09-22T10:00:06.000Z");
    await store.updateAccount("u1", job.id, "a", { phase: "saving", total: undefined, processed: 100 });

    const [stored] = await store.listJobs("u1");
    expect(stored.accounts[0]).toMatchObject({ phase: "saving", total: 100, processed: 100 });
    expect(stored.updatedAt).toBe("2026-09-22T10:00:06.000Z");
  });

  it("non perde aggiornamenti concorrenti di due conti dello stesso job", async () => {
    const job = await store.createJob({
      userId: "u1",
      kind: "initial-import",
      accounts: [queuedAccount("a", "A"), queuedAccount("b", "B")],
    });
    await Promise.all([
      store.updateAccount("u1", job.id, "a", { phase: "done", inserted: 3 }),
      store.updateAccount("u1", job.id, "b", { phase: "done", inserted: 7 }),
    ]);
    const [stored] = await store.listJobs("u1");
    expect(stored.accounts.map((a) => a.inserted)).toEqual([3, 7]);
    expect(stored.status).toBe("done");
  });

  it("setAccounts popola un job creato vuoto", async () => {
    const job = await store.createJob({ userId: "u1", kind: "initial-import" });
    expect(job.accounts).toEqual([]);
    await store.setAccounts("u1", job.id, [queuedAccount("a", "A")]);
    const [stored] = await store.listJobs("u1");
    expect(stored.accounts.map((a) => a.accountId)).toEqual(["a"]);
  });

  it("isola i job tra utenti, anche per dismiss", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "A")] });
    expect(await store.listJobs("u2")).toEqual([]);
    expect(await store.dismissJob("u2", job.id)).toBe(false);
    expect(await store.dismissJob("u1", job.id)).toBe(true);
    expect((await store.listJobs("u1"))[0].dismissed).toBe(true);
  });

  it("ordina i job dal più recente", async () => {
    const first = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [] });
    now = new Date("2026-09-22T10:05:00.000Z");
    const second = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [] });
    expect((await store.listJobs("u1")).map((j) => j.id)).toEqual([second.id, first.id]);
  });

  it("il lock per conto è esclusivo finché non viene rilasciato", async () => {
    expect(await store.acquireAccountLock("a")).toBe(true);
    expect(await store.acquireAccountLock("a")).toBe(false);
    expect(await store.acquireAccountLock("b")).toBe(true);
    await store.releaseAccountLock("a");
    expect(await store.acquireAccountLock("a")).toBe(true);
  });
});
