import "server-only";
import { and, asc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { budgets, type Budget } from "@/lib/db/schema/budgets";
import { categories, type Category } from "@/lib/db/schema/categories";
import { notificationPreferences } from "@/lib/db/schema/notifications";
import { transactions, type Transaction } from "@/lib/db/schema/transactions";
import { loadUserDebts } from "@/lib/debts/data";
import { buildDebtsView, type DebtDueItem } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { getAppUrl } from "@/lib/env";
import { hashUserId, logger, recordNotificationEmail, type Logger, type NotificationEmailOutcome } from "@/lib/observability";
import { findBudgetAlerts, findDeadlineAlerts } from "./alerts";
import { RUN_TIME_BUDGET_MS, type NotificationKind, type NotificationPreferences } from "./constants";
import { romeDate } from "./dates";
import { buildDigest, digestPeriod, digestWindowStartIso, isDigestDay } from "./digest";
import { budgetAlertEmail, deadlineAlertEmail, digestEmail, NOTIFICATION_SETTINGS_PATH, type BuiltEmail, type EmailContext } from "./emails";
import { sendNotificationEmail } from "./send";
import { claimKeys, isAlertCapped, loadSentKeys, purgeNotificationLog, releaseKeys } from "./store";
import { createUnsubscribeToken, unsubscribePageUrl } from "./token";

/** `off` non fa nulla, `dry-run` (default) calcola e conta senza inviare né prenotare, `execute` invia davvero. */
export type NotificationsMode = "off" | "dry-run" | "execute";

/** Legge `NOTIFICATIONS_MODE`: qualunque valore sconosciuto ricade su `dry-run`, mai su `execute`. */
export function parseNotificationsMode(value: string | undefined): NotificationsMode {
  return value === "off" || value === "execute" ? value : "dry-run";
}

/** Utente da servire: solo ciò che serve a costruire le email. */
export interface NotificationUser {
  id: string;
  email: string;
  currency: string;
  hideAmounts: boolean;
  preferences: NotificationPreferences;
}

/** Accesso ai dati e agli effetti collaterali: sostituibile nei test. */
export interface NotificationDeps {
  listUsers(): Promise<NotificationUser[]>;
  loadTransactions(userId: string, fromIso: string): Promise<Transaction[]>;
  loadCategories(userId: string): Promise<Category[]>;
  loadBudgets(userId: string): Promise<Budget[]>;
  loadDue(userId: string, now: Date): Promise<DebtDueItem[]>;
  loadSentKeys(userId: string, kind: NotificationKind, now: Date): Promise<Set<string>>;
  isAlertCapped(userId: string, now: Date): Promise<boolean>;
  claimKeys(userId: string, kind: NotificationKind, keys: string[], sentAt: Date): Promise<string[]>;
  releaseKeys(userId: string, kind: NotificationKind, keys: string[]): Promise<void>;
  send(to: string, email: BuiltEmail, options: { appUrl: string; unsubscribeToken: string }): Promise<boolean>;
  purgeLog(now: Date): Promise<number>;
}

export interface NotificationsResult {
  mode: NotificationsMode;
  users: number;
  sent: number;
  /** In dry-run: email che sarebbero partite. */
  wouldSend: number;
  capped: number;
  empty: number;
  failed: number;
  purged: number;
  /** True se il giro si è fermato per il limite di tempo: i restanti ripartono al giro dopo. */
  timedOut: boolean;
}

export const databaseDeps: NotificationDeps = {
  async listUsers() {
    const rows = await db
      .select({ id: authUser.id, email: authUser.email, currency: authUser.currency, hideAmounts: authUser.hideAmounts, prefs: notificationPreferences })
      .from(notificationPreferences)
      .innerJoin(authUser, eq(authUser.id, notificationPreferences.userId))
      .where(
        and(
          isNull(authUser.deletionScheduledAt),
          or(eq(notificationPreferences.digestEnabled, true), eq(notificationPreferences.budgetAlertsEnabled, true), eq(notificationPreferences.deadlineAlertsEnabled, true)),
        ),
      )
      .orderBy(asc(authUser.id));
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      currency: r.currency,
      hideAmounts: r.hideAmounts,
      preferences: {
        digestEnabled: r.prefs.digestEnabled,
        digestFrequency: r.prefs.digestFrequency === "settimanale" ? ("settimanale" as const) : ("mensile" as const),
        budgetAlertsEnabled: r.prefs.budgetAlertsEnabled,
        deadlineAlertsEnabled: r.prefs.deadlineAlertsEnabled,
      },
    }));
  },
  loadTransactions: (userId, fromIso) =>
    db.select().from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, fromIso))),
  loadCategories: (userId) => db.select().from(categories).where(eq(categories.userId, userId)),
  loadBudgets: (userId) => db.select().from(budgets).where(eq(budgets.userId, userId)),
  async loadDue(userId, now) {
    const { debts, events } = await loadUserDebts(userId);
    return buildDebtsView(debts, events, romeDate(now).iso).overview.nextDue;
  },
  loadSentKeys,
  isAlertCapped,
  claimKeys,
  releaseKeys,
  send: sendNotificationEmail,
  purgeLog: purgeNotificationLog,
};

