import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte } from "drizzle-orm";
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
import { loadSidebarSummary } from "@/lib/sidebar/summary";
import { computeBalances, expenseEffect, participantsOf, settleUp, type SharedExpense } from "./balance";
import { looksLikeHouseholdAccount } from "./constants";
import type {
  HouseholdAccountRow,
  HouseholdAccountTransaction,
  HouseholdExpenseEntry,
  HouseholdOverview,
  HouseholdPerson,
  HouseholdSettings,
  HouseholdSpendingRow,
  HouseholdSummary,
} from "./types";

/**
 * Reads of groups. Every function takes the viewer's id and checks they are a member before reading anything of the
 * others; the others' rows are read only through what they shared (accounts in `household_accounts`, expenses they
 * marked as common, their net worth total when `sharesNetWorth`).
 */

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** A member with the fields only the server needs. */
type PersonRow = HouseholdPerson & { sharesNetWorth: boolean; joinedAt: Date | null };

/**
 * Members of a group in order of arrival, the viewer first (slot 0). People without an account carry the name they
 * were added with; once they join, their account's name.
 */
export async function loadPeople(householdId: string, viewerId: string): Promise<PersonRow[]> {
  const rows = await db
    .select({
      id: householdMembers.id,
      userId: householdMembers.userId,
      accountName: authUser.name,
      displayName: householdMembers.displayName,
      sharesNetWorth: householdMembers.sharesNetWorth,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .leftJoin(authUser, eq(authUser.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(asc(householdMembers.createdAt));
  const ordered = [...rows.filter((r) => r.userId === viewerId), ...rows.filter((r) => r.userId !== viewerId)];
  return ordered.map((r, slot) => {
    const name = firstName(r.accountName ?? r.displayName ?? "?");
    return {
      id: r.id,
      userId: r.userId,
      name,
      initial: name.charAt(0).toUpperCase(),
      isMe: r.userId === viewerId,
      slot,
      sharesNetWorth: r.userId !== null && r.sharesNetWorth,
      joinedAt: r.joinedAt,
    };
  });
}

/** A member without the fields only the server needs. */
export const toPerson = (p: HouseholdPerson): HouseholdPerson => ({ id: p.id, userId: p.userId, name: p.name, initial: p.initial, isMe: p.isMe, slot: p.slot });

/** The viewer's member id in a group, or null when they are not in it. */
export async function memberIdOf(userId: string, householdId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
  return row?.id ?? null;
}

/** True when the user is a member of the group. */
export async function isHouseholdMember(userId: string, householdId: string): Promise<boolean> {
  return (await memberIdOf(userId, householdId)) !== null;
}

/** Ids of the groups the user is in. */
export async function householdIdsOf(userId: string): Promise<string[]> {
  const rows = await db.select({ id: householdMembers.householdId }).from(householdMembers).where(eq(householdMembers.userId, userId));
  return rows.map((r) => r.id);
}

/** Open invitations of a group (not accepted, not withdrawn, not expired). */
const openInvite = (householdIds: string[]) =>
  and(inArray(householdInvites.householdId, householdIds), isNull(householdInvites.acceptedAt), isNull(householdInvites.revokedAt), gt(householdInvites.expiresAt, new Date()));

/** The user's groups with their members, in order of creation. */
export async function listHouseholds(userId: string): Promise<HouseholdSummary[]> {
  const ids = await householdIdsOf(userId);
  if (ids.length === 0) return [];
  const [groups, pending] = await Promise.all([
    db.select({ id: households.id, name: households.name, createdAt: households.createdAt }).from(households).where(inArray(households.id, ids)).orderBy(asc(households.createdAt)),
    db.select({ householdId: householdInvites.householdId }).from(householdInvites).where(openInvite(ids)),
  ]);
  return Promise.all(
    groups.map(async (g) => ({
      id: g.id,
      name: g.name,
      members: (await loadPeople(g.id, userId)).map(toPerson),
      pendingInvites: pending.filter((p) => p.householdId === g.id).length,
    }))
  );
}

/** The viewer's accounts with what they show this group (`householdId` null = a group being created). */
export async function loadShareableAccounts(userId: string, householdId: string | null) {
  const [own, shared] = await Promise.all([
    db
      .select({ id: accounts.id, name: accounts.name, icon: accounts.icon, color: accounts.color, balance: accounts.balance })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isDemo, false)))
      .orderBy(asc(accounts.createdAt)),
    householdId
      ? db.select({ accountId: householdAccounts.accountId }).from(householdAccounts).where(and(eq(householdAccounts.householdId, householdId), eq(householdAccounts.userId, userId)))
      : Promise.resolve([]),
  ]);
  const sharedIds = new Set(shared.map((s) => s.accountId));
  return own.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    color: a.color,
    balance: Number(a.balance),
    shared: sharedIds.has(a.id),
    suggested: looksLikeHouseholdAccount(a.name),
  }));
}

