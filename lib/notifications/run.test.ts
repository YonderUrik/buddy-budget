import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBudget, makeCategory, makeTransaction } from "./fixtures.test-util";
import { parseNotificationsMode, runNotifications, type NotificationDeps, type NotificationUser } from "./run";
import { NOTIFICATION_DEFAULTS } from "./constants";
import { verifyUnsubscribeToken } from "./token";
import { createLogger } from "@/lib/observability/logger";

const NOW = new Date("2026-10-02T07:00:00Z"); // 2 ottobre: giorno di riepilogo mensile
const quiet = createLogger({ write: () => {} });

function user(overrides: Partial<NotificationUser["preferences"]> = {}, rest: Partial<NotificationUser> = {}): NotificationUser {
  return { id: "u1", email: "u1@example.test", currency: "EUR", hideAmounts: false, preferences: { ...NOTIFICATION_DEFAULTS, ...overrides }, ...rest };
}

function fakeDeps(users: NotificationUser[], overrides: Partial<NotificationDeps> = {}) {
  const claimed = new Map<string, Set<string>>();
  const send = vi.fn(async () => true);
  const deps: NotificationDeps = {
    listUsers: async () => users,
    loadTransactions: async () => [
      makeTransaction({ amount: "-250", date: "2026-10-01", categoryId: "cat-food" }),
      makeTransaction({ amount: "-100", date: "2026-09-12", categoryId: "cat-food" }),
    ],
    loadCategories: async () => [makeCategory({})],
    loadBudgets: async () => [makeBudget({ monthlyAmount: "300" })],
    loadDue: async () => [{ debtId: "d1", name: "Mutuo", date: "2026-10-04", amount: 600, overdue: false }],
    loadSentKeys: async (id, kind) => claimed.get(`${id}:${kind}`) ?? new Set(),
    isAlertCapped: async () => false,
    claimKeys: async (id, kind, keys) => {
      const set = claimed.get(`${id}:${kind}`) ?? new Set<string>();
      const fresh = keys.filter((k) => !set.has(k));
      fresh.forEach((k) => set.add(k));
      claimed.set(`${id}:${kind}`, set);
      return fresh;
    },
    releaseKeys: async (id, kind, keys) => keys.forEach((k) => claimed.get(`${id}:${kind}`)?.delete(k)),
    send,
    purgeLog: async () => 0,
    ...overrides,
  };
  return { deps, send, claimed };
}

const run = (deps: NotificationDeps, mode: "off" | "dry-run" | "execute" = "execute") =>
  runNotifications({ mode, now: NOW, deps, log: quiet, appUrl: "https://app.test" });

describe("parseNotificationsMode", () => {
  it("l'ambiente sconosciuto o assente ricade su dry-run, mai su execute", () => {
    expect(parseNotificationsMode(undefined)).toBe("dry-run");
    expect(parseNotificationsMode("esegui")).toBe("dry-run");
    expect(parseNotificationsMode("execute")).toBe("execute");
    expect(parseNotificationsMode("off")).toBe("off");
  });
});

