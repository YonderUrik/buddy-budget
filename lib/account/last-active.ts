import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { hashUserId, logger } from "@/lib/observability";

/**
 * Segna l'utente come attivo adesso e annulla un eventuale avviso «account inattivo» già partito.
 * Best effort: un errore viene loggato e non blocca mai l'accesso (il cron ha comunque la sessione come riserva).
 */
export async function touchLastActive(userId: string, now: Date = new Date()): Promise<void> {
  try {
    await db.update(authUser).set({ lastActiveAt: now, inactivityWarnedAt: null }).where(eq(authUser.id, userId));
  } catch (error) {
    logger.warn("account.last_active.failed", { user: hashUserId(userId), error });
  }
}