/** The group page: members (with the open invitation of people added by name) and what the viewer shares. */
export async function loadHouseholdSettings(userId: string, householdId: string): Promise<HouseholdSettings | null> {
  if (!(await isHouseholdMember(userId, householdId))) return null;
  const [[group], people, invites, sharedCounts, mineAccounts] = await Promise.all([
    db.select({ id: households.id, name: households.name }).from(households).where(eq(households.id, householdId)),
    loadPeople(householdId, userId),
    db
      .select({ id: householdInvites.id, memberId: householdInvites.memberId, email: householdInvites.email, expiresAt: householdInvites.expiresAt })
      .from(householdInvites)
      .where(openInvite([householdId]))
      .orderBy(desc(householdInvites.createdAt)),
    db.select({ userId: householdAccounts.userId }).from(householdAccounts).where(eq(householdAccounts.householdId, householdId)),
    loadShareableAccounts(userId, householdId),
  ]);
  if (!group) return null;
  const me = people.find((p) => p.isMe)!;
  return {
    id: group.id,
    name: group.name,
    members: people.map((p) => {
      const invite = p.userId ? undefined : invites.find((i) => i.memberId === p.id);
      return {
        ...toPerson(p),
        sharesNetWorth: p.sharesNetWorth,
        sharedAccounts: sharedCounts.filter((s) => s.userId !== null && s.userId === p.userId).length,
        invite: invite ? { id: invite.id, email: invite.email, expiresAt: invite.expiresAt.toISOString() } : null,
      };
    }),
    mine: { sharesNetWorth: me.sharesNetWorth, accounts: mineAccounts },
  };
}

/** Accounts shown to the group, with the member id of their owner. */
async function loadSharedAccounts(householdId: string, people: readonly HouseholdPerson[]): Promise<HouseholdAccountRow[]> {
  const rows = await db
    .select({ id: accounts.id, name: accounts.name, icon: accounts.icon, color: accounts.color, balance: accounts.balance, ownerUserId: householdAccounts.userId, updatedAt: accounts.updatedAt })
    .from(householdAccounts)
    .innerJoin(accounts, and(eq(accounts.id, householdAccounts.accountId), eq(accounts.userId, householdAccounts.userId)))
    .where(eq(householdAccounts.householdId, householdId))
    .orderBy(asc(householdAccounts.createdAt));
  return rows.flatMap((r) => {
    const owner = people.find((p) => p.userId === r.ownerUserId);
    return owner ? [{ id: r.id, name: r.name, icon: r.icon, color: r.color, balance: Number(r.balance), ownerId: owner.id, updatedAt: r.updatedAt.toISOString() }] : [];
  });
}

/** An expense row with what the group screens need. */
interface ExpenseRow {
  id: string;
  userId: string;
  accountId: string;
  date: string;
  amount: number;
  description: string;
  createdAt: Date;
  category: { name: string; icon: string; color: string; type: string };
}

/** Expenses (no income, no transfers) of the given members, optionally only some ids or from a date. */
async function loadExpenses(userIds: string[], filter: { ids?: string[]; from?: string; to?: string; accountIds?: string[] }): Promise<ExpenseRow[]> {
  if (userIds.length === 0) return [];
  if (filter.ids && filter.ids.length === 0) return [];
  if (filter.accountIds && filter.accountIds.length === 0) return [];
  const rows = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      description: transactions.description,
      createdAt: transactions.createdAt,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      type: categories.type,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        inArray(transactions.userId, userIds),
        filter.ids ? inArray(transactions.id, filter.ids) : undefined,
        filter.accountIds ? inArray(transactions.accountId, filter.accountIds) : undefined,
        filter.from ? gte(transactions.date, filter.from) : undefined,
        filter.to ? lte(transactions.date, filter.to) : undefined
      )
    );
  return rows
    .filter((r) => Number(r.amount) < 0 && r.type !== "trasferimento" && r.type !== "entrata")
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      accountId: r.accountId,
      date: r.date,
      amount: -Number(r.amount),
      description: r.description,
      createdAt: r.createdAt,
      category: { name: r.name, icon: r.icon, color: r.color, type: r.type },
    }));
}

