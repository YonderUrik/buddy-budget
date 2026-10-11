import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { notificationLog, notificationPreferences } from "@/lib/db/schema/notifications";
import { NOTIFICATION_DEFAULTS } from "./constants";
import { databaseDeps } from "./run";
import {
  applyUnsubscribe,
  claimKeys,
  countRecentTests,
  getNotificationPreferences,
  isAlertCapped,
  loadSentKeys,
  purgeNotificationLog,
  releaseKeys,
  saveNotificationPreferences,
} from "./store";

const DAY_MS = 24 * 60 * 60 * 1000;
const userIds: string[] = [];
let userId: string;

beforeEach(async () => {
  userId = `test-notif-${crypto.randomUUID()}`;
  userIds.push(userId);
  await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, onboardingCompleted: true });
});

afterAll(async () => {
  await db.delete(authUser).where(inArray(authUser.id, userIds));
  await client.end();
});

describe("preferenze", () => {
  it("senza riga valgono i default: tutto spento (opt-in)", async () => {
    expect(await getNotificationPreferences(userId)).toEqual(NOTIFICATION_DEFAULTS);
    expect(NOTIFICATION_DEFAULTS).toMatchObject({ digestEnabled: false, budgetAlertsEnabled: false, deadlineAlertsEnabled: false });
  });

  it("salva un campo alla volta e conserva gli altri", async () => {
    await saveNotificationPreferences(userId, { digestEnabled: true });
    const result = await saveNotificationPreferences(userId, { digestFrequency: "settimanale" });
    expect(result).toEqual({ ...NOTIFICATION_DEFAULTS, digestEnabled: true, digestFrequency: "settimanale" });
  });

  it("la disiscrizione spegne solo il tipo indicato, `all` li spegne tutti, ed è idempotente", async () => {
    await saveNotificationPreferences(userId, { digestEnabled: true, budgetAlertsEnabled: true, deadlineAlertsEnabled: true });
    await applyUnsubscribe(userId, "budget");
    await applyUnsubscribe(userId, "budget");
    expect(await getNotificationPreferences(userId)).toMatchObject({ digestEnabled: true, budgetAlertsEnabled: false, deadlineAlertsEnabled: true });
    await applyUnsubscribe(userId, "all");
    expect(await getNotificationPreferences(userId)).toMatchObject({ digestEnabled: false, budgetAlertsEnabled: false, deadlineAlertsEnabled: false });
  });

  it("chi si disiscrive senza aver mai salvato preferenze resta spento", async () => {
    await applyUnsubscribe(userId, "digest");
    expect(await getNotificationPreferences(userId)).toEqual(NOTIFICATION_DEFAULTS);
  });

  it("eliminando l'utente spariscono preferenze e registro", async () => {
    await saveNotificationPreferences(userId, { digestEnabled: true });
    await claimKeys(userId, "digest", ["k"], new Date());
    await db.delete(authUser).where(eq(authUser.id, userId));
    expect(await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId))).toHaveLength(0);
    expect(await db.select().from(notificationLog).where(eq(notificationLog.userId, userId))).toHaveLength(0);
  });
});

describe("elenco degli utenti da servire", () => {
  it("include solo chi ha almeno un tipo attivo e non ha l'eliminazione programmata", async () => {
    await saveNotificationPreferences(userId, { budgetAlertsEnabled: true });
    expect((await databaseDeps.listUsers()).map((u) => u.id)).toContain(userId);
    await applyUnsubscribe(userId, "all");
    expect((await databaseDeps.listUsers()).map((u) => u.id)).not.toContain(userId);
    await saveNotificationPreferences(userId, { digestEnabled: true });
    await db.update(authUser).set({ deletionScheduledAt: new Date(Date.now() + DAY_MS) }).where(eq(authUser.id, userId));
    expect((await databaseDeps.listUsers()).map((u) => u.id)).not.toContain(userId);
  });
});

describe("registro: deduplica, tetto e conservazione", () => {
  const now = new Date();

  it("una chiave si prenota una volta sola e si può rilasciare", async () => {
    expect(await claimKeys(userId, "budget", ["a", "b"], now)).toEqual(["a", "b"]);
    expect(await claimKeys(userId, "budget", ["a", "c"], now)).toEqual(["c"]);
    expect([...(await loadSentKeys(userId, "budget", now))].sort()).toEqual(["a", "b", "c"]);
    await releaseKeys(userId, "budget", ["c"]);
    expect(await loadSentKeys(userId, "budget", now)).not.toContain("c");
    expect((await loadSentKeys(userId, "deadlines", now)).size).toBe(0);
  });

  it("il tetto scatta con un avviso nelle ultime 24 ore", async () => {
    expect(await isAlertCapped(userId, now)).toBe(false);
    await claimKeys(userId, "deadlines", ["rata:1"], new Date(now.getTime() - 2 * 60 * 60 * 1000));
    expect(await isAlertCapped(userId, now)).toBe(true);
  });

  it("più chiavi dello stesso invio contano come un invio; dopo 24 ore si può di nuovo, fino a tre a settimana", async () => {
    await claimKeys(userId, "budget", ["x", "y"], new Date(now.getTime() - 5 * DAY_MS));
    await claimKeys(userId, "budget", ["z"], new Date(now.getTime() - 3 * DAY_MS));
    expect(await isAlertCapped(userId, now)).toBe(false);
    await claimKeys(userId, "deadlines", ["w"], new Date(now.getTime() - 2 * DAY_MS));
    expect(await isAlertCapped(userId, now)).toBe(true);
  });

  it("il riepilogo non conta nel tetto degli avvisi", async () => {
    await claimKeys(userId, "digest", ["digest:mensile:2026-09"], new Date(now.getTime() - 60_000));
    expect(await isAlertCapped(userId, now)).toBe(false);
  });

  it("le email di prova si contano nell'ultima ora", async () => {
    await claimKeys(userId, "test", ["1", "2"], now);
    await claimKeys(userId, "test", ["old"], new Date(now.getTime() - 2 * 60 * 60 * 1000));
    expect(await countRecentTests(userId, now)).toBe(2);
  });

  it("elimina le righe oltre la conservazione e lascia le recenti", async () => {
    await claimKeys(userId, "budget", ["old"], new Date(now.getTime() - 100 * DAY_MS));
    await claimKeys(userId, "budget", ["new"], now);
    expect(await purgeNotificationLog(now)).toBeGreaterThanOrEqual(1);
    const rows = await db.select().from(notificationLog).where(eq(notificationLog.userId, userId));
    expect(rows.map((r) => r.itemKey)).toEqual(["new"]);
  });
});
