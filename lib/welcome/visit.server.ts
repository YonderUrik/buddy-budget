import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { VISIT_GAP_MS, VISIT_TOUCH_THROTTLE_MS, type VisitState } from "./visit";

const VISIT_COLUMNS = {
  appSeenAt: authUser.appSeenAt,
  visitStartedAt: authUser.visitStartedAt,
  visitSinceAt: authUser.visitSinceAt,
  welcomeDismissedAt: authUser.welcomeDismissedAt,
};

/**
 * Records that the app is open now and returns the visit state, with `newVisit` when this heartbeat started a visit.
 * One conditional UPDATE (every SET reads the old row), so two tabs or a heartbeat racing the summary request cannot
 * start two visits; heartbeats within `VISIT_TOUCH_THROTTLE_MS` only read. Same rule as `nextVisitState`.
 */
export async function touchVisit(userId: string, now: Date = new Date()): Promise<{ state: VisitState; newVisit: boolean } | null> {
  // Raw SQL parameters go as ISO strings: postgres-js does not serialise a Date inside `sql`.
  const at = (date: Date) => sql`${date.toISOString()}::timestamptz`;
  const gapStart = at(new Date(now.getTime() - VISIT_GAP_MS));
  const throttleStart = at(new Date(now.getTime() - VISIT_TOUCH_THROTTLE_MS));
  const isNewVisit = sql`(${authUser.appSeenAt} is null or ${authUser.appSeenAt} < ${gapStart})`;
  const [updated] = await db
    .update(authUser)
    .set({
      visitSinceAt: sql`case when ${authUser.appSeenAt} < ${gapStart} then ${authUser.appSeenAt} else ${authUser.visitSinceAt} end`,
      visitStartedAt: sql`case when ${isNewVisit} then ${at(now)} else ${authUser.visitStartedAt} end`,
      appSeenAt: now,
    })
    .where(sql`${authUser.id} = ${userId} and (${authUser.appSeenAt} is null or ${authUser.appSeenAt} < ${throttleStart})`)
    .returning(VISIT_COLUMNS);
  if (updated) return { state: updated, newVisit: updated.visitStartedAt?.getTime() === now.getTime() };
  const [current] = await db.select(VISIT_COLUMNS).from(authUser).where(eq(authUser.id, userId)).limit(1);
  return current ? { state: current, newVisit: false } : null;
}

/** Closes the summary until the next visit. */
export async function dismissWelcome(userId: string, now: Date = new Date()): Promise<void> {
  await db.update(authUser).set({ welcomeDismissedAt: now }).where(eq(authUser.id, userId));
}
