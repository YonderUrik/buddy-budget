import "server-only";
import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import {
  householdAccounts,
  householdInvites,
  householdMembers,
  households,
  householdSettlements,
  householdSplitRules,
  householdSplits,
} from "@/lib/db/schema/households";
import { transactions } from "@/lib/db/schema/transactions";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { computeBalances, settleUp } from "./balance";
import { INVITE_TTL_DAYS, MAX_HOUSEHOLD_MEMBERS, MAX_HOUSEHOLDS_PER_USER } from "./constants";
import { householdIdsOf, isHouseholdMember, loadSharedExpenses } from "./data";
import { hashInviteToken, newInviteToken } from "./tokens";
import type { TransactionHouseholdChoice } from "./types";

/** Writes of groups. Each one checks membership and ownership itself; the routes only parse and answer. */

/** What a member shows the group, as the sharing form sends it. */
export interface SharingChoice {
  sharesNetWorth: boolean;
  accountIds: string[];
}

/** A predictable refusal, turned into an HTTP answer by the route. */
export class HouseholdError extends Error {
  constructor(
    readonly code: "not_found" | "limit_groups" | "limit_members" | "invite_invalid" | "already_member" | "not_owner",
    message: string
  ) {
    super(message);
  }
}

/** Keeps only the viewer's own, non-demo accounts among the ids sent. */
async function ownAccountIds(userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isDemo, false), inArray(accounts.id, ids)));
  return rows.map((r) => r.id);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Replaces what the member shows the group with the choice sent. */
async function writeSharing(tx: Tx, userId: string, householdId: string, choice: SharingChoice, accountIds: string[]) {
  await tx.update(householdMembers).set({ sharesNetWorth: choice.sharesNetWorth }).where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
  await tx.delete(householdAccounts).where(and(eq(householdAccounts.householdId, householdId), eq(householdAccounts.userId, userId)));
  if (accountIds.length > 0) await tx.insert(householdAccounts).values(accountIds.map((accountId) => ({ householdId, accountId, userId })));
}

/** Creates a group with its creator as the first member and their sharing choice. */
export async function createHousehold(userId: string, name: string, choice: SharingChoice): Promise<string> {
  if ((await householdIdsOf(userId)).length >= MAX_HOUSEHOLDS_PER_USER) {
    throw new HouseholdError("limit_groups", `Puoi stare al massimo in ${MAX_HOUSEHOLDS_PER_USER} gruppi`);
  }
  const accountIds = await ownAccountIds(userId, choice.accountIds);
  return db.transaction(async (tx) => {
    const [group] = await tx.insert(households).values({ name, createdBy: userId }).returning({ id: households.id });
    await tx.insert(householdMembers).values({ householdId: group.id, userId });
    await writeSharing(tx, userId, group.id, choice, accountIds);
    return group.id;
  });
}

/** Changes what the viewer shows a group (and, when sent, its name). */
export async function updateHousehold(userId: string, householdId: string, input: { name?: string; sharing?: SharingChoice }) {
  if (!(await isHouseholdMember(userId, householdId))) throw new HouseholdError("not_found", "Gruppo non trovato");
  const accountIds = input.sharing ? await ownAccountIds(userId, input.sharing.accountIds) : [];
  await db.transaction(async (tx) => {
    if (input.name) await tx.update(households).set({ name: input.name, updatedAt: new Date() }).where(eq(households.id, householdId));
    if (input.sharing) await writeSharing(tx, userId, householdId, input.sharing, accountIds);
  });
}

/**
 * The viewer leaves the group: what they shared stops being visible at once, their expense choices and rules for it
 * go, and a group left empty is deleted with its invitations.
 */
export async function leaveHousehold(userId: string, householdId: string): Promise<{ deleted: boolean }> {
  if (!(await isHouseholdMember(userId, householdId))) throw new HouseholdError("not_found", "Gruppo non trovato");
  return db.transaction(async (tx) => {
    await tx.delete(householdAccounts).where(and(eq(householdAccounts.householdId, householdId), eq(householdAccounts.userId, userId)));
    await tx.delete(householdSplits).where(and(eq(householdSplits.householdId, householdId), eq(householdSplits.userId, userId)));
    await tx.delete(householdSplitRules).where(and(eq(householdSplitRules.householdId, householdId), eq(householdSplitRules.userId, userId)));
    await tx.delete(householdMembers).where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
    const [{ left }] = await tx.select({ left: count() }).from(householdMembers).where(eq(householdMembers.householdId, householdId));
    if (left === 0) {
      await tx.delete(households).where(eq(households.id, householdId));
      return { deleted: true };
    }
    return { deleted: false };
  });
}