/** An expense that counts in the group's balance, from someone's bank or written in the group. */
export interface SharedRow {
  id: string;
  kind: "movimento" | "gruppo";
  /** Member id of who paid it. */
  payerId: string;
  /** Account owner, for a bank expense. */
  ownerUserId: string | null;
  date: string;
  amount: number;
  description: string;
  createdAt: Date;
  forIds: string[] | null;
  category: { id: string | null; name: string; icon: string; color: string } | null;
}

/** «Altro» for expenses written in the group without a category. */
const OTHER_CATEGORY = { id: null, name: "Altro", icon: "package", color: "slate" } as const;

/**
 * Expenses that count in the group's balance: members' own expenses they marked for it or that a merchant rule sends
 * to it (from the rule's date, unless they chose otherwise on that expense), and expenses written in the group.
 * Expenses on accounts shown to the group are not here: that money is already common.
 */
export async function loadSharedExpenses(householdId: string, people: readonly HouseholdPerson[], sharedAccountIds: Set<string>): Promise<SharedRow[]> {
  const userIds = people.flatMap((p) => (p.userId ? [p.userId] : []));
  const memberOfUser = new Map(people.flatMap((p) => (p.userId ? [[p.userId, p.id] as const] : [])));
  const [explicit, rules, written] = await Promise.all([
    userIds.length > 0 ? db.select().from(householdSplits).where(inArray(householdSplits.userId, userIds)) : Promise.resolve([]),
    userIds.length > 0 ? db.select().from(householdSplitRules).where(and(eq(householdSplitRules.householdId, householdId), inArray(householdSplitRules.userId, userIds))) : Promise.resolve([]),
    db
      .select({ expense: householdExpenses, name: categories.name, icon: categories.icon, color: categories.color })
      .from(householdExpenses)
      .leftJoin(categories, eq(categories.id, householdExpenses.categoryId))
      .where(eq(householdExpenses.householdId, householdId)),
  ]);
  const chosen = new Map(explicit.map((e) => [e.transactionId, e]));
  const explicitIds = explicit.filter((e) => e.householdId === householdId).map((e) => e.transactionId);
  const bank = new Map<string, { row: ExpenseRow; forIds: string[] | null }>();
  for (const row of await loadExpenses(userIds, { ids: explicitIds })) bank.set(row.id, { row, forIds: chosen.get(row.id)?.forMemberIds ?? null });
  if (rules.length > 0) {
    const from = rules.map((r) => r.fromDate).sort()[0];
    for (const row of await loadExpenses([...new Set(rules.map((r) => r.userId))], { from })) {
      if (chosen.has(row.id) || bank.has(row.id)) continue;
      const key = merchantKey(row.description);
      const rule = rules.find((r) => r.userId === row.userId && r.merchantKey === key && row.date >= r.fromDate);
      if (rule) bank.set(row.id, { row, forIds: rule.forMemberIds ?? null });
    }
  }
  const fromBank: SharedRow[] = [...bank.values()]
    .filter(({ row }) => !sharedAccountIds.has(row.accountId) && memberOfUser.has(row.userId))
    .map(({ row, forIds }) => ({
      id: row.id,
      kind: "movimento",
      payerId: memberOfUser.get(row.userId)!,
      ownerUserId: row.userId,
      date: row.date,
      amount: row.amount,
      description: row.description,
      createdAt: row.createdAt,
      forIds,
      category: { id: null, name: row.category.name, icon: row.category.icon, color: row.category.color },
    }));
  const fromGroup: SharedRow[] = written.map(({ expense, name, icon, color }) => ({
    id: expense.id,
    kind: "gruppo",
    payerId: expense.paidByMemberId,
    ownerUserId: null,
    date: expense.date,
    amount: Number(expense.amount),
    description: expense.description,
    createdAt: expense.createdAt,
    forIds: expense.forMemberIds ?? null,
    category: name ? { id: expense.categoryId, name, icon: icon ?? OTHER_CATEGORY.icon, color: color ?? OTHER_CATEGORY.color } : { ...OTHER_CATEGORY },
  }));
  return [...fromBank, ...fromGroup];
}

