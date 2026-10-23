import "server-only";
import { and, asc, count, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import {
  householdAccounts,
  householdExpenses,
  householdInvites,
  householdMembers,
  households,
  householdSettlements,
  householdSplitRules,
  householdSplits,
} from "@/lib/db/schema/households";
import { transactions } from "@/lib/db/schema/transactions";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { settleUp } from "./balance";
import { INVITE_TTL_DAYS, MAX_HOUSEHOLD_MEMBERS, MAX_HOUSEHOLDS_PER_USER } from "./constants";
import { householdIdsOf, loadGroupLedger, loadPeople, memberIdOf } from "./data";
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
    readonly code: "not_found" | "limit_groups" | "limit_members" | "invite_invalid" | "already_member" | "not_owner" | "invalid_people",
    message: string
  ) {
    super(message);
  }
}

const notFound = () => new HouseholdError("not_found", "Gruppo non trovato");
const tooMany = () => new HouseholdError("limit_members", `Un gruppo ha al massimo ${MAX_HOUSEHOLD_MEMBERS} persone`);
const tooManyGroups = () => new HouseholdError("limit_groups", `Puoi stare al massimo in ${MAX_HOUSEHOLDS_PER_USER} gruppi`);

/** The viewer's member id in the group; refuses when they are not in it. */
async function requireMember(userId: string, householdId: string): Promise<string> {
  const id = await memberIdOf(userId, householdId);
  if (!id) throw notFound();
  return id;
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

/**
 * Who an expense is for, checked against the group: null (everyone) stays null, a list keeps only members and
 * collapses to null when it names everyone. Refuses an empty choice.
 */
async function checkForIds(householdId: string, forIds: string[] | null | undefined): Promise<string[] | null> {
  if (!forIds) return null;
  const members = await db.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.householdId, householdId));
  const ids = new Set(members.map((m) => m.id));
  const kept = [...new Set(forIds)].filter((id) => ids.has(id));
  if (kept.length === 0) throw new HouseholdError("invalid_people", "Scegli almeno una persona");
  return kept.length === ids.size ? null : kept;
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
  if ((await householdIdsOf(userId)).length >= MAX_HOUSEHOLDS_PER_USER) throw tooManyGroups();
  const accountIds = await ownAccountIds(userId, choice.accountIds);
  return db.transaction(async (tx) => {
    const [group] = await tx.insert(households).values({ name, createdBy: userId }).returning({ id: households.id });
    await tx.insert(householdMembers).values({ householdId: group.id, userId, addedBy: userId, joinedAt: new Date() });
    await writeSharing(tx, userId, group.id, choice, accountIds);
    return group.id;
  });
}

/** Changes what the viewer shows a group (and, when sent, its name). */
export async function updateHousehold(userId: string, householdId: string, input: { name?: string; sharing?: SharingChoice }) {
  await requireMember(userId, householdId);
  const accountIds = input.sharing ? await ownAccountIds(userId, input.sharing.accountIds) : [];
  await db.transaction(async (tx) => {
    if (input.name) await tx.update(households).set({ name: input.name, updatedAt: new Date() }).where(eq(households.id, householdId));
    if (input.sharing) await writeSharing(tx, userId, householdId, input.sharing, accountIds);
  });
}

/**
 * The viewer leaves the group: what they shared stops being visible at once, their expense choices and rules for it
 * go, and a group with nobody left on BuddyBudget is deleted (with the people added by name and the invitations).
 */
export async function leaveHousehold(userId: string, householdId: string): Promise<{ deleted: boolean }> {
  await requireMember(userId, householdId);
  return db.transaction(async (tx) => {
    await tx.delete(householdAccounts).where(and(eq(householdAccounts.householdId, householdId), eq(householdAccounts.userId, userId)));
    await tx.delete(householdSplits).where(and(eq(householdSplits.householdId, householdId), eq(householdSplits.userId, userId)));
    await tx.delete(householdSplitRules).where(and(eq(householdSplitRules.householdId, householdId), eq(householdSplitRules.userId, userId)));
    await tx.delete(householdMembers).where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
    const [{ left }] = await tx.select({ left: count() }).from(householdMembers).where(and(eq(householdMembers.householdId, householdId), isNotNull(householdMembers.userId)));
    if (left === 0) {
      await tx.delete(households).where(eq(households.id, householdId));
      return { deleted: true };
    }
    return { deleted: false };
  });
}