/** New invitation link for a group; returns the token (only here: the database keeps its hash). */
export async function createInvite(userId: string, householdId: string, email: string | null): Promise<{ token: string; inviteId: string }> {
  if (!(await isHouseholdMember(userId, householdId))) throw new HouseholdError("not_found", "Gruppo non trovato");
  const [{ members }] = await db.select({ members: count() }).from(householdMembers).where(eq(householdMembers.householdId, householdId));
  if (members >= MAX_HOUSEHOLD_MEMBERS) throw new HouseholdError("limit_members", `Un gruppo ha al massimo ${MAX_HOUSEHOLD_MEMBERS} persone`);
  const { token, hash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const [row] = await db.insert(householdInvites).values({ householdId, invitedBy: userId, email, tokenHash: hash, expiresAt }).returning({ id: householdInvites.id });
  return { token, inviteId: row.id };
}

/** Withdraws a pending invitation of a group the viewer is in. */
export async function revokeInvite(userId: string, householdId: string, inviteId: string) {
  if (!(await isHouseholdMember(userId, householdId))) throw new HouseholdError("not_found", "Gruppo non trovato");
  await db
    .update(householdInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(householdInvites.id, inviteId), eq(householdInvites.householdId, householdId), isNull(householdInvites.acceptedAt)));
}

/** What the invitation page shows before accepting: who invites, to which group, who is in it. */
export interface InvitePreview {
  status: "valid" | "expired" | "used";
  householdId: string;
  householdName: string;
  inviterName: string;
  memberNames: string[];
}

/** Looks up an invitation by its token; null when no invitation has that token. */
export async function loadInvitePreview(token: string): Promise<InvitePreview | null> {
  const [invite] = await db.select().from(householdInvites).where(eq(householdInvites.tokenHash, hashInviteToken(token)));
  if (!invite) return null;
  const [[group], [inviter], members] = await Promise.all([
    db.select({ name: households.name }).from(households).where(eq(households.id, invite.householdId)),
    db.select({ name: authUser.name }).from(authUser).where(eq(authUser.id, invite.invitedBy)),
    db.select({ name: authUser.name }).from(householdMembers).innerJoin(authUser, eq(authUser.id, householdMembers.userId)).where(eq(householdMembers.householdId, invite.householdId)),
  ]);
  if (!group) return null;
  const status = invite.acceptedAt || invite.revokedAt ? "used" : invite.expiresAt <= new Date() ? "expired" : "valid";
  const first = (n: string) => n.trim().split(/\s+/)[0] || n;
  return { status, householdId: invite.householdId, householdName: group.name, inviterName: first(inviter?.name ?? ""), memberNames: members.map((m) => first(m.name)) };
}

/** Accepts an invitation: the viewer joins the group with their sharing choice. Returns the group id. */
export async function acceptInvite(userId: string, token: string, choice: SharingChoice): Promise<string> {
  const hash = hashInviteToken(token);
  const accountIds = await ownAccountIds(userId, choice.accountIds);
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(householdInvites)
      .where(and(eq(householdInvites.tokenHash, hash), isNull(householdInvites.acceptedAt), isNull(householdInvites.revokedAt), gt(householdInvites.expiresAt, new Date())))
      .for("update");
    if (!invite) throw new HouseholdError("invite_invalid", "Questo invito non vale più: chiedine uno nuovo");
    const members = await tx.select({ userId: householdMembers.userId }).from(householdMembers).where(eq(householdMembers.householdId, invite.householdId));
    if (members.some((m) => m.userId === userId)) throw new HouseholdError("already_member", "Sei già in questo gruppo");
    if (members.length >= MAX_HOUSEHOLD_MEMBERS) throw new HouseholdError("limit_members", `Un gruppo ha al massimo ${MAX_HOUSEHOLD_MEMBERS} persone`);
    const [{ groups }] = await tx.select({ groups: count() }).from(householdMembers).where(eq(householdMembers.userId, userId));
    if (groups >= MAX_HOUSEHOLDS_PER_USER) throw new HouseholdError("limit_groups", `Puoi stare al massimo in ${MAX_HOUSEHOLDS_PER_USER} gruppi`);
    await tx.insert(householdMembers).values({ householdId: invite.householdId, userId });
    await writeSharing(tx, userId, invite.householdId, choice, accountIds);
    await tx.update(householdInvites).set({ acceptedAt: new Date(), acceptedBy: userId }).where(eq(householdInvites.id, invite.id));
    return invite.householdId;
  });
}

