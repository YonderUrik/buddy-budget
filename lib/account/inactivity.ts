import "server-only";
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { resolveProfile, type Language } from "@/lib/localization/config";
import { authSession, authUser } from "@/lib/db/schema/auth";
import { hashUserId, logger as defaultLogger, recordInactiveAccounts, type Logger } from "@/lib/observability";
import { INACTIVITY_MAX_ACTIONS_PER_RUN } from "./constants";
import { sendAccountEmail } from "./emails";
import { deleteUserAccount } from "./lifecycle";
import { decideInactivity, deletionDueAt, inactiveDays, warningCutoff, type InactivityRunMode } from "./inactivity-policy";

/** Utente da valutare: solo ciò che serve a decidere e a scrivergli. */
export interface InactivityUser {
  id: string;
  email: string;
  lastActiveAt: Date;
  warnedAt: Date | null;
  /** Saved country and language: the emails are written in that language (Italian when absent). */
  productCountry?: string | null;
  language?: string | null;
}

/** Accesso ai dati e agli effetti collaterali: sostituibile nei test. */
export interface InactivityDeps {
  /** Utenti candidati: ultimo accesso oltre la soglia d'avviso, oppure già avvisati. Esclude chi ha un'eliminazione già programmata. */
  listCandidates(now: Date): Promise<InactivityUser[]>;
  /** Rilegge uno solo, con l'ultimo accesso aggiornato (subito prima di agire); null se non esiste più. */
  reload(userId: string): Promise<InactivityUser | null>;
  /** Prenota l'avviso (solo se non già partito). True se la prenotazione è stata fatta da questa chiamata. */
  claimWarning(userId: string, at: Date): Promise<boolean>;
  /** Annulla la prenotazione quando l'invio fallisce, così il giro dopo riprova. */
  releaseWarning(userId: string): Promise<void>;
  /** Azzera l'avviso di chi ha fatto accesso dopo. */
  clearWarning(userId: string): Promise<void>;
  sendWarning(user: InactivityUser, deletionAt: Date): Promise<boolean>;
  sendDeleted(email: string, userId: string, language?: Language): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  /**
   * Motivo per cui l'account NON va toccato anche se inattivo (null = nessuno). Oggi nessuna regola;
   * qui entrerà l'abbonamento a pagamento attivo o in prova, quando esisterà.
   */
  exemptionReason(userId: string): Promise<string | null>;
}

export interface InactivityResult {
  mode: InactivityRunMode;
  /** Candidati valutati. */
  scanned: number;
  warned: number;
  /** In dry-run: avvisi che sarebbero partiti. */
  wouldWarn: number;
  deleted: number;
  /** In dry-run: account che sarebbero stati eliminati. */
  wouldDelete: number;
  returned: number;
  exempt: number;
  /** Azioni rimandate al giro dopo dal tetto per giro. */
  capped: number;
  failed: number;
}

/** Ultimo accesso effettivo: il più recente tra il campo dell'utente e l'aggiornamento delle sue sessioni (rete di sicurezza se l'hook non scrive). */
function effectiveLastActive(userLastActive: Date, sessionLastUsed: Date | null): Date {
  return sessionLastUsed && sessionLastUsed > userLastActive ? sessionLastUsed : userLastActive;
}

async function lastSessionUse(userIds: string[]): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: authSession.userId, lastUsed: sql<string>`max(${authSession.updatedAt})` })
    .from(authSession)
    .where(inArray(authSession.userId, userIds))
    .groupBy(authSession.userId);
  return new Map(rows.map((row) => [row.userId, new Date(row.lastUsed)]));
}

export const databaseDeps: InactivityDeps = {
  async listCandidates(now) {
    const rows = await db
      .select({ id: authUser.id, email: authUser.email, lastActiveAt: authUser.lastActiveAt, warnedAt: authUser.inactivityWarnedAt, productCountry: authUser.productCountry, language: authUser.language })
      .from(authUser)
      .where(and(isNull(authUser.deletionScheduledAt), or(lte(authUser.lastActiveAt, warningCutoff(now)), isNotNull(authUser.inactivityWarnedAt))));
    const sessions = await lastSessionUse(rows.map((row) => row.id));
    const cutoff = warningCutoff(now);
    return rows
      .map((row) => ({ ...row, lastActiveAt: effectiveLastActive(row.lastActiveAt, sessions.get(row.id) ?? null) }))
      .filter((row) => row.warnedAt || row.lastActiveAt <= cutoff);
  },
  async reload(userId) {
    const [row] = await db
      .select({
        id: authUser.id,
        email: authUser.email,
        lastActiveAt: authUser.lastActiveAt,
        warnedAt: authUser.inactivityWarnedAt,
        scheduled: authUser.deletionScheduledAt,
        productCountry: authUser.productCountry,
        language: authUser.language,
      })
      .from(authUser)
      .where(eq(authUser.id, userId));
    if (!row || row.scheduled) return null;
    const sessions = await lastSessionUse([userId]);
    return {
      id: row.id,
      email: row.email,
      lastActiveAt: effectiveLastActive(row.lastActiveAt, sessions.get(userId) ?? null),
      warnedAt: row.warnedAt,
      productCountry: row.productCountry,
      language: row.language,
    };
  },
  async claimWarning(userId, at) {
    const claimed = await db
      .update(authUser)
      .set({ inactivityWarnedAt: at })
      .where(and(eq(authUser.id, userId), isNull(authUser.inactivityWarnedAt)))
      .returning({ id: authUser.id });
    return claimed.length > 0;
  },
  async releaseWarning(userId) {
    await db.update(authUser).set({ inactivityWarnedAt: null }).where(eq(authUser.id, userId));
  },
  async clearWarning(userId) {
    await db.update(authUser).set({ inactivityWarnedAt: null }).where(eq(authUser.id, userId));
  },
  async sendWarning(user, deletionAt) {
    return sendAccountEmail(user.email, "inactivity_warning", { userId: user.id, deletionAt, lastActiveAt: user.lastActiveAt, language: resolveProfile(user).language });
  },
  async sendDeleted(email, userId, language) {
    await sendAccountEmail(email, "inactivity_deleted", { userId, language });
  },
  deleteAccount: deleteUserAccount,
  async exemptionReason() {
    return null;
  },
};