/** Maschera da usare al posto degli importi se l'utente ha scelto «nascondi importi». */
const HIDDEN_AMOUNT = "••••";

function contextFor(user: NotificationUser, kind: NotificationKind, appUrl: string): EmailContext & { token: string } {
  const token = createUnsubscribeToken({ userId: user.id, scope: kind });
  return {
    appUrl,
    token,
    money: (value) => (user.hideAmounts ? HIDDEN_AMOUNT : formatCurrency(value, user.currency)),
    unsubscribeUrl: unsubscribePageUrl(appUrl, token),
    preferencesUrl: `${appUrl}${NOTIFICATION_SETTINGS_PATH}`,
  };
}

/**
 * Giro del cron: per ogni utente con almeno una preferenza attiva prepara riepilogo, avvisi di scadenza e avvisi di
 * budget. Le chiavi si prenotano prima dell'invio (deduplica anche con più processi) e si rilasciano se l'invio fallisce.
 * Non lancia: un errore su un utente è contato e il giro prosegue.
 */
export async function runNotifications(options: {
  mode: NotificationsMode;
  now?: Date;
  log?: Logger;
  deps?: NotificationDeps;
  appUrl?: string;
}): Promise<NotificationsResult> {
  const { mode } = options;
  const now = options.now ?? new Date();
  const log = options.log ?? logger;
  const deps = options.deps ?? databaseDeps;
  const result: NotificationsResult = { mode, users: 0, sent: 0, wouldSend: 0, capped: 0, empty: 0, failed: 0, purged: 0, timedOut: false };
  if (mode === "off") return result;
  const appUrl = options.appUrl ?? getAppUrl();
  const startedAt = Date.now();

  const outcome = (kind: NotificationKind, value: NotificationEmailOutcome) => recordNotificationEmail(kind, value);

  /** Prenota, invia e (se fallisce) rilascia. In dry-run conta soltanto. */
  async function deliver(user: NotificationUser, kind: NotificationKind, build: (ctx: EmailContext) => BuiltEmail, keys: string[], extraKeys: string[] = []): Promise<void> {
    if (mode === "dry-run") {
      result.wouldSend += 1;
      outcome(kind, "dry_run");
      log.info("notifications.email.dry_run", { user: hashUserId(user.id), kind });
      return;
    }
    const claimed = await deps.claimKeys(user.id, kind, keys, now);
    if (claimed.length < keys.length) {
      // Un altro processo ha già prenotato una di queste chiavi: restituiamo le nostre e lasciamo fare a lui.
      await deps.releaseKeys(user.id, kind, claimed);
      return;
    }
    // Le soglie più basse della stessa categoria si segnano senza condizionare l'invio: potrebbero essere già lì.
    const claimedExtra = await deps.claimKeys(user.id, kind, extraKeys.filter((k) => !keys.includes(k)), now);
    const ctx = contextFor(user, kind, appUrl);
    let ok = false;
    try {
      ok = await deps.send(user.email, build(ctx), { appUrl, unsubscribeToken: ctx.token });
    } catch (error) {
      // L'indirizzo non va nei log: solo l'utente in forma di hash.
      log.warn("notifications.email.failed", { user: hashUserId(user.id), kind, error });
    }
    if (!ok) {
      await deps.releaseKeys(user.id, kind, [...keys, ...claimedExtra]);
      result.failed += 1;
      outcome(kind, "failed");
      log.warn("notifications.email.failed", { user: hashUserId(user.id), kind });
      return;
    }
    result.sent += 1;
    outcome(kind, "sent");
    log.info("notifications.email.sent", { user: hashUserId(user.id), kind, count: keys.length });
  }

  async function processUser(user: NotificationUser): Promise<void> {
    const { preferences } = user;
    if (preferences.deadlineAlertsEnabled) {
      const alerts = findDeadlineAlerts({ due: await deps.loadDue(user.id, now), alreadySent: await deps.loadSentKeys(user.id, "deadlines", now), now });
      if (alerts.length > 0) {
        if (await deps.isAlertCapped(user.id, now)) {
          result.capped += 1;
          outcome("deadlines", "capped");
        } else {
          await deliver(user, "deadlines", (ctx) => deadlineAlertEmail(alerts, ctx), alerts.map((a) => a.itemKey));
        }
      }
    }
    if (preferences.budgetAlertsEnabled) {
      const budgetRows = await deps.loadBudgets(user.id);
      if (budgetRows.length > 0) {
        const { year, month } = romeDate(now);
        const alerts = findBudgetAlerts({
          transactions: await deps.loadTransactions(user.id, `${year}-${String(month).padStart(2, "0")}-01`),
          categories: await deps.loadCategories(user.id),
          budgets: budgetRows,
          alreadySent: await deps.loadSentKeys(user.id, "budget", now),
          now,
        });
        if (alerts.length > 0) {
          if (await deps.isAlertCapped(user.id, now)) {
            result.capped += 1;
            outcome("budget", "capped");
          } else {
            await deliver(user, "budget", (ctx) => budgetAlertEmail(alerts, ctx), alerts.map((a) => a.itemKey), alerts.flatMap((a) => a.itemKeys));
          }
        }
      }
    }
    if (preferences.digestEnabled && isDigestDay(preferences.digestFrequency, now)) {
      const period = digestPeriod(preferences.digestFrequency, now);
      if (!(await deps.loadSentKeys(user.id, "digest", now)).has(period.key)) {
        const data = buildDigest({
          transactions: await deps.loadTransactions(user.id, digestWindowStartIso(preferences.digestFrequency, now)),
          categories: await deps.loadCategories(user.id),
          budgets: await deps.loadBudgets(user.id),
          frequency: preferences.digestFrequency,
          now,
        });
        if (data.movements === 0) {
          result.empty += 1;
          outcome("digest", "empty");
        } else {
          await deliver(user, "digest", (ctx) => digestEmail(data, ctx), [period.key]);
        }
      }
    }
  }

  const users = await deps.listUsers();
  result.users = users.length;
  for (const user of users) {
    if (Date.now() - startedAt > RUN_TIME_BUDGET_MS) {
      result.timedOut = true;
      log.warn("notifications.run.timed_out", { processed: result.users, total: users.length });
      break;
    }
    try {
      await processUser(user);
    } catch (error) {
      result.failed += 1;
      log.warn("notifications.user.failed", { user: hashUserId(user.id), error });
    }
  }
  try {
    result.purged = await deps.purgeLog(now);
  } catch (error) {
    log.warn("notifications.log.purge_failed", { error });
  }
  log.info("notifications.run.completed", {
    outcome: mode,
    total: result.users,
    count: result.mode === "execute" ? result.sent : result.wouldSend,
    skipped: result.capped + result.empty,
    deleted: result.purged,
  });
  return result;
}
