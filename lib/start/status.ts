import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { analyticsAssumptions } from "@/lib/db/schema/analytics";
import { authUser } from "@/lib/db/schema/auth";
import { budgets } from "@/lib/db/schema/budgets";
import { debts } from "@/lib/db/schema/debts";
import { goals } from "@/lib/db/schema/goals";
import { householdMembers } from "@/lib/db/schema/households";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { pensionFunds } from "@/lib/db/schema/pension";
import { transactions } from "@/lib/db/schema/transactions";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { START_FOCUS_IDS, START_STEP_IDS, UNSKIPPABLE_STEPS, allStepsSettled, startStepsFor, type StartFocus, type StartStatus, type StartStepId } from "./steps";

/** True se l'account contiene conti di esempio (e quindi, per costruzione, nessun conto vero). */
export async function hasDemoData(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isDemo, true)))
    .limit(1);
  return row != null;
}

/** Keeps only known focus values, so a stale value in the database never breaks the checklist. */
export function parseStartFocus(raw: readonly string[] | null | undefined): StartFocus[] | null {
  if (!raw) return null;
  return START_FOCUS_IDS.filter((id) => raw.includes(id));
}

/** Keeps only known, skippable step ids from the database. */
export function parseSkippedSteps(raw: readonly string[] | null | undefined): StartStepId[] {
  return START_STEP_IDS.filter((id) => raw?.includes(id) && !UNSKIPPABLE_STEPS.includes(id));
}

/** Marks a step as skipped («Non mi serve») or brings it back. */
export async function setStepSkipped(userId: string, step: StartStepId, skipped: boolean): Promise<void> {
  const [row] = await db.select({ skipped: authUser.startSkipped }).from(authUser).where(eq(authUser.id, userId));
  const current = new Set(parseSkippedSteps(row?.skipped));
  if (skipped && !UNSKIPPABLE_STEPS.includes(step)) current.add(step);
  else current.delete(step);
  await db.update(authUser).set({ startSkipped: START_STEP_IDS.filter((id) => current.has(id)) }).where(eq(authUser.id, userId));
}

/**
 * First-steps state, computed from real data (sample accounts and transactions do not count). The steps asked follow
 * the focus chosen in onboarding. The first time all of them are done it records the moment and flags `justCompleted`.
 */
export async function loadStartStatus(userId: string): Promise<StartStatus> {
  const [user] = await db
    .select({
      dismissedAt: authUser.startChecklistDismissedAt,
      completedAt: authUser.startChecklistCompletedAt,
      focus: authUser.startFocus,
      skipped: authUser.startSkipped,
      productCountry: authUser.productCountry,
    })
    .from(authUser)
    .where(eq(authUser.id, userId));
  const [row] = await db.execute<Record<StartStepId, boolean> & { demo: boolean }>(sql`
    select
      exists(select 1 from ${accounts} where ${accounts.userId} = ${userId} and not ${accounts.isDemo}) as conto,
      exists(
        select 1 from ${transactions} t join ${accounts} a on a.id = t.account_id
        where t.user_id = ${userId} and not a.is_demo
      ) as import,
      exists(select 1 from ${investmentTransactions} where ${investmentTransactions.userId} = ${userId}) as investimento,
      exists(select 1 from ${debts} where ${debts.userId} = ${userId}) as debito,
      exists(select 1 from ${pensionFunds} where ${pensionFunds.userId} = ${userId}) as pensione,
      (
        exists(select 1 from ${budgets} where ${budgets.userId} = ${userId})
        or exists(select 1 from ${goals} where ${goals.userId} = ${userId})
        or exists(select 1 from ${analyticsAssumptions} where ${analyticsAssumptions.userId} = ${userId} and ${analyticsAssumptions.data} <> '{}'::jsonb)
      ) as obiettivo,
      exists(select 1 from ${householdMembers} where ${householdMembers.userId} = ${userId}) as gruppo,
      exists(select 1 from ${accounts} where ${accounts.userId} = ${userId} and ${accounts.isDemo}) as demo
  `);
  const steps = Object.fromEntries(START_STEP_IDS.map((id) => [id, row[id as StartStepId] === true])) as Record<StartStepId, boolean>;
  const focus = parseStartFocus(user?.focus);
  const stepIds = startStepsFor(focus, { pensionAvailable: isCountryPathAvailable(user?.productCountry ?? "IT", "/pensione") });
  const skipped = parseSkippedSteps(user?.skipped);
  // The group step came after many people had finished: for whoever already completed the checklist it does not count,
  // so it never brings the checklist back (Panoramica offers groups on its own).
  const required = user?.completedAt ? stepIds.filter((id) => id !== "gruppo") : stepIds;
  const completed = allStepsSettled(steps, required, skipped);
  let justCompleted = false;
  if (completed && !user?.completedAt) {
    await db.update(authUser).set({ startChecklistCompletedAt: new Date() }).where(eq(authUser.id, userId));
    justCompleted = true;
  }
  return { steps, stepIds, focus, skipped, dismissed: user?.dismissedAt != null, completed, demoActive: row.demo === true, ...(justCompleted ? { justCompleted } : {}) };
}

/** Saves what the user wants to keep an eye on (onboarding or the checklist's «Cambia»). */
export async function setStartFocus(userId: string, focus: readonly StartFocus[]): Promise<void> {
  await db.update(authUser).set({ startFocus: [...focus] }).where(eq(authUser.id, userId));
}

/** Chiude o riapre la checklist. */
export async function setChecklistDismissed(userId: string, dismissed: boolean): Promise<void> {
  await db
    .update(authUser)
    .set({ startChecklistDismissedAt: dismissed ? new Date() : null })
    .where(eq(authUser.id, userId));
}