const toShared = (row: SharedRow): SharedExpense => ({ payerId: row.payerId, amount: row.amount, forIds: row.forIds });

/** Balances of a group from its shared expenses and settlements, with the settlements in order. */
export async function loadGroupLedger(householdId: string, people: readonly HouseholdPerson[]) {
  const sharedAccounts = await loadSharedAccounts(householdId, people);
  const [shared, settlements] = await Promise.all([
    loadSharedExpenses(householdId, people, new Set(sharedAccounts.map((a) => a.id))),
    db.select().from(householdSettlements).where(eq(householdSettlements.householdId, householdId)).orderBy(asc(householdSettlements.createdAt)),
  ]);
  const memberIds = people.map((p) => p.id);
  const balances = computeBalances(
    memberIds,
    shared.map(toShared),
    settlements.map((s) => ({ from: s.fromMemberId, to: s.toMemberId, amount: Number(s.amount) }))
  );
  return { sharedAccounts, shared, settlements, balances, lastSettled: settlements.at(-1)?.createdAt ?? null };
}

const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};

/** The group view: net worth of who shows it, who owes whom, the month's spending, the shared accounts. */
export async function loadHouseholdOverview(userId: string, householdId: string, month: string): Promise<HouseholdOverview | null> {
  if (!(await isHouseholdMember(userId, householdId))) return null;
  const [[group], people] = await Promise.all([
    db.select({ id: households.id, name: households.name }).from(households).where(eq(households.id, householdId)),
    loadPeople(householdId, userId),
  ]);
  if (!group) return null;
  const me = people.find((p) => p.isMe)!;
  const { sharedAccounts, shared, balances, lastSettled } = await loadGroupLedger(householdId, people);
  const { from, to } = monthBounds(month);
  const userIds = people.flatMap((p) => (p.userId ? [p.userId] : []));
  const memberOfUser = new Map(people.flatMap((p) => (p.userId ? [[p.userId, p.id] as const] : [])));

  const [accountExpenses, netWorths] = await Promise.all([
    loadExpenses(userIds, { accountIds: sharedAccounts.map((a) => a.id), from, to }),
    Promise.all(people.filter((p) => p.sharesNetWorth && p.userId).map(async (p) => ({ memberId: p.id, amount: (await loadSidebarSummary(p.userId!)).netWorth?.total ?? 0 }))),
  ]);
  const sinceSettled = lastSettled ? shared.filter((row) => row.createdAt > lastSettled) : shared;

  const monthRows = [
    ...accountExpenses.map((row) => ({ amount: row.amount, payerId: memberOfUser.get(row.userId) ?? "", category: row.category })),
    ...shared.filter((row) => row.date >= from && row.date <= to).map((row) => ({ amount: row.amount, payerId: row.payerId, category: row.category ?? OTHER_CATEGORY })),
  ];
  const byCategory = new Map<string, HouseholdSpendingRow>();
  for (const row of monthRows) {
    const key = row.category.name.toLowerCase();
    const entry = byCategory.get(key) ?? { name: row.category.name, icon: row.category.icon, color: row.category.color, amount: 0, payerIds: [] };
    entry.amount += row.amount;
    if (row.payerId && !entry.payerIds.includes(row.payerId)) entry.payerIds.push(row.payerId);
    byCategory.set(key, entry);
  }
  const rows = [...byCategory.values()].sort((a, b) => b.amount - a.amount);
  const slotOf = (id: string) => people.find((p) => p.id === id)?.slot ?? 99;
  for (const row of rows) row.payerIds.sort((a, b) => slotOf(a) - slotOf(b));

  return {
    id: group.id,
    name: group.name,
    month: from,
    members: people.map(toPerson),
    netWorth:
      netWorths.length === 0
        ? null
        : {
            total: netWorths.reduce((sum, n) => sum + n.amount, 0),
            parts: netWorths.sort((a, b) => slotOf(a.memberId) - slotOf(b.memberId)),
            hiddenMemberIds: people.filter((p) => p.userId && !p.sharesNetWorth).map((p) => p.id),
          },
    balance: {
      mine: balances.get(me.id) ?? 0,
      transfers: settleUp(balances),
      expenseCount: sinceSettled.length,
      paid: people.map((p) => ({ memberId: p.id, amount: sinceSettled.filter((r) => r.payerId === p.id).reduce((sum, r) => sum + r.amount, 0) })),
    },
    spending: { total: rows.reduce((sum, r) => sum + r.amount, 0), rows },
    accounts: sharedAccounts,
  };
}

