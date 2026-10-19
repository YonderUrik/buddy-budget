import "server-only";
import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, userPriceAlerts } from "@/lib/db/schema/investments";
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

/** Movements created while away, with income and spending net of their excluded parts. */
async function awayMovements(userId: string, { since, until }: AwayWindow): Promise<WelcomeHappened | null> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      income: sql<string>`coalesce(sum(${transactions.amount} - ${transactions.excludedAmount}) filter (where ${transactions.amount} > 0), 0)`,
      expenses: sql<string>`coalesce(sum(abs(${transactions.amount}) - abs(${transactions.excludedAmount})) filter (where ${transactions.amount} < 0), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gt(transactions.createdAt, since), lte(transactions.createdAt, until)));
  if (!row || row.count === 0) return null;
  return { kind: "movements", count: row.count, income: Number(row.income), expenses: Number(row.expenses) };
}

/** Price alerts that went off while away (the evening price check sets `triggeredAt`). */
async function awayPriceAlerts(userId: string, { since, until }: AwayWindow): Promise<WelcomeHappened | null> {
  const rows = await db
    .select({ name: instruments.name, currency: instruments.currency, direction: userPriceAlerts.direction, price: userPriceAlerts.triggeredPrice })
    .from(userPriceAlerts)
    .innerJoin(instruments, eq(instruments.id, userPriceAlerts.instrumentId))
    .where(and(eq(userPriceAlerts.userId, userId), gt(userPriceAlerts.triggeredAt, since), lte(userPriceAlerts.triggeredAt, until)))
    .orderBy(desc(userPriceAlerts.triggeredAt));
  const first = rows[0];
  if (!first) return null;
  return { kind: "price_alerts", count: rows.length, first: { name: first.name, direction: first.direction, price: Number(first.price ?? 0), currency: first.currency } };
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

  // A rise counts if it was first seen after the previous visit, most recent first.
  const rises = recentPriceRises(subscriptions.view.items, subscriptions.today)
    .filter((item) => item.priceChange && item.priceChange.since > sinceDay)
    .sort((a, b) => (b.priceChange?.since ?? "").localeCompare(a.priceChange?.since ?? ""));
  const firstRise = rises[0];

  const happened: WelcomeHappened[] = [
    ...(movements ? [movements] : []),
    ...(alerts ? [alerts] : []),
    ...(firstRise?.priceChange
      ? [{ kind: "price_rises" as const, count: rises.length, first: { name: firstRise.name, from: firstRise.priceChange.from, to: firstRise.priceChange.to } }]
      : []),
  ];
  const waiting: WelcomeWaiting[] = [
    ...(attention.uncategorizedCount > 0 ? [{ kind: "to_decide" as const, count: attention.uncategorizedCount }] : []),
    ...(subscriptions.view.totals.pendingCount > 0 ? [{ kind: "subscriptions" as const, count: subscriptions.view.totals.pendingCount }] : []),
    ...(imports ? [imports] : []),
  ];
  return { since: window.since.toISOString(), happened, waiting };
}

/** The user's currency, for formatting the amounts of the summary. */
export async function userCurrency(userId: string): Promise<string> {
  const [row] = await db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)).limit(1);
  return row?.currency ?? "EUR";
}
