import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {}, client: {} }));
vi.mock("./lifecycle", () => ({ deleteUserAccount: vi.fn() }));
vi.mock("./emails", () => ({ sendAccountEmail: vi.fn() }));

import { INACTIVITY_MAX_ACTIONS_PER_RUN } from "./constants";
import { runInactiveAccounts, type InactivityDeps, type InactivityUser } from "./inactivity";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-01T03:15:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

function makeDeps(users: InactivityUser[], overrides: Partial<InactivityDeps> = {}) {
  const store = new Map(users.map((u) => [u.id, { ...u }]));
  const calls = { warnings: [] as string[], deleted: [] as string[], deletedMails: [] as string[], cleared: [] as string[] };
  const deps: InactivityDeps = {
    listCandidates: async () => [...store.values()],
    reload: async (id) => (store.has(id) ? { ...store.get(id)! } : null),
    claimWarning: async (id, at) => {
      const user = store.get(id)!;
      if (user.warnedAt) return false;
      user.warnedAt = at;
      return true;
    },
    releaseWarning: async (id) => {
      store.get(id)!.warnedAt = null;
    },
    clearWarning: async (id) => {
      calls.cleared.push(id);
      store.get(id)!.warnedAt = null;
    },
    sendWarning: async (user) => {
      calls.warnings.push(user.id);
      return true;
    },
    sendDeleted: async (_email, id) => {
      calls.deletedMails.push(id);
    },
    deleteAccount: async (id) => {
      calls.deleted.push(id);
      store.delete(id);
    },
    exemptionReason: async () => null,
    ...overrides,
  };
  return { deps, store, calls };
}

const user = (id: string, lastActiveDays: number, warnedDays: number | null = null): InactivityUser => ({
  id,
  email: `${id}@example.test`,
  lastActiveAt: daysAgo(lastActiveDays),
  warnedAt: warnedDays === null ? null : daysAgo(warnedDays),
});

describe("runInactiveAccounts", () => {
  it("off non fa nulla", async () => {
    const { deps, calls } = makeDeps([user("a", 100)]);
    const result = await runInactiveAccounts({ mode: "off", now: NOW, deps });
    expect(result.scanned).toBe(0);
    expect(calls.warnings).toEqual([]);
  });

  it("dry-run conta ma non scrive, non invia e non elimina", async () => {
    const { deps, store, calls } = makeDeps([user("warn", 84), user("del", 95, 8), user("back", 2, 8)]);
    const result = await runInactiveAccounts({ mode: "dry-run", now: NOW, deps });
    expect(result).toMatchObject({ mode: "dry-run", scanned: 3, wouldWarn: 1, wouldDelete: 1, returned: 1, warned: 0, deleted: 0 });
    expect(calls).toEqual({ warnings: [], deleted: [], deletedMails: [], cleared: [] });
    expect(store.get("warn")!.warnedAt).toBeNull();
    expect(store.has("del")).toBe(true);
  });

  it("execute avvisa chi è inattivo da 83 giorni, una volta sola", async () => {
    const { deps, calls } = makeDeps([user("a", 84), user("fresh", 10)]);
    const first = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(first).toMatchObject({ warned: 1, deleted: 0 });
    expect(calls.warnings).toEqual(["a"]);
    const second = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(second).toMatchObject({ warned: 0, deleted: 0 });
    expect(calls.warnings).toEqual(["a"]);
  });

  it("non elimina chi non è stato avvisato, nemmeno se inattivo da molto", async () => {
    const { deps, calls } = makeDeps([user("old", 400)]);
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result).toMatchObject({ warned: 1, deleted: 0 });
    expect(calls.deleted).toEqual([]);
  });

  it("elimina chi è stato avvisato da 7 giorni e non è rientrato, poi manda la conferma", async () => {
    const { deps, calls } = makeDeps([user("gone", 91, 8), user("waiting", 88, 5)]);
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result).toMatchObject({ deleted: 1, failed: 0 });
    expect(calls.deleted).toEqual(["gone"]);
    expect(calls.deletedMails).toEqual(["gone"]);
  });

  it("chi rientra dopo l'avviso viene ripulito e non eliminato", async () => {
    const { deps, calls, store } = makeDeps([user("back", 2, 10)]);
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result).toMatchObject({ returned: 1, deleted: 0 });
    expect(calls.cleared).toEqual(["back"]);
    expect(store.get("back")!.warnedAt).toBeNull();
  });

  it("un accesso avvenuto tra la lista e l'azione annulla l'eliminazione (rilettura)", async () => {
    const { deps, calls } = makeDeps([user("race", 91, 8)], {
      reload: async () => user("race", 0, 8),
    });
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result.returned).toBe(1);
    expect(calls.deleted).toEqual([]);
  });

  it("se l'email di avviso non parte, rilascia la prenotazione, non elimina e conta un errore", async () => {
    const { deps, store, calls } = makeDeps([user("a", 84)], { sendWarning: async () => false });
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result).toMatchObject({ warned: 0, failed: 1 });
    expect(store.get("a")!.warnedAt).toBeNull();
    expect(calls.deleted).toEqual([]);
  });

  it("un invio che lancia non lascia l'utente bloccato come avvisato", async () => {
    const { deps, store } = makeDeps([user("a", 84)], {
      sendWarning: async () => {
        throw new Error("rete");
      },
    });
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result.failed).toBe(1);
    expect(store.get("a")!.warnedAt).toBeNull();
  });

  it("un errore su un utente non blocca gli altri", async () => {
    const { deps, calls } = makeDeps([user("bad", 95, 8), user("ok", 96, 9)], {
      deleteAccount: async (id) => {
        if (id === "bad") throw new Error("DB");
      },
    });
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result).toMatchObject({ failed: 1, deleted: 1 });
    expect(calls.deletedMails).toEqual(["ok"]);
  });

  it("gli account protetti non vengono né avvisati né eliminati", async () => {
    const { deps, calls } = makeDeps([user("paid", 84), user("paid2", 95, 8)], { exemptionReason: async () => "abbonamento" });
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result).toMatchObject({ exempt: 2, warned: 0, deleted: 0 });
    expect(calls.warnings).toEqual([]);
    expect(calls.deleted).toEqual([]);
  });

  it("il tetto per giro limita avvisi ed eliminazioni e rimanda il resto", async () => {
    const many = Array.from({ length: INACTIVITY_MAX_ACTIONS_PER_RUN + 5 }, (_, i) => user(`d${i}`, 95, 8));
    const { deps, calls } = makeDeps(many);
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps });
    expect(result.deleted).toBe(INACTIVITY_MAX_ACTIONS_PER_RUN);
    expect(result.capped).toBe(5);
    expect(calls.deleted).toHaveLength(INACTIVITY_MAX_ACTIONS_PER_RUN);
  });
});
