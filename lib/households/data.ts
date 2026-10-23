import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte } from "drizzle-orm";
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
import { loadSidebarSummary } from "@/lib/sidebar/summary";
import { computeBalances, settleUp, type SharedExpense } from "./balance";
import { looksLikeHouseholdAccount } from "./constants";
import type {
  HouseholdAccountRow,
  HouseholdAccountTransaction,
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

/** Members of a group in order of joining, the viewer first (slot 0). */
async function loadPeople(householdId: string, viewerId: string): Promise<(HouseholdPerson & { sharesNetWorth: boolean; joinedAt: Date })[]> {
  const rows = await db
    .select({ userId: householdMembers.userId, name: authUser.name, sharesNetWorth: householdMembers.sharesNetWorth, joinedAt: householdMembers.joinedAt })
    .from(householdMembers)
    .innerJoin(authUser, eq(authUser.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(asc(householdMembers.joinedAt));
  const ordered = [...rows.filter((r) => r.userId === viewerId), ...rows.filter((r) => r.userId !== viewerId)];
  return ordered.map((r, slot) => {
    const name = firstName(r.name);
    return { userId: r.userId, name, initial: name.charAt(0).toUpperCase(), isMe: r.userId === viewerId, slot, sharesNetWorth: r.sharesNetWorth, joinedAt: r.joinedAt };
  });
}

/** A member without the fields only the server needs. */
const toPerson = (p: HouseholdPerson): HouseholdPerson => ({ userId: p.userId, name: p.name, initial: p.initial, isMe: p.isMe, slot: p.slot });

/** True when the user is a member of the group. */
export async function isHouseholdMember(userId: string, householdId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
  return Boolean(row);
}

/** Ids of the groups the user is in. */
export async function householdIdsOf(userId: string): Promise<string[]> {
  const rows = await db.select({ id: householdMembers.householdId }).from(householdMembers).where(eq(householdMembers.userId, userId));
  return rows.map((r) => r.id);
}

/** The user's groups with their members, in order of creation. */
export async function listHouseholds(userId: string): Promise<HouseholdSummary[]> {
  const ids = await householdIdsOf(userId);
  if (ids.length === 0) return [];
  const [groups, pending] = await Promise.all([
    db.select({ id: households.id, name: households.name, createdAt: households.createdAt }).from(households).where(inArray(households.id, ids)).orderBy(asc(households.createdAt)),
    db
      .select({ householdId: householdInvites.householdId })
      .from(householdInvites)
      .where(and(inArray(householdInvites.householdId, ids), isNull(householdInvites.acceptedAt), isNull(householdInvites.revokedAt), gt(householdInvites.expiresAt, new Date()))),
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

/** The group page: members, pending invitations and what the viewer shares. Null when the viewer is not a member. */
export async function loadHouseholdSettings(userId: string, householdId: string): Promise<HouseholdSettings | null> {
  if (!(await isHouseholdMember(userId, householdId))) return null;
  const [[group], people, invites, sharedCounts, mineAccounts] = await Promise.all([
    db.select({ id: households.id, name: households.name }).from(households).where(eq(households.id, householdId)),
    loadPeople(householdId, userId),
    db
      .select({ id: householdInvites.id, email: householdInvites.email, expiresAt: householdInvites.expiresAt })
      .from(householdInvites)
      .where(and(eq(householdInvites.householdId, householdId), isNull(householdInvites.acceptedAt), isNull(householdInvites.revokedAt), gt(householdInvites.expiresAt, new Date())))
      .orderBy(desc(householdInvites.createdAt)),
    db.select({ userId: householdAccounts.userId }).from(householdAccounts).where(eq(householdAccounts.householdId, householdId)),
    loadShareableAccounts(userId, householdId),
  ]);
  if (!group) return null;
  const me = people.find((p) => p.isMe)!;
  return {
    id: group.id,
    name: group.name,
    members: people.map((p) => ({ ...toPerson(p), sharesNetWorth: p.sharesNetWorth, sharedAccounts: sharedCounts.filter((s) => s.userId === p.userId).length })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt.toISOString() })),
    mine: { sharesNetWorth: me.sharesNetWorth, accounts: mineAccounts },
  };
}

/** Accounts shown to the group, with their owner. */
async function loadSharedAccounts(householdId: string): Promise<HouseholdAccountRow[]> {
  const rows = await db
    .select({ id: accounts.id, name: accounts.name, icon: accounts.icon, color: accounts.color, balance: accounts.balance, ownerId: householdAccounts.userId, updatedAt: accounts.updatedAt })
    .from(householdAccounts)
    .innerJoin(accounts, and(eq(accounts.id, householdAccounts.accountId), eq(accounts.userId, householdAccounts.userId)))
    .where(eq(householdAccounts.householdId, householdId))
    .orderBy(asc(householdAccounts.createdAt));
  return rows.map((r) => ({ ...r, balance: Number(r.balance), updatedAt: r.updatedAt.toISOString() }));
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

/**
 * Expenses shared with the group in equal parts: those a member marked for it, and those a merchant rule sends to it
 * (from the rule's date, unless the member chose otherwise on that expense). Expenses on accounts shown to the group
 * are not here: that money is already common.
 */
export async function loadSharedExpenses(householdId: string, memberIds: string[], sharedAccountIds: Set<string>): Promise<ExpenseRow[]> {
  const [explicit, rules] = await Promise.all([
    db.select({ transactionId: householdSplits.transactionId, householdId: householdSplits.householdId, userId: householdSplits.userId }).from(householdSplits).where(inArray(householdSplits.userId, memberIds)),
    db.select().from(householdSplitRules).where(and(eq(householdSplitRules.householdId, householdId), inArray(householdSplitRules.userId, memberIds))),
  ]);
  const chosen = new Map(explicit.map((e) => [e.transactionId, e.householdId]));
  const explicitIds = explicit.filter((e) => e.householdId === householdId).map((e) => e.transactionId);
  const byId = new Map<string, ExpenseRow>();
  for (const row of await loadExpenses(memberIds, { ids: explicitIds })) byId.set(row.id, row);
  if (rules.length > 0) {
    const from = rules.map((r) => r.fromDate).sort()[0];
    const candidates = await loadExpenses([...new Set(rules.map((r) => r.userId))], { from });
    for (const row of candidates) {
      if (chosen.has(row.id) || byId.has(row.id)) continue;
      const key = merchantKey(row.description);
      if (rules.some((r) => r.userId === row.userId && r.merchantKey === key && row.date >= r.fromDate)) byId.set(row.id, row);
    }
  }
  return [...byId.values()].filter((row) => !sharedAccountIds.has(row.accountId));
}

const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};

/** The group view: net worth of who shows it, who owes whom, the month's household spending, the shared accounts. */
export async function loadHouseholdOverview(userId: string, householdId: string, month: string): Promise<HouseholdOverview | null> {
  if (!(await isHouseholdMember(userId, householdId))) return null;
  const [[group], people, sharedAccounts, settlements] = await Promise.all([
    db.select({ id: households.id, name: households.name }).from(households).where(eq(households.id, householdId)),
    loadPeople(householdId, userId),
    loadSharedAccounts(householdId),
    db.select().from(householdSettlements).where(eq(householdSettlements.householdId, householdId)).orderBy(asc(householdSettlements.createdAt)),
  ]);
  if (!group) return null;
  const memberIds = people.map((p) => p.userId);
  const sharedAccountIds = new Set(sharedAccounts.map((a) => a.id));
  const { from, to } = monthBounds(month);

  const [shared, accountExpenses, netWorths] = await Promise.all([
    loadSharedExpenses(householdId, memberIds, sharedAccountIds),
    loadExpenses(memberIds, { accountIds: [...sharedAccountIds], from, to }),
    Promise.all(people.filter((p) => p.sharesNetWorth).map(async (p) => ({ userId: p.userId, amount: (await loadSidebarSummary(p.userId)).netWorth?.total ?? 0 }))),
  ]);

  const toExpense = (row: ExpenseRow): SharedExpense => ({ payerId: row.userId, amount: row.amount });
  const balances = computeBalances(memberIds, shared.map(toExpense), settlements.map((s) => ({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: Number(s.amount) })));
  const lastSettled = settlements.at(-1)?.createdAt ?? null;
  const sinceSettled = lastSettled ? shared.filter((row) => row.createdAt > lastSettled) : shared;

  const monthRows = [...accountExpenses, ...shared.filter((row) => row.date >= from && row.date <= to)];
  const byCategory = new Map<string, HouseholdSpendingRow>();
  for (const row of monthRows) {
    const key = row.category.name.toLowerCase();
    const entry = byCategory.get(key) ?? { name: row.category.name, icon: row.category.icon, color: row.category.color, amount: 0, payerIds: [] };
    entry.amount += row.amount;
    if (!entry.payerIds.includes(row.userId)) entry.payerIds.push(row.userId);
    byCategory.set(key, entry);
  }
  const rows = [...byCategory.values()].sort((a, b) => b.amount - a.amount);
  const slotOf = (id: string) => people.find((p) => p.userId === id)?.slot ?? 99;
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
            parts: netWorths.sort((a, b) => slotOf(a.userId) - slotOf(b.userId)),
            hiddenUserIds: people.filter((p) => !p.sharesNetWorth).map((p) => p.userId),
          },
    balance: {
      mine: balances.get(userId) ?? 0,
      transfers: settleUp(balances),
      expenseCount: sinceSettled.length,
      paid: people.map((p) => ({ userId: p.userId, amount: sinceSettled.filter((r) => r.userId === p.userId).reduce((sum, r) => sum + r.amount, 0) })),
    },
    spending: { total: rows.reduce((sum, r) => sum + r.amount, 0), rows },
    accounts: sharedAccounts,
  };
}

/** Transactions of an account shown to the group, newest first; null when the viewer cannot see it. */
export async function loadHouseholdAccountTransactions(
  userId: string,
  householdId: string,
  accountId: string,
  limit = 100
): Promise<{ account: HouseholdAccountRow; owner: HouseholdPerson; transactions: HouseholdAccountTransaction[] } | null> {
  if (!(await isHouseholdMember(userId, householdId))) return null;
  const account = (await loadSharedAccounts(householdId)).find((a) => a.id === accountId);
  if (!account) return null;
  const owner = (await loadPeople(householdId, userId)).find((p) => p.userId === account.ownerId);
  if (!owner) return null;
  const rows = await db
    .select({ id: transactions.id, date: transactions.date, description: transactions.description, amount: transactions.amount, name: categories.name, icon: categories.icon, color: categories.color })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.accountId, accountId), eq(transactions.userId, account.ownerId)))
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
    for (const account of await loadSharedAccounts(group.id)) {
      if (account.ownerId === userId) continue;
      const owner = group.members.find((m) => m.userId === account.ownerId);
      if (!owner) continue;
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
