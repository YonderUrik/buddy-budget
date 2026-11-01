import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * The query keys the account mutations touch, named once so a mutation never has to guess them. Every key here is a
 * prefix: invalidating `["transactions"]` reaches the ranged lists, `["net-worth-snapshots"]` the period windows.
 */
export const queryKeys = {
  accounts: ["accounts"],
  netWorth: ["net-worth-snapshots"],
  sidebar: ["investments", "sidebar-summary"],
  goals: ["goals"],
  transactions: ["transactions"],
  attention: ["attention"],
  budget: ["budget-month"],
  bankCapacity: ["gocardless", "capacity"],
} as const satisfies Record<string, QueryKey>;

/**
 * What a balance change makes stale: the accounts, the cash history, the sidebar total and the goals funded by
 * accounts. Creating an account, changing its balance or its type all move what these views show.
 */
export const BALANCE_CHANGED_QUERY_KEYS = [
  queryKeys.accounts,
  queryKeys.netWorth,
  queryKeys.sidebar,
  queryKeys.goals,
] as const;

/**
 * What deleting an account makes stale. The server drops the account's transactions in the same database
 * transaction (`app/api/accounts/[id]/route.ts`), so the ledger views would otherwise keep rows that no longer
 * exist: the lists, the attention counts, the month's budget, plus the bank capacity freed by unlinking.
 */
export const ACCOUNT_DELETED_QUERY_KEYS = [
  ...BALANCE_CHANGED_QUERY_KEYS,
  queryKeys.transactions,
  queryKeys.attention,
  queryKeys.budget,
  queryKeys.bankCapacity,
] as const;

/**
 * Marks every key stale, active or not. Inactive queries stay stale and refresh when they mount again, so a view
 * the user is not on yet is still correct when they reach it.
 */
export async function invalidateKeys(client: QueryClient, keys: readonly QueryKey[]): Promise<void> {
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}
