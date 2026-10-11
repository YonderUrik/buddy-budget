import "server-only";
import { and, count, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notificationLog, notificationPreferences } from "@/lib/db/schema/notifications";
import {
  ALERT_MAX_PER_WEEK,
  ALERT_MIN_INTERVAL_HOURS,
  NOTIFICATION_DEFAULTS,
  NOTIFICATION_LOG_RETENTION_DAYS,
  type NotificationKind,
  type NotificationPreferences,
  type UnsubscribeScope,
} from "./constants";
import type { UpdateNotificationPreferencesInput } from "@/lib/validation/notifications";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ALERT_KINDS = ["budget", "deadlines"] as const;

function toPreferences(row: typeof notificationPreferences.$inferSelect | undefined): NotificationPreferences {
  if (!row) return { ...NOTIFICATION_DEFAULTS };
  return {
    digestEnabled: row.digestEnabled,
    digestFrequency: row.digestFrequency === "settimanale" ? "settimanale" : "mensile",
    budgetAlertsEnabled: row.budgetAlertsEnabled,
    deadlineAlertsEnabled: row.deadlineAlertsEnabled,
  };
}

/** Preferenze dell'utente; senza riga valgono i default (tutto spento). */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  return toPreferences(row);
}

/** Salva un aggiornamento parziale delle preferenze e restituisce quelle risultanti. */
export async function saveNotificationPreferences(userId: string, patch: UpdateNotificationPreferencesInput): Promise<NotificationPreferences> {
  const now = new Date();
  const [row] = await db
    .insert(notificationPreferences)
    .values({ userId, ...patch })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...patch, updatedAt: now } })
    .returning();
  return toPreferences(row);
}

/** Spegne le email di un tipo (o tutte, con `all`) per l'utente. Idempotente: ripeterlo non cambia nulla. */
export async function applyUnsubscribe(userId: string, scope: UnsubscribeScope): Promise<void> {
  const off: UpdateNotificationPreferencesInput =
    scope === "all"
      ? { digestEnabled: false, budgetAlertsEnabled: false, deadlineAlertsEnabled: false }
      : scope === "digest"
        ? { digestEnabled: false }
        : scope === "budget"
          ? { budgetAlertsEnabled: false }
          : { deadlineAlertsEnabled: false };
  // Non crea righe per utenti che non esistono più: la chiave esterna rifiuta l'inserimento.
  await db
    .insert(notificationPreferences)
    .values({ userId, ...off })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...off, updatedAt: new Date() } });
}

/** Chiavi già inviate per un tipo di email (per la deduplica). */
export async function loadSentKeys(userId: string, kind: NotificationKind, now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - NOTIFICATION_LOG_RETENTION_DAYS * DAY_MS);
  const rows = await db
    .select({ itemKey: notificationLog.itemKey })
    .from(notificationLog)
    .where(and(eq(notificationLog.userId, userId), eq(notificationLog.kind, kind), gte(notificationLog.sentAt, since)));
  return new Set(rows.map((r) => r.itemKey));
}

/**
 * True se un'altra email di avviso non può partire adesso: ne è già partita una nelle ultime 24 ore oppure
 * ne sono partite `ALERT_MAX_PER_WEEK` negli ultimi 7 giorni (budget e scadenze insieme; il riepilogo ha il suo ritmo).
 */
export async function isAlertCapped(userId: string, now: Date): Promise<boolean> {
  const rows = await db
    .selectDistinct({ sentAt: notificationLog.sentAt })
    .from(notificationLog)
    .where(and(eq(notificationLog.userId, userId), inArray(notificationLog.kind, [...ALERT_KINDS]), gte(notificationLog.sentAt, new Date(now.getTime() - 7 * DAY_MS))));
  if (rows.length >= ALERT_MAX_PER_WEEK) return true;
  const last = Math.max(0, ...rows.map((r) => r.sentAt.getTime()));
  return now.getTime() - last < ALERT_MIN_INTERVAL_HOURS * HOUR_MS;
}

/**
 * Prenota le chiavi prima dell'invio: con più processi solo uno le ottiene. Restituisce le chiavi davvero prenotate;
 * se una era già presente (invio concorrente) quel giro non manda nulla.
 */
export async function claimKeys(userId: string, kind: NotificationKind | "test", keys: string[], sentAt: Date): Promise<string[]> {
  if (keys.length === 0) return [];
  const rows = await db
    .insert(notificationLog)
    .values(keys.map((itemKey) => ({ userId, kind, itemKey, sentAt })))
    .onConflictDoNothing()
    .returning({ itemKey: notificationLog.itemKey });
  return rows.map((r) => r.itemKey);
}

/** Restituisce le chiavi prenotate quando l'invio è fallito, così il giro dopo riprova. */
export async function releaseKeys(userId: string, kind: NotificationKind | "test", keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.delete(notificationLog).where(and(eq(notificationLog.userId, userId), eq(notificationLog.kind, kind), inArray(notificationLog.itemKey, keys)));
}

/** Email di prova inviate all'utente nell'ultima ora (per il limite del pulsante in Impostazioni). */
export async function countRecentTests(userId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(notificationLog)
    .where(and(eq(notificationLog.userId, userId), eq(notificationLog.kind, "test"), gte(notificationLog.sentAt, new Date(now.getTime() - HOUR_MS))));
  return row?.n ?? 0;
}

/** Elimina le righe del registro oltre la conservazione; restituisce quante. */
export async function purgeNotificationLog(now: Date): Promise<number> {
  const rows = await db
    .delete(notificationLog)
    .where(lt(notificationLog.sentAt, new Date(now.getTime() - NOTIFICATION_LOG_RETENTION_DAYS * DAY_MS)))
    .returning({ id: notificationLog.id });
  return rows.length;
}