/** Adds someone by name, without an account: the group can split expenses with them at once. Returns their member id. */
export async function addPerson(userId: string, householdId: string, name: string): Promise<string> {
  await requireMember(userId, householdId);
  return db.transaction(async (tx) => {
    const [{ members }] = await tx.select({ members: count() }).from(householdMembers).where(eq(householdMembers.householdId, householdId));
    if (members >= MAX_HOUSEHOLD_MEMBERS) throw tooMany();
    const [row] = await tx.insert(householdMembers).values({ householdId, displayName: name, addedBy: userId }).returning({ id: householdMembers.id });
    return row.id;
  });
}

/** A person added by name, not yet on BuddyBudget; refuses anyone else. */
async function requirePlaceholder(householdId: string, memberId: string) {
  const [row] = await db
    .select({ id: householdMembers.id, userId: householdMembers.userId })
    .from(householdMembers)
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.householdId, householdId)));
  if (!row) throw new HouseholdError("not_found", "Persona non trovata");
  if (row.userId) throw new HouseholdError("already_member", "Questa persona è già nel gruppo con il suo account");
  return row;
}

/** Removes someone added by name, with the expenses written as paid by them and their invitation. */
export async function removePerson(userId: string, householdId: string, memberId: string) {
  await requireMember(userId, householdId);
  await requirePlaceholder(householdId, memberId);
  await db.delete(householdMembers).where(eq(householdMembers.id, memberId));
}

/**
 * New invitation link for someone added by name (it replaces their previous open one); returns the token (only here:
 * the database keeps its hash).
 */
export async function createInvite(userId: string, householdId: string, memberId: string, email: string | null): Promise<{ token: string; inviteId: string }> {
  await requireMember(userId, householdId);
  await requirePlaceholder(householdId, memberId);
  const { token, hash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  return db.transaction(async (tx) => {
    await tx
      .update(householdInvites)
      .set({ revokedAt: new Date() })
      .where(and(eq(householdInvites.memberId, memberId), isNull(householdInvites.acceptedAt), isNull(householdInvites.revokedAt)));
    const [row] = await tx.insert(householdInvites).values({ householdId, memberId, invitedBy: userId, email, tokenHash: hash, expiresAt }).returning({ id: householdInvites.id });
    return { token, inviteId: row.id };
  });
}

/** Withdraws a pending invitation of a group the viewer is in. */
export async function revokeInvite(userId: string, householdId: string, inviteId: string) {
  await requireMember(userId, householdId);
  await db
    .update(householdInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(householdInvites.id, inviteId), eq(householdInvites.householdId, householdId), isNull(householdInvites.acceptedAt)));
}

/** What the invitation page shows before accepting: who invites, to which group, as whom, who else is in it. */
export interface InvitePreview {
  status: "valid" | "expired" | "used";
  householdId: string;
  householdName: string;
  inviterName: string;
  /** The name the invited person was added with («Luca»). */
  personName: string;
  memberNames: string[];
  /** Expenses already written for the invited person. */
  expenseCount: number;
}

const first = (n: string) => n.trim().split(/\s+/)[0] || n;