/**
 * Giro di manutenzione degli account inattivi, in tre passi per ogni candidato (rilegge i dati subito prima di agire):
 * 1. chi ha fatto accesso dopo l'avviso torna normale (`returned`);
 * 2. chi è inattivo da `INACTIVITY_DELETE_AFTER_DAYS - INACTIVITY_WARNING_LEAD_DAYS` giorni riceve l'avviso (una volta sola);
 * 3. chi è stato avvisato da almeno `INACTIVITY_WARNING_LEAD_DAYS` giorni e non è rientrato viene eliminato.
 * In `dry-run` non scrive e non invia nulla. Idempotente: un secondo giro nello stesso giorno non rifà niente.
 * Un errore su un utente non blocca gli altri; se l'avviso non parte, l'utente non può essere eliminato.
 */
export async function runInactiveAccounts(options: {
  mode: InactivityRunMode;
  now?: Date;
  deps?: InactivityDeps;
  log?: Logger;
}): Promise<InactivityResult> {
  const { mode } = options;
  const now = options.now ?? new Date();
  const deps = options.deps ?? databaseDeps;
  const log = options.log ?? defaultLogger;
  const result: InactivityResult = { mode, scanned: 0, warned: 0, wouldWarn: 0, deleted: 0, wouldDelete: 0, returned: 0, exempt: 0, capped: 0, failed: 0 };
  if (mode === "off") return result;
  const metricMode = mode === "execute" ? "execute" : "dry-run";
  const execute = mode === "execute";

  const candidates = await deps.listCandidates(now);
  result.scanned = candidates.length;
  let warnBudget = INACTIVITY_MAX_ACTIONS_PER_RUN;
  let deleteBudget = INACTIVITY_MAX_ACTIONS_PER_RUN;

  for (const candidate of candidates) {
    const user = hashUserId(candidate.id);
    try {
      // Rilettura subito prima di agire: un accesso avvenuto nel frattempo annulla tutto.
      const fresh = await deps.reload(candidate.id);
      if (!fresh) continue;
      const decision = decideInactivity(fresh, now);
      if (decision === "none") continue;

      if (decision === "returned") {
        result.returned += 1;
        recordInactiveAccounts("returned", metricMode);
        if (execute) await deps.clearWarning(fresh.id);
        log.info("account.inactivity.returned", { user, outcome: metricMode });
        continue;
      }

      const reason = await deps.exemptionReason(fresh.id);
      if (reason) {
        result.exempt += 1;
        recordInactiveAccounts("exempt", metricMode);
        log.info("account.inactivity.exempt", { user, reason });
        continue;
      }

      if (decision === "warn") {
        if (warnBudget <= 0) {
          result.capped += 1;
          recordInactiveAccounts("capped", metricMode);
          continue;
        }
        warnBudget -= 1;
        const deletionAt = deletionDueAt(fresh.lastActiveAt, now);
        if (!execute) {
          result.wouldWarn += 1;
          recordInactiveAccounts("warned", metricMode);
          log.info("account.inactivity.warning_dry_run", { user, inactiveDays: inactiveDays(fresh.lastActiveAt, now) });
          continue;
        }
        // Prima si prenota, poi si invia: due giri insieme non mandano due email. Se l'invio fallisce si rilascia.
        if (!(await deps.claimWarning(fresh.id, now))) continue;
        let sent = false;
        try {
          sent = await deps.sendWarning(fresh, deletionAt);
        } catch (error) {
          log.warn("account.inactivity.warning_failed", { user, error });
        }
        if (!sent) {
          await deps.releaseWarning(fresh.id);
          result.failed += 1;
          recordInactiveAccounts("failed", metricMode);
          log.warn("account.inactivity.warning_failed", { user });
          continue;
        }
        result.warned += 1;
        recordInactiveAccounts("warned", metricMode);
        log.info("account.inactivity.warned", { user, inactiveDays: inactiveDays(fresh.lastActiveAt, now) });
        continue;
      }

      // decision === "delete"
      if (deleteBudget <= 0) {
        result.capped += 1;
        recordInactiveAccounts("capped", metricMode);
        continue;
      }
      deleteBudget -= 1;
      if (!execute) {
        result.wouldDelete += 1;
        recordInactiveAccounts("deleted", metricMode);
        log.info("account.inactivity.deletion_dry_run", { user, inactiveDays: inactiveDays(fresh.lastActiveAt, now) });
        continue;
      }
      const days = inactiveDays(fresh.lastActiveAt, now);
      await deps.deleteAccount(fresh.id);
      result.deleted += 1;
      recordInactiveAccounts("deleted", metricMode);
      log.info("account.inactivity.deleted", { user, inactiveDays: days, trigger: "cron" });
      // L'email di conferma è dopo l'eliminazione e non la può annullare: se non parte, resta il log.
      await deps.sendDeleted(fresh.email, fresh.id, resolveProfile(fresh).language);
    } catch (error) {
      result.failed += 1;
      recordInactiveAccounts("failed", metricMode);
      log.error("account.inactivity.failed", { user, error });
    }
  }
  return result;
}
