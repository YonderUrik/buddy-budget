import { describe, expect, it } from "vitest";
import { deriveJobStatus, queuedAccount, type SyncJob, type SyncJobAccount } from "./types";
import { hasFinishedSince, isAccountSyncing, overallProgress, runningJobIds, toJobView } from "./view";

function account(overrides: Partial<SyncJobAccount> = {}): SyncJobAccount {
  return { ...queuedAccount("acc-1", "Conto"), ...overrides };
}

function job(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: "job-1",
    userId: "user-1",
    kind: "manual-sync",
    status: "running",
    dismissed: false,
    startedAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
    accounts: [account()],
    ...overrides,
  };
}

describe("deriveJobStatus", () => {
  it("è running senza conti o con almeno un conto non finale", () => {
    expect(deriveJobStatus([])).toBe("running");
    expect(deriveJobStatus([account({ phase: "done" }), account({ phase: "saving" })])).toBe("running");
  });

  it("è failed solo se tutti i conti sono in errore, altrimenti done", () => {
    expect(deriveJobStatus([account({ phase: "error" }), account({ phase: "error" })])).toBe("failed");
    expect(deriveJobStatus([account({ phase: "error" }), account({ phase: "limited" })])).toBe("done");
  });
});

describe("toJobView", () => {
  const now = new Date("2026-09-22T10:00:30.000Z");

  it("lascia intatto un job con heartbeat recente", () => {
    const view = toJobView(job(), now);
    expect(view.interrupted).toBe(false);
    expect(view.status).toBe("running");
  });

  it("marca interrotto un job running senza heartbeat da oltre 60s", () => {
    const stale = job({
      updatedAt: "2026-09-22T09:59:00.000Z",
      accounts: [account({ accountId: "a", phase: "done" }), account({ accountId: "b", phase: "saving" })],
    });
    const view = toJobView(stale, now);
    expect(view.interrupted).toBe(true);
    expect(view.accounts.map((a) => a.phase)).toEqual(["done", "error"]);
    expect(view.status).toBe("done");
  });

  it("un job interrotto senza conti diventa failed", () => {
    const view = toJobView(job({ updatedAt: "2026-09-22T09:00:00.000Z", accounts: [] }), now);
    expect(view.interrupted).toBe(true);
    expect(view.status).toBe("failed");
  });

  it("non considera interrotto un job già concluso, anche se vecchio", () => {
    const view = toJobView(job({ status: "done", updatedAt: "2026-09-22T08:00:00.000Z" }), now);
    expect(view.interrupted).toBe(false);
  });
});

describe("overallProgress", () => {
  it("è complete per un job concluso", () => {
    expect(overallProgress(job({ status: "done" }))).toEqual({ kind: "complete" });
  });

  it("è indeterminate finché un conto non finale non ha un totale", () => {
    const running = job({ accounts: [account({ phase: "fetching" }), account({ phase: "saving", total: 10, processed: 5 })] });
    expect(overallProgress(running)).toEqual({ kind: "indeterminate" });
  });

  it("somma processed/total ignorando i conti finali senza totale", () => {
    const running = job({
      accounts: [
        account({ phase: "saving", total: 100, processed: 50 }),
        account({ phase: "done", total: 20, processed: 20 }),
        account({ phase: "limited", total: null }),
      ],
    });
    expect(overallProgress(running)).toEqual({ kind: "determinate", processed: 70, total: 120 });
  });
});

describe("isAccountSyncing", () => {
  it("è true solo per un conto non finale di un job running", () => {
    const jobs = [job({ accounts: [account({ accountId: "a", phase: "saving" }), account({ accountId: "b", phase: "done" })] })];
    expect(isAccountSyncing(jobs, "a")).toBe(true);
    expect(isAccountSyncing(jobs, "b")).toBe(false);
    expect(isAccountSyncing(jobs, "c")).toBe(false);
    expect(isAccountSyncing([job({ status: "done", accounts: [account({ accountId: "a", phase: "saving" })] })], "a")).toBe(false);
  });
});

describe("runningJobIds / hasFinishedSince", () => {
  it("rileva un job che non è più running rispetto al poll precedente", () => {
    const before = runningJobIds([job({ id: "x" }), job({ id: "y", status: "done" })]);
    expect(before).toEqual(new Set(["x"]));
    expect(hasFinishedSince(before, runningJobIds([job({ id: "x", status: "done" })]))).toBe(true);
    expect(hasFinishedSince(before, runningJobIds([job({ id: "x" })]))).toBe(false);
    expect(runningJobIds(undefined)).toEqual(new Set());
  });
});
