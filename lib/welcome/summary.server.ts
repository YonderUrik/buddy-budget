import "server-only";
import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userPriceAlerts } from "@/lib/db/schema/investments";
import { personalImportJobs } from "@/lib/db/schema/personal-imports";
import { transactions } from "@/lib/db/schema/transactions";
import { computeAttentionSummary } from "@/lib/attention/summary";
import { loadSubscriptionsView } from "@/lib/subscriptions/data";
import { recentPriceRises } from "@/lib/subscriptions/view";
import type { WelcomeHappened, WelcomeSummary, WelcomeWaiting } from "./types";

/** The away window: from the end of the previous visit to the start of this one (what the user did since is not news). */
export interface AwayWindow {
  since: Date;
  until: Date;
}

/** Movements created while away. */
async function awayMovements(userId: string, { since, until }: AwayWindow): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gt(transactions.createdAt, since), lte(transactions.createdAt, until)));
  return row?.count ?? 0;
}

/** Price alerts that went off while away (the evening price check sets `triggeredAt`). */
async function awayPriceAlerts(userId: string, { since, until }: AwayWindow): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userPriceAlerts)
    .where(and(eq(userPriceAlerts.userId, userId), gt(userPriceAlerts.triggeredAt, since), lte(userPriceAlerts.triggeredAt, until)));
  return row?.count ?? 0;
}

/** File imports stopped on rows to check, still open (not expired). */
async function importsToReview(userId: string, now: Date): Promise<WelcomeWaiting | null> {
  const rows = await db
    .select({ id: personalImportJobs.id })
    .from(personalImportJobs)
    .where(and(eq(personalImportJobs.userId, userId), inArray(personalImportJobs.status, ["review_failed"]), gt(personalImportJobs.expiresAt, now)))
    .orderBy(desc(personalImportJobs.createdAt));
  return rows[0] ? { kind: "import_review", count: rows.length, jobId: rows[0].id } : null;
}

/**
 * Builds the summary for the away window: what happened (movements, price alerts, subscription price rises) and what
 * waits for the user now (movements to decide, subscriptions to confirm, imports with rows to check). Count queries
 * and the subscription detection only; the parts are independent and run together.
 */
export async function computeWelcomeSummary(userId: string, window: AwayWindow, now: Date = new Date()): Promise<WelcomeSummary> {
  const sinceDay = window.since.toISOString().slice(0, 10);
  const [movements, alerts, attention, subscriptions, imports] = await Promise.all([
    awayMovements(userId, window),
    awayPriceAlerts(userId, window),
    computeAttentionSummary(userId),
    loadSubscriptionsView(userId, now),
    importsToReview(userId, now),
  ]);

  // A rise counts if it was first seen after the previous visit.
  const rises = recentPriceRises(subscriptions.view.items, subscriptions.today).filter((item) => item.priceChange && item.priceChange.since > sinceDay).length;

  const happened: WelcomeHappened[] = [
    ...(movements > 0 ? [{ kind: "movements" as const, count: movements }] : []),
    ...(alerts > 0 ? [{ kind: "price_alerts" as const, count: alerts }] : []),
    ...(rises > 0 ? [{ kind: "price_rises" as const, count: rises }] : []),
  ];
  const waiting: WelcomeWaiting[] = [
    ...(attention.uncategorizedCount > 0 ? [{ kind: "to_decide" as const, count: attention.uncategorizedCount }] : []),
    ...(subscriptions.view.totals.pendingCount > 0 ? [{ kind: "subscriptions" as const, count: subscriptions.view.totals.pendingCount }] : []),
    ...(imports ? [imports] : []),
  ];
  return { since: window.since.toISOString(), happened, waiting };
}

