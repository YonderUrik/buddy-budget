import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { LEGAL_VERSION } from "./version";

/** Registra che l'utente ha accettato la versione in vigore dei documenti legali (data e versione sul profilo). */
export async function recordLegalAcceptance(userId: string, now: Date = new Date()): Promise<void> {
  await db
    .update(authUser)
    .set({ legalAcceptedAt: now, legalAcceptedVersion: LEGAL_VERSION, updatedAt: now })
    .where(eq(authUser.id, userId));
}