/** «Pareggiate»: records the fewest payments that bring the group to zero. Returns how many were written. */
export async function settleHousehold(userId: string, householdId: string): Promise<number> {
  if (!(await isHouseholdMember(userId, householdId))) throw new HouseholdError("not_found", "Gruppo non trovato");
  const members = await db.select({ userId: householdMembers.userId }).from(householdMembers).where(eq(householdMembers.householdId, householdId));
  const memberIds = members.map((m) => m.userId);
  const shared = await db.select({ accountId: householdAccounts.accountId }).from(householdAccounts).where(eq(householdAccounts.householdId, householdId));
  const [expenses, settlements] = await Promise.all([
    loadSharedExpenses(householdId, memberIds, new Set(shared.map((s) => s.accountId))),
    db.select().from(householdSettlements).where(eq(householdSettlements.householdId, householdId)),
  ]);
  const balances = computeBalances(
    memberIds,
    expenses.map((e) => ({ payerId: e.userId, amount: e.amount })),
    settlements.map((s) => ({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: Number(s.amount) }))
  );
  const transfers = settleUp(balances);
  if (transfers.length > 0) {
    await db.insert(householdSettlements).values(transfers.map((t) => ({ householdId, fromUserId: t.fromUserId, toUserId: t.toUserId, amount: t.amount.toFixed(2), createdBy: userId })));
  }
  return transfers.length;
}

/** The viewer's own expense, or null (someone else's, income, a transfer). */
async function ownExpense(userId: string, transactionId: string) {
  const [row] = await db
    .select({ id: transactions.id, accountId: transactions.accountId, description: transactions.description, date: transactions.date, amount: transactions.amount, type: categories.type })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  return row ?? null;
}

/** Who pays an expense, for its detail: the explicit choice, the rule that would decide, or the shared account. */
export async function loadTransactionChoice(userId: string, transactionId: string): Promise<TransactionHouseholdChoice | null> {
  const expense = await ownExpense(userId, transactionId);
  if (!expense) return null;
  const [[explicit], rules, onShared] = await Promise.all([
    db.select().from(householdSplits).where(and(eq(householdSplits.transactionId, transactionId), eq(householdSplits.userId, userId))),
    db.select().from(householdSplitRules).where(and(eq(householdSplitRules.userId, userId), eq(householdSplitRules.merchantKey, merchantKey(expense.description)))),
    db.select({ householdId: householdAccounts.householdId }).from(householdAccounts).where(eq(householdAccounts.accountId, expense.accountId)),
  ]);
  const rule = rules.find((r) => expense.date >= r.fromDate) ?? null;
  if (explicit) return { householdId: explicit.householdId, source: "manuale", ruleHouseholdId: rules[0]?.householdId ?? null, onSharedAccount: onShared.length > 0 };
  return { householdId: rule?.householdId ?? null, source: rule ? "regola" : null, ruleHouseholdId: rules[0]?.householdId ?? null, onSharedAccount: onShared.length > 0 };
}

/**
 * Sets who pays an expense: a group (equal parts) or only the viewer (`householdId` null). `rule` decides the merchant's
 * later expenses: «set» makes them follow this choice (a rule from this expense's date, or none for «solo mia»),
 * «clear» drops the merchant's rule, «keep» leaves it as it is (a one-off exception).
 */
export async function setTransactionChoice(userId: string, transactionId: string, householdId: string | null, rule: "set" | "clear" | "keep") {
  const expense = await ownExpense(userId, transactionId);
  if (!expense || Number(expense.amount) >= 0 || expense.type === "trasferimento") throw new HouseholdError("not_found", "Movimento non trovato");
  if (householdId && !(await isHouseholdMember(userId, householdId))) throw new HouseholdError("not_found", "Gruppo non trovato");
  const key = merchantKey(expense.description);
  await db.transaction(async (tx) => {
    await tx
      .insert(householdSplits)
      .values({ transactionId, userId, householdId })
      .onConflictDoUpdate({ target: householdSplits.transactionId, set: { householdId, createdAt: new Date() } });
    if (rule === "keep" || !key) return;
    await tx.delete(householdSplitRules).where(and(eq(householdSplitRules.userId, userId), eq(householdSplitRules.merchantKey, key)));
    if (rule === "set" && householdId) await tx.insert(householdSplitRules).values({ userId, householdId, merchantKey: key, fromDate: expense.date });
  });
}

/** HTTP answer for a predictable refusal. */
export function householdErrorResponse(error: unknown): Response | null {
  if (!(error instanceof HouseholdError)) return null;
  const status = error.code === "not_found" ? 404 : error.code === "invite_invalid" ? 410 : 409;
  return Response.json({ code: error.code, error: error.message }, { status });
}
