import "server-only";
import { asc, eq } from "drizzle-orm";
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from "@/lib/analitiche/snapshot";
import { db } from "@/lib/db/client";
import { goals, goalSources, type Goal, type GoalSource } from "@/lib/db/schema/goals";
import { buildGoalsView, type GoalRecord, type GoalSourceRecord, type GoalsView } from "./view";
import type { FireInput } from "./plan";

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

/** Dati del confronto con il traguardo: servono spesa e risparmio, come nelle Analitiche. */
function fireInput(snapshot: AnalyticsSnapshot): FireInput | null {
  const { plan, assumptions } = snapshot;
  if (plan.target === null || plan.savings === null) return null;
  return { wealth: plan.wealth, annualSavings: plan.savings, realReturn: assumptions.expectedReturn, target: plan.target };
}

/** Costruisce la vista degli obiettivi da righe già lette e da una fotografia delle Analitiche. */
export function goalsViewFrom(snapshot: AnalyticsSnapshot, rows: { goals: GoalRecord[]; sources: GoalSourceRecord[] }): GoalsView {
  const { base, plan } = snapshot;
  return buildGoalsView({
    currency: snapshot.currency,
    todayKey: snapshot.todayKey,
    goals: rows.goals,
    sources: rows.sources,
    accounts: snapshot.accounts,
    positions: base.positions.map((p) => ({ id: p.id, name: p.name, value: p.value, unrealizedGain: p.unrealizedGain, taxRate: p.taxRate, type: base.instrumentTypes[p.id] })),
    capacity: plan.savings === null ? null : plan.savings / 12,
    fire: fireInput(snapshot),
    essential: snapshot.essential,
    debtsTotal: base.wealth.debts,
  });
}

/** Vista completa degli obiettivi dell'utente, con gli stessi dati e le stesse ipotesi delle Analitiche. */
export async function loadGoalsView(userId: string, now = new Date()): Promise<GoalsView> {
  const [snapshot, rows] = await Promise.all([loadAnalyticsSnapshot(userId, now), loadGoalRows(userId)]);
  return goalsViewFrom(snapshot, rows);
}
