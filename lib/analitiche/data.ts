import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyticsAssumptions } from "@/lib/db/schema/analytics";
import { resolveAssumptions, type AnalyticsAssumptions, type AssumptionsResponse } from "./assumptions";

/** Ipotesi dell'utente (con i default dove manca qualcosa) e se ha già visto la guida. */
export async function loadAssumptions(userId: string): Promise<AssumptionsResponse> {
  const [row] = await db.select().from(analyticsAssumptions).where(eq(analyticsAssumptions.userId, userId));
  return { assumptions: resolveAssumptions(row?.data), walkthroughSeen: row?.walkthroughSeenAt != null };
}

/** Salva le ipotesi complete (già unite e validate). */
export async function saveAssumptions(userId: string, assumptions: AnalyticsAssumptions): Promise<void> {
  const now = new Date();
  await db
    .insert(analyticsAssumptions)
    .values({ userId, data: assumptions as unknown as Record<string, unknown>, updatedAt: now })
    .onConflictDoUpdate({ target: analyticsAssumptions.userId, set: { data: assumptions as unknown as Record<string, unknown>, updatedAt: now } });
}

/** Segna la guida come vista (chiusa o completata). */
export async function markWalkthroughSeen(userId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(analyticsAssumptions)
    .values({ userId, walkthroughSeenAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: analyticsAssumptions.userId, set: { walkthroughSeenAt: now, updatedAt: now } });
}