/** Looks up an invitation by its token; null when no invitation has that token. */
export async function loadInvitePreview(token: string): Promise<InvitePreview | null> {
  const [invite] = await db.select().from(householdInvites).where(eq(householdInvites.tokenHash, hashInviteToken(token)));
  if (!invite) return null;
  const [[group], [inviter], members, written] = await Promise.all([
    db.select({ name: households.name }).from(households).where(eq(households.id, invite.householdId)),
    db.select({ name: authUser.name }).from(authUser).where(eq(authUser.id, invite.invitedBy)),
    db
      .select({ id: householdMembers.id, accountName: authUser.name, displayName: householdMembers.displayName })
      .from(householdMembers)
      .leftJoin(authUser, eq(authUser.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, invite.householdId))
      .orderBy(asc(householdMembers.createdAt)),
    db.select({ paidBy: householdExpenses.paidByMemberId, forIds: householdExpenses.forMemberIds }).from(householdExpenses).where(eq(householdExpenses.householdId, invite.householdId)),
  ]);
  if (!group) return null;
  const person = members.find((m) => m.id === invite.memberId);
  const status = invite.acceptedAt || invite.revokedAt || !person ? "used" : invite.expiresAt <= new Date() ? "expired" : "valid";
  return {
    status,
    householdId: invite.householdId,
    householdName: group.name,
    inviterName: first(inviter?.name ?? ""),
    personName: first(person?.displayName ?? ""),
    memberNames: members.filter((m) => m.id !== invite.memberId).map((m) => first(m.accountName ?? m.displayName ?? "")),
    expenseCount: written.filter((w) => w.paidBy === invite.memberId || !w.forIds || w.forIds.includes(invite.memberId)).length,
  };
}

/**
 * Accepts an invitation: the viewer takes the place of the person added by name (with the expenses already written
 * for them) and makes their sharing choice. Returns the group id.
 */
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
    const members = await tx.select({ id: householdMembers.id, userId: householdMembers.userId }).from(householdMembers).where(eq(householdMembers.householdId, invite.householdId));
    if (members.some((m) => m.userId === userId)) throw new HouseholdError("already_member", "Sei già in questo gruppo");
    const place = members.find((m) => m.id === invite.memberId);
    if (!place || place.userId) throw new HouseholdError("invite_invalid", "Questo invito non vale più: chiedine uno nuovo");
    const [{ groups }] = await tx.select({ groups: count() }).from(householdMembers).where(eq(householdMembers.userId, userId));
    if (groups >= MAX_HOUSEHOLDS_PER_USER) throw tooManyGroups();
    // The name typed by whoever added them is not needed any more: the account's name takes over.
    await tx.update(householdMembers).set({ userId, displayName: null, joinedAt: new Date() }).where(eq(householdMembers.id, place.id));
    await writeSharing(tx, userId, invite.householdId, choice, accountIds);
    await tx.update(householdInvites).set({ acceptedAt: new Date(), acceptedBy: userId }).where(eq(householdInvites.id, invite.id));
    return invite.householdId;
  });
}

/** «Pareggiate»: records the fewest payments that bring the group to zero. Returns how many were written. */
export async function settleHousehold(userId: string, householdId: string): Promise<number> {
  await requireMember(userId, householdId);
  const people = await loadPeople(householdId, userId);
  const { balances } = await loadGroupLedger(householdId, people);
  const transfers = settleUp(balances);
  if (transfers.length > 0) {
    await db.insert(householdSettlements).values(transfers.map((t) => ({ householdId, fromMemberId: t.from, toMemberId: t.to, amount: t.amount.toFixed(2), createdBy: userId })));
  }
  return transfers.length;
}

/** An expense written in the group, as the form sends it. */
export interface GroupExpenseInput {
  description: string;
  amount: number;
  date: string;
  paidByMemberId: string;
  forMemberIds: string[] | null;
  categoryId: string | null;
}

/** Checks the payer and the category of an expense written in the group. */
async function checkGroupExpense(userId: string, householdId: string, input: GroupExpenseInput) {
  const [payer] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(and(eq(householdMembers.id, input.paidByMemberId), eq(householdMembers.householdId, householdId)));
  if (!payer) throw new HouseholdError("invalid_people", "Chi ha pagato non è nel gruppo");
  const forMemberIds = await checkForIds(householdId, input.forMemberIds);
  let categoryId: string | null = null;
  if (input.categoryId) {
    const [own] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
    categoryId = own?.id ?? null;
  }
  return { forMemberIds, categoryId };
}