describe("runNotifications", () => {
  beforeEach(() => vi.stubEnv("BETTER_AUTH_SECRET", "s".repeat(40)));
  afterEach(() => vi.unstubAllEnvs());

  it("con `off` non legge né invia nulla", async () => {
    const { deps, send } = fakeDeps([user({ digestEnabled: true })]);
    const result = await run(deps, "off");
    expect(send).not.toHaveBeenCalled();
    expect(result.users).toBe(0);
  });

  it("in dry-run conta cosa partirebbe ma non invia né prenota", async () => {
    const { deps, send, claimed } = fakeDeps([user({ digestEnabled: true, deadlineAlertsEnabled: true })]);
    const result = await run(deps, "dry-run");
    expect(result).toMatchObject({ wouldSend: 2, sent: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(claimed.size).toBe(0);
  });

  it("chi non ha attivato nulla non riceve nulla (utenti senza preferenze non sono nemmeno elencati)", async () => {
    const { deps, send } = fakeDeps([user()]);
    await run(deps);
    expect(send).not.toHaveBeenCalled();
  });

  it("manda il riepilogo con il link di disiscrizione valido per quell'utente e quel tipo", async () => {
    const { deps, send } = fakeDeps([user({ digestEnabled: true })]);
    const result = await run(deps);
    expect(result.sent).toBe(1);
    const [to, email, options] = send.mock.calls[0] as unknown as [string, { subject: string; html: string }, { unsubscribeToken: string }];
    expect(to).toBe("u1@example.test");
    expect(verifyUnsubscribeToken(options.unsubscribeToken)).toEqual({ userId: "u1", scope: "digest" });
    expect(email.html).toContain(encodeURIComponent(options.unsubscribeToken));
  });

  it("non rimanda lo stesso riepilogo il giorno dopo (deduplica) né lo manda fuori dai giorni previsti", async () => {
    const { deps, send } = fakeDeps([user({ digestEnabled: true })]);
    await run(deps);
    await run(deps);
    expect(send).toHaveBeenCalledTimes(1);
    const { deps: later, send: laterSend } = fakeDeps([user({ digestEnabled: true })]);
    await runNotifications({ mode: "execute", now: new Date("2026-10-15T07:00:00Z"), deps: later, log: quiet, appUrl: "https://app.test" });
    expect(laterSend).not.toHaveBeenCalled();
  });

  it("senza movimenti nel periodo il riepilogo non parte", async () => {
    const { deps, send } = fakeDeps([user({ digestEnabled: true })], { loadTransactions: async () => [] });
    const result = await run(deps);
    expect(send).not.toHaveBeenCalled();
    expect(result.empty).toBe(1);
  });

  it("avvisa budget e scadenze ma rispetta il tetto: una sola email di avviso al giorno", async () => {
    let capped = false;
    const { deps, send } = fakeDeps([user({ budgetAlertsEnabled: true, deadlineAlertsEnabled: true })], { isAlertCapped: async () => capped });
    const original = deps.claimKeys;
    deps.claimKeys = async (...args) => {
      const result = await original(...args);
      capped = true; // dopo il primo invio scatta il tetto
      return result;
    };
    const result = await run(deps);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.capped).toBe(1);
  });

  it("un invio fallito rilascia le chiavi: il giro dopo riprova e il cron risulta con un errore", async () => {
    const failing = vi.fn(async () => false);
    const { deps, claimed } = fakeDeps([user({ digestEnabled: true })], { send: failing });
    const first = await run(deps);
    expect(first.failed).toBe(1);
    expect(claimed.get("u1:digest")?.size ?? 0).toBe(0);
    const ok = vi.fn(async () => true);
    deps.send = ok;
    expect((await run(deps)).sent).toBe(1);
  });

  it("se un altro processo ha già prenotato la chiave non invia", async () => {
    const { deps, send } = fakeDeps([user({ digestEnabled: true })], { claimKeys: async () => [] });
    await run(deps);
    expect(send).not.toHaveBeenCalled();
  });

  it("un errore su un utente non ferma gli altri", async () => {
    const users = [user({ digestEnabled: true }, { id: "bad" }), user({ digestEnabled: true }, { id: "good", email: "good@example.test" })];
    const { deps, send } = fakeDeps(users, {
      loadTransactions: async (id) => {
        if (id === "bad") throw new Error("boom");
        return [makeTransaction({ amount: "-50", date: "2026-09-12" })];
      },
    });
    const result = await run(deps);
    expect(result.failed).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0] as unknown[])[0]).toBe("good@example.test");
  });

  it("con «nascondi importi» le cifre non compaiono nell'email", async () => {
    const { deps, send } = fakeDeps([user({ digestEnabled: true }, { hideAmounts: true })]);
    await run(deps);
    const email = (send.mock.calls[0] as unknown as [string, { text: string }])[1];
    expect(email.text).toContain("••••");
    expect(email.text).not.toMatch(/\d+,\d{2}/);
  });
});
