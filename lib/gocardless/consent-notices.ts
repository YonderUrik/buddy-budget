import "server-only";
import { and, count, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { hashUserId, logger } from "@/lib/observability";
import { sendConsentEmail } from "./consent-emails";
import { CONSENT_EXPIRY_WARNING_DAYS } from "./connection-health";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Oltre questo tempo dalla scadenza non si manda più l'avviso "scaduto": l'utente ha lasciato perdere e la pulizia se ne occupa. */
const EXPIRED_NOTICE_MAX_AGE_DAYS = 30;
/** Tetto di email per esecuzione (e per tipo): protegge da un picco al primo giro dopo il deploy. */
export const MAX_NOTICES_PER_RUN = 50;

/**
 * Segna `expired` le connessioni `linked` con consenso oltre la scadenza: in questo modo il sync automatico
 * le salta senza aspettare un 401 e l'utente le vede da rinnovare. Restituisce quante ne ha segnate.
 */
export async function markExpiredConnections(now: Date): Promise<number> {
  const rows = await db
    .update(bankConnections)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(bankConnections.status, "linked"), lte(bankConnections.consentExpiresAt, now)))
    .returning({ id: bankConnections.id });
  if (rows.length > 0) logger.info("gocardless.consent.expired_marked", { count: rows.length });
  return rows.length;
}

/** Connessioni con conti collegati e utente attivo che devono ricevere ancora l'avviso `kind`. */
async function findNoticeTargets(kind: "expiring" | "expired", now: Date) {
  const base = and(isNull(authUser.deletionScheduledAt));
  const condition =
    kind === "expiring"
      ? and(
          base,
          eq(bankConnections.status, "linked"),
          isNull(bankConnections.expiryWarningSentAt),
          gt(bankConnections.consentExpiresAt, now),
          lte(bankConnections.consentExpiresAt, new Date(now.getTime() + CONSENT_EXPIRY_WARNING_DAYS * DAY_MS))
        )
      : and(
          base,
          eq(bankConnections.status, "expired"),
          isNull(bankConnections.expiredNoticeSentAt),
          or(
            isNull(bankConnections.consentExpiresAt),
            gt(bankConnections.consentExpiresAt, new Date(now.getTime() - EXPIRED_NOTICE_MAX_AGE_DAYS * DAY_MS))
          )
        );
  const rows = await db
    .select({
      id: bankConnections.id,
      userId: bankConnections.userId,
      email: authUser.email,
      institutionName: bankConnections.institutionName,
      consentExpiresAt: bankConnections.consentExpiresAt,
      links: count(bankAccountLinks.id),
    })
    .from(bankConnections)
    .innerJoin(authUser, eq(bankConnections.userId, authUser.id))
    .leftJoin(bankAccountLinks, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(condition)
    .groupBy(bankConnections.id, authUser.email)
    .limit(MAX_NOTICES_PER_RUN);
  // Una connessione senza conti (rinnovata o conto eliminato) non ha nulla da rinnovare.
  return rows.filter((row) => row.links > 0);
}

/**
 * Manda l'email di consenso in scadenza (7 giorni prima) e di consenso scaduto, una sola volta per
 * connessione e per fase. Segna l'avviso come inviato solo se l'email è partita. Restituisce i conteggi.
 */
export async function sendConsentNotices(now: Date): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const kind of ["expiring", "expired"] as const) {
    for (const target of await findNoticeTargets(kind, now)) {
      const ok = await sendConsentEmail(target.email, kind, {
        userId: target.userId,
        institutionName: target.institutionName,
        expiresAt: target.consentExpiresAt,
      });
      if (!ok) {
        failed += 1;
        continue;
      }
      sent += 1;
      await db
        .update(bankConnections)
        .set(kind === "expiring" ? { expiryWarningSentAt: now } : { expiredNoticeSentAt: now })
        .where(eq(bankConnections.id, target.id));
      logger.info("gocardless.consent_notice.recorded", { user: hashUserId(target.userId), connectionId: target.id, reason: kind });
    }
  }
  return { sent, failed };
}
