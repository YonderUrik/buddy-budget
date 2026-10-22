import "server-only";
import { asc, eq } from "drizzle-orm";
import { loadAnalyticsDigest, type AnalyticsDigest } from "@/lib/analitiche/digest";
import { db } from "@/lib/db/client";
import { goals, goalSources, type Goal, type GoalSource } from "@/lib/db/schema/goals";
import { buildGoalsView, type GoalRecord, type GoalSourceRecord, type GoalsView } from "./view";

/** Obiettivo dal database alla forma della vista. */
export function toGoalRecord(row: Goal): GoalRecord {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    target: Number(row.targetAmount),
    targetDate: row.targetDate,
    monthly: Number(row.monthlyAmount),
    priority: row.priority,
    achievedAt: row.achievedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Parte assegnata dal database alla forma della vista. */
export function toGoalSourceRecord(row: GoalSource): GoalSourceRecord {
  return { id: row.id, goalId: row.goalId, accountId: row.accountId, instrumentId: row.instrumentId, amount: Number(row.amount) };
}

/** Obiettivi e parti assegnate dell'utente, senza calcoli. */
export async function loadGoalRows(userId: string): Promise<{ goals: GoalRecord[]; sources: GoalSourceRecord[] }> {
  const [goalRows, sourceRows] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.priority), asc(goals.createdAt)),
    db.select().from(goalSources).where(eq(goalSources.userId, userId)),
  ]);
  return { goals: goalRows.map(toGoalRecord), sources: sourceRows.map(toGoalSourceRecord) };
}

/** Builds the Goals view from rows already read and the Analytics digest. */
export function goalsViewFrom(digest: AnalyticsDigest, rows: { goals: GoalRecord[]; sources: GoalSourceRecord[] }): GoalsView {
  return buildGoalsView({
    currency: digest.currency,
    todayKey: digest.todayKey,
    goals: rows.goals,
    sources: rows.sources,
    accounts: digest.accounts,
    positions: digest.positions,
    capacity: digest.capacity,
    fire: digest.fire,
    essential: digest.essential,
    debtsTotal: digest.debtsTotal,
  });
}

/**
 * Full Goals view of the user, with the same data and assumptions as Analitiche. The goals themselves are always read
 * fresh; the plan behind them comes from the cached digest (`loadAnalyticsDigest`).
 */
export async function loadGoalsView(userId: string, now = new Date()): Promise<GoalsView> {
  const [digest, rows] = await Promise.all([loadAnalyticsDigest(userId, now), loadGoalRows(userId)]);
  return goalsViewFrom(digest, rows);
}
