import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { analyticsAssumptions } from "@/lib/db/schema/analytics";
import { authUser } from "@/lib/db/schema/auth";
import { budgets } from "@/lib/db/schema/budgets";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { transactions } from "@/lib/db/schema/transactions";
import { START_STEP_IDS, type StartStatus, type StartStepId } from "./steps";

/** True se l'account contiene conti di esempio (e quindi, per costruzione, nessun conto vero). */
export async function hasDemoData(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isDemo, true)))
    .limit(1);
  return row != null;
}

/**
 * Stato dei primi passi, calcolato dai dati veri (i conti e i movimenti di esempio non contano). Alla prima volta che
 * risulta completo registra l'istante e lo segnala con `justCompleted`.
 */
export async function loadStartStatus(userId: string): Promise<StartStatus> {
  const [user] = await db
    .select({ dismissedAt: authUser.startChecklistDismissedAt, completedAt: authUser.startChecklistCompletedAt })
    .from(authUser)
    .where(eq(authUser.id, userId));
  const [row] = await db.execute<{ conto: boolean; import: boolean; investimento: boolean; obiettivo: boolean; demo: boolean }>(sql`
    select
      exists(select 1 from ${accounts} where ${accounts.userId} = ${userId} and not ${accounts.isDemo}) as conto,
      exists(
        select 1 from ${transactions} t join ${accounts} a on a.id = t.account_id
        where t.user_id = ${userId} and t.source = 'auto' and not a.is_demo
      ) as import,
      exists(select 1 from ${investmentTransactions} where ${investmentTransactions.userId} = ${userId}) as investimento,
      (
        exists(select 1 from ${budgets} where ${budgets.userId} = ${userId})
        or exists(select 1 from ${analyticsAssumptions} where ${analyticsAssumptions.userId} = ${userId} and ${analyticsAssumptions.data} <> '{}'::jsonb)
      ) as obiettivo,
      exists(select 1 from ${accounts} where ${accounts.userId} = ${userId} and ${accounts.isDemo}) as demo
  `);
  const steps = Object.fromEntries(START_STEP_IDS.map((id) => [id, row[id as StartStepId] === true])) as Record<StartStepId, boolean>;
  const completed = START_STEP_IDS.every((id) => steps[id]);
  let justCompleted = false;
  if (completed && !user?.completedAt) {
    await db.update(authUser).set({ startChecklistCompletedAt: new Date() }).where(eq(authUser.id, userId));
    justCompleted = true;
  }
  return { steps, dismissed: user?.dismissedAt != null, completed, demoActive: row.demo === true, ...(justCompleted ? { justCompleted } : {}) };
}

/** Chiude o riapre la checklist. */
export async function setChecklistDismissed(userId: string, dismissed: boolean): Promise<void> {
  await db
    .update(authUser)
    .set({ startChecklistDismissedAt: dismissed ? new Date() : null })
    .where(eq(authUser.id, userId));
}

