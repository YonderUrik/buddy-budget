import "server-only";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authAccount, authSession } from "@/lib/db/schema/auth";
import { LOCAL_MODE_PROVIDER_ID } from "@/lib/selfhost/local-mode";
import { describeUserAgent, formatDevice } from "./user-agent";

/** Sessione attiva come la vede la pagina Impostazioni: niente token né indirizzo IP. */
export interface UserSessionView {
  id: string;
  device: string;
  browser: string;
  os: string;
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
        browser: device.browser,
        os: device.os,
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

/** Sign-in providers linked to the user (e.g. "google"). The email magic link creates no rows; the self-hosting mode marker is not a sign-in method and is left out. */
export async function listLinkedProviders(userId: string): Promise<string[]> {
  const rows = await db.select({ providerId: authAccount.providerId }).from(authAccount).where(and(eq(authAccount.userId, userId), ne(authAccount.providerId, LOCAL_MODE_PROVIDER_ID)));
  return [...new Set(rows.map((row) => row.providerId))];
}