/** Maximum entries in the group's expense list. */
const EXPENSE_LIST_LIMIT = 300;

/** Every expense that counts in the group's balance, newest first, with what each means for the viewer. */
export async function loadHouseholdExpenses(userId: string, householdId: string): Promise<{ members: HouseholdPerson[]; expenses: HouseholdExpenseEntry[]; lastSettledAt: string | null } | null> {
  if (!(await isHouseholdMember(userId, householdId))) return null;
  const people = await loadPeople(householdId, userId);
  const me = people.find((p) => p.isMe)!;
  const memberIds = people.map((p) => p.id);
  const { shared, lastSettled } = await loadGroupLedger(householdId, people);
  const expenses = shared
    .filter((row) => memberIds.includes(row.payerId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, EXPENSE_LIST_LIMIT)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      date: row.date,
      description: row.description,
      amount: row.amount,
      payerId: row.payerId,
      forIds: participantsOf(row, memberIds),
      chosenForIds: row.forIds ? row.forIds.filter((id) => memberIds.includes(id)) : null,
      mine: expenseEffect(toShared(row), memberIds, me.id),
      category: row.category,
      editable: row.kind === "gruppo",
      settled: lastSettled !== null && row.createdAt <= lastSettled,
    }));
  return { members: people.map(toPerson), expenses, lastSettledAt: lastSettled?.toISOString() ?? null };
}

/** Transactions of an account shown to the group, newest first; null when the viewer cannot see it. */
export async function loadHouseholdAccountTransactions(
  userId: string,
  householdId: string,
  accountId: string,
  limit = 100
): Promise<{ account: HouseholdAccountRow; owner: HouseholdPerson; transactions: HouseholdAccountTransaction[] } | null> {
  if (!(await isHouseholdMember(userId, householdId))) return null;
  const people = await loadPeople(householdId, userId);
  const account = (await loadSharedAccounts(householdId, people)).find((a) => a.id === accountId);
  const owner = people.find((p) => p.id === account?.ownerId);
  if (!account || !owner?.userId) return null;
  const rows = await db
    .select({ id: transactions.id, date: transactions.date, description: transactions.description, amount: transactions.amount, name: categories.name, icon: categories.icon, color: categories.color })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.accountId, accountId), eq(transactions.userId, owner.userId)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);
  return {
    account,
    owner: toPerson(owner),
    transactions: rows.map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      amount: Number(r.amount),
      category: r.name ? { name: r.name, icon: r.icon ?? "package", color: r.color ?? "slate" } : null,
    })),
  };
}

/** Accounts of others shown to the viewer, across all their groups (Conti: «In comune con te»). */
export async function loadAccountsSharedWithMe(userId: string): Promise<(HouseholdAccountRow & { householdId: string; householdName: string; ownerName: string; ownerInitial: string; ownerSlot: number })[]> {
  const groups = await listHouseholds(userId);
  const result = [];
  for (const group of groups) {
    for (const account of await loadSharedAccounts(group.id, group.members)) {
      const owner = group.members.find((m) => m.id === account.ownerId);
      if (!owner || owner.isMe) continue;
      result.push({ ...account, householdId: group.id, householdName: group.name, ownerName: owner.name, ownerInitial: owner.initial, ownerSlot: owner.slot });
    }
  }
  return result;
}

/** For each of the viewer's own accounts, the groups it is shown to (Conti marks them). */
export async function loadMySharedAccountGroups(userId: string): Promise<Record<string, string[]>> {
  const rows = await db
    .select({ accountId: householdAccounts.accountId, name: households.name })
    .from(householdAccounts)
    .innerJoin(households, eq(households.id, householdAccounts.householdId))
    .where(eq(householdAccounts.userId, userId));
  const map: Record<string, string[]> = {};
  for (const r of rows) (map[r.accountId] ??= []).push(r.name);
  return map;
}
