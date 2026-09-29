import "server-only";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authAccount, authSession } from "@/lib/db/schema/auth";
import { describeUserAgent, formatDevice } from "./user-agent";

/** Sessione attiva come la vede la pagina Impostazioni: niente token né indirizzo IP. */
export interface UserSessionView {
  id: string;
  device: string;
  mobile: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

/** Sessioni non scadute dell'utente, la corrente per prima, poi dalla più recente. */
export async function listUserSessions(userId: string, currentSessionId: string, now: Date = new Date()): Promise<UserSessionView[]> {
  const rows = await db
    .select({
      id: authSession.id,
      userAgent: authSession.userAgent,
      createdAt: authSession.createdAt,
      updatedAt: authSession.updatedAt,
      expiresAt: authSession.expiresAt,
    })
    .from(authSession)
    .where(and(eq(authSession.userId, userId), gt(authSession.expiresAt, now)))
    .orderBy(desc(authSession.updatedAt));
  return rows
    .map((row) => {
      const device = describeUserAgent(row.userAgent);
      return {
        id: row.id,
        device: formatDevice(device),
        mobile: device.mobile,
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: row.updatedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        current: row.id === currentSessionId,
      };
    })
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** Chiude una sessione dell'utente (mai di un altro). True se esisteva. */
export async function revokeUserSession(userId: string, sessionId: string): Promise<boolean> {
  const deleted = await db
    .delete(authSession)
    .where(and(eq(authSession.id, sessionId), eq(authSession.userId, userId)))
    .returning({ id: authSession.id });
  return deleted.length > 0;
}

/** Chiude tutte le sessioni dell'utente tranne quella corrente. Restituisce quante ne ha chiuse. */
export async function revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
  const deleted = await db
    .delete(authSession)
    .where(and(eq(authSession.userId, userId), ne(authSession.id, currentSessionId)))
    .returning({ id: authSession.id });
  return deleted.length;
}

/** Provider di accesso collegati all'utente (es. "google"). Il magic link via email non crea righe: è sempre disponibile. */
export async function listLinkedProviders(userId: string): Promise<string[]> {
  const rows = await db.select({ providerId: authAccount.providerId }).from(authAccount).where(eq(authAccount.userId, userId));
  return [...new Set(rows.map((row) => row.providerId))];
}
