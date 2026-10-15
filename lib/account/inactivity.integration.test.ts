import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/bank-data/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bank-data/gocardless/client")>();
  return { ...actual, deleteRequisition: vi.fn() };
});
vi.mock("./emails", () => ({ sendAccountEmail: vi.fn().mockResolvedValue(true) }));

import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authSession, authUser } from "@/lib/db/schema/auth";
import { databaseDeps, runInactiveAccounts } from "./inactivity";
import { touchLastActive } from "./last-active";
import { sendAccountEmail } from "./emails";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-01T03:15:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const createdUserIds: string[] = [];
const mockedSend = vi.mocked(sendAccountEmail);

async function createUser(label: string, lastActiveDays: number, extra: Partial<typeof authUser.$inferInsert> = {}) {
  const id = `inattivo-${label}-${crypto.randomUUID()}`;
  createdUserIds.push(id);
  await db.insert(authUser).values({ id, name: label, email: `${id}@example.test`, lastActiveAt: daysAgo(lastActiveDays), ...extra });
  await db.insert(accounts).values({ userId: id, name: "Conto", type: "checking", balance: "10.00", currency: "EUR" } as typeof accounts.$inferInsert).catch(() => undefined);
  return id;
}

/** Il cron tocca tutti gli utenti del DB di prova: nei test si guardano solo gli utenti creati qui. */
const onlyMine = { ...databaseDeps, listCandidates: async (now: Date) => (await databaseDeps.listCandidates(now)).filter((u) => createdUserIds.includes(u.id)) };

describe("account inattivi (database reale)", () => {
  beforeEach(() => {
    mockedSend.mockClear();
  });
  afterAll(async () => {
    if (createdUserIds.length) await db.delete(authUser).where(inArray(authUser.id, createdUserIds));
    await client.end();
  });

  it("flusso completo: avviso a 83 giorni, nessuna email doppia, eliminazione a 7 giorni dall'avviso", async () => {
    const id = await createUser("flusso", 84);
    const first = await runInactiveAccounts({ mode: "execute", now: NOW, deps: onlyMine });
    expect(first).toMatchObject({ warned: 1, deleted: 0 });
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedSend.mock.calls[0][1]).toBe("inactivity_warning");
    const [afterWarn] = await db.select().from(authUser).where(eq(authUser.id, id));
    expect(afterWarn.inactivityWarnedAt?.getTime()).toBe(NOW.getTime());

    const same = await runInactiveAccounts({ mode: "execute", now: new Date(NOW.getTime() + 3 * DAY_MS), deps: onlyMine });
    expect(same).toMatchObject({ warned: 0, deleted: 0 });
    expect(mockedSend).toHaveBeenCalledTimes(1);

    const later = await runInactiveAccounts({ mode: "execute", now: new Date(NOW.getTime() + 7 * DAY_MS), deps: onlyMine });
    expect(later).toMatchObject({ deleted: 1, failed: 0 });
    expect(mockedSend.mock.calls[1][1]).toBe("inactivity_deleted");
    expect(await db.select().from(authUser).where(eq(authUser.id, id))).toHaveLength(0);
  });

  it("dry-run non modifica il database", async () => {
    const id = await createUser("dry", 100);
    const result = await runInactiveAccounts({ mode: "dry-run", now: NOW, deps: onlyMine });
    expect(result.wouldWarn).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(authUser).where(eq(authUser.id, id));
    expect(row.inactivityWarnedAt).toBeNull();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("l'accesso dopo l'avviso (touchLastActive) annulla l'eliminazione", async () => {
    const id = await createUser("rientra", 91, { inactivityWarnedAt: daysAgo(8) });
    await touchLastActive(id, daysAgo(1));
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps: onlyMine });
    expect(result.deleted).toBe(0);
    const [row] = await db.select().from(authUser).where(eq(authUser.id, id));
    expect(row.inactivityWarnedAt).toBeNull();
  });

  it("una sessione recente conta come attività anche se il campo dell'utente è vecchio", async () => {
    const id = await createUser("sessione", 120);
    await db.insert(authSession).values({
      id: `sess-${id}`,
      userId: id,
      token: `tok-${id}`,
      expiresAt: new Date(NOW.getTime() + DAY_MS),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    });
    const candidates = await onlyMine.listCandidates(NOW);
    expect(candidates.find((u) => u.id === id)).toBeUndefined();
  });

  it("gli account con eliminazione già programmata non vengono toccati", async () => {
    const id = await createUser("programmato", 200, { deletionScheduledAt: new Date(NOW.getTime() + 5 * DAY_MS) });
    const candidates = await onlyMine.listCandidates(NOW);
    expect(candidates.find((u) => u.id === id)).toBeUndefined();
  });

  it("l'eliminazione rimuove i dati dell'utente", async () => {
    const id = await createUser("dati", 95, { inactivityWarnedAt: daysAgo(8) });
    const result = await runInactiveAccounts({ mode: "execute", now: NOW, deps: onlyMine });
    expect(result.deleted).toBe(1);
    expect(await db.select().from(accounts).where(eq(accounts.userId, id))).toHaveLength(0);
  });
});
