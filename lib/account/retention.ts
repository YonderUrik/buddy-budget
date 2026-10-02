import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authSession, authVerification } from "@/lib/db/schema/auth";

/** Esito della pulizia dei dati di accesso scaduti. */
export interface AuthRetentionResult {
  sessions: number;
  verifications: number;
}

/**
 * Elimina i dati di accesso già scaduti: sessioni (con IP e user agent) e token di verifica dei link di accesso.
 * Non servono più a niente e trattenerli oltre la scadenza violerebbe la minimizzazione. Idempotente.
 */
export async function purgeExpiredAuthData(now: Date = new Date()): Promise<AuthRetentionResult> {
  const sessions = await db.delete(authSession).where(lt(authSession.expiresAt, now)).returning({ id: authSession.id });
  const verifications = await db
    .delete(authVerification)
    .where(lt(authVerification.expiresAt, now))
    .returning({ id: authVerification.id });
  return { sessions: sessions.length, verifications: verifications.length };
}