/** «Aggiungi una spesa»: writes an expense in the group. Returns its id. */
export async function createGroupExpense(userId: string, householdId: string, input: GroupExpenseInput): Promise<string> {
  await requireMember(userId, householdId);
  const { forMemberIds, categoryId } = await checkGroupExpense(userId, householdId, input);
  const [row] = await db
    .insert(householdExpenses)
    .values({ householdId, paidByMemberId: input.paidByMemberId, amount: input.amount.toFixed(2), description: input.description, date: input.date, categoryId, forMemberIds, createdBy: userId })
    .returning({ id: householdExpenses.id });
  return row.id;
}

/** Changes an expense written in the group (any member can). */
export async function updateGroupExpense(userId: string, householdId: string, expenseId: string, input: GroupExpenseInput) {
  await requireMember(userId, householdId);
  const { forMemberIds, categoryId } = await checkGroupExpense(userId, householdId, input);
  const updated = await db
    .update(householdExpenses)
    .set({ paidByMemberId: input.paidByMemberId, amount: input.amount.toFixed(2), description: input.description, date: input.date, categoryId, forMemberIds, updatedAt: new Date() })
    .where(and(eq(householdExpenses.id, expenseId), eq(householdExpenses.householdId, householdId)))
    .returning({ id: householdExpenses.id });
  if (updated.length === 0) throw new HouseholdError("not_found", "Spesa non trovata");
}

/** Deletes an expense written in the group (any member can). */
export async function deleteGroupExpense(userId: string, householdId: string, expenseId: string) {
  await requireMember(userId, householdId);
  await db.delete(householdExpenses).where(and(eq(householdExpenses.id, expenseId), eq(householdExpenses.householdId, householdId)));
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
  const base = { ruleHouseholdId: rules[0]?.householdId ?? null, onSharedAccount: onShared.length > 0 };
  if (explicit) return { householdId: explicit.householdId, forMemberIds: explicit.forMemberIds ?? null, source: "manuale", ...base };
  return { householdId: rule?.householdId ?? null, forMemberIds: rule?.forMemberIds ?? null, source: rule ? "regola" : null, ...base };
}

/**
 * Sets who pays an expense: a group, for everyone or only some people (also only someone else: paid entirely for
 * them), or only the viewer (`householdId` null). `rule` decides the merchant's later expenses: «set» makes them
 * follow this choice (a rule from this expense's date, or none for «solo mia»), «clear» drops the merchant's rule,
 * «keep» leaves it as it is (a one-off exception).
 */
export async function setTransactionChoice(userId: string, transactionId: string, householdId: string | null, forIds: string[] | null, rule: "set" | "clear" | "keep") {
  const expense = await ownExpense(userId, transactionId);
  if (!expense || Number(expense.amount) >= 0 || expense.type === "trasferimento") throw new HouseholdError("not_found", "Movimento non trovato");
  if (householdId) await requireMember(userId, householdId);
  const forMemberIds = householdId ? await checkForIds(householdId, forIds) : null;
  const key = merchantKey(expense.description);
  await db.transaction(async (tx) => {
    await tx
      .insert(householdSplits)
      .values({ transactionId, userId, householdId, forMemberIds })
      .onConflictDoUpdate({ target: householdSplits.transactionId, set: { householdId, forMemberIds, createdAt: new Date() } });
    if (rule === "keep" || !key) return;
    await tx.delete(householdSplitRules).where(and(eq(householdSplitRules.userId, userId), eq(householdSplitRules.merchantKey, key)));
    if (rule === "set" && householdId) await tx.insert(householdSplitRules).values({ userId, householdId, merchantKey: key, fromDate: expense.date, forMemberIds });
  });
}

/** HTTP answer for a predictable refusal. */
export function householdErrorResponse(error: unknown): Response | null {
  if (!(error instanceof HouseholdError)) return null;
  const status = error.code === "not_found" ? 404 : error.code === "invite_invalid" ? 410 : error.code === "invalid_people" ? 400 : 409;
  return Response.json({ code: error.code, error: error.message }, { status });
}
