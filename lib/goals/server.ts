import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { goals, goalSources } from "@/lib/db/schema/goals";
import { investmentTransactions } from "@/lib/db/schema/investments";

/** Parte da salvare: conto o titolo, con l'importo assegnato. */
export interface GoalSourceInput {
  accountId?: string | null;
  instrumentId?: string | null;
  amount: number;
}

/** Transazione di Drizzle (o il client stesso) su cui scrivere. */
type Writer = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Controlla che conti e titoli siano dell'utente (i titoli: almeno un'operazione sua) e che nessuno compaia due volte.
 * Restituisce un messaggio d'errore da mostrare, o null se va tutto bene.
 */
export async function checkGoalSources(userId: string, sources: GoalSourceInput[]): Promise<string | null> {
  const accountIds = sources.flatMap((s) => (s.accountId ? [s.accountId] : []));
  const instrumentIds = sources.flatMap((s) => (s.instrumentId ? [s.instrumentId] : []));
  if (new Set(accountIds).size !== accountIds.length || new Set(instrumentIds).size !== instrumentIds.length) return "Ogni conto o titolo può comparire una volta sola";
  if (accountIds.length > 0) {
    const owned = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));
    if (owned.length !== accountIds.length) return "Conto non trovato";
  }
  if (instrumentIds.length > 0) {
    const owned = await db
      .selectDistinct({ id: investmentTransactions.instrumentId })
      .from(investmentTransactions)
      .where(and(eq(investmentTransactions.userId, userId), inArray(investmentTransactions.instrumentId, instrumentIds)));
    if (owned.length !== instrumentIds.length) return "Titolo non trovato";
  }
  return null;
}

/** Sostituisce tutte le parti assegnate a un obiettivo. */
export async function replaceGoalSources(tx: Writer, userId: string, goalId: string, sources: GoalSourceInput[]): Promise<void> {
  await tx.delete(goalSources).where(eq(goalSources.goalId, goalId));
  if (sources.length === 0) return;
  await tx.insert(goalSources).values(
    sources.map((s) => ({ goalId, userId, accountId: s.accountId ?? null, instrumentId: s.instrumentId ?? null, amount: s.amount.toFixed(2) })),
  );
}

/** Quanti obiettivi ha l'utente (per il limite `MAX_GOALS`). */
export async function countGoals(userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(goals).where(eq(goals.userId, userId));
  return row?.n ?? 0;
}

/** Obiettivo dell'utente, o null se non esiste o è di qualcun altro. */
export async function ownedGoal(userId: string, id: string) {
  const [row] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  return row ?? null;
}
