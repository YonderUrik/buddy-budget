"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { Account } from "@/lib/db/schema/accounts";
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validation/accounts";
import { pageText } from "@/lib/localization/page-text";
import {
  ACCOUNT_DELETED_QUERY_KEYS,
  BALANCE_CHANGED_QUERY_KEYS,
  invalidateKeys,
  queryKeys,
} from "./invalidation";

const ACCOUNTS_QUERY_KEY = queryKeys.accounts;

/** An account as `GET /api/accounts` returns it: `followsTransactions` is true for linked banks and file imports. */
export type AccountListItem = Account & { followsTransactions: boolean };

async function fetchAccounts(): Promise<AccountListItem[]> {
  const response = await fetch("/api/accounts");
  if (!response.ok) {
    throw new Error(pageText("Impossibile caricare i conti"));
  }
  return response.json();
}

/** Fetches the logged-in user's accounts. */
export function useAccountsQuery() {
  return useQuery({ queryKey: ACCOUNTS_QUERY_KEY, queryFn: fetchAccounts });
}

/** Creates a new manual account and, on success, marks every balance-dependent view stale. */
export function useCreateAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? pageText("Impossibile creare il conto"));
      }
      return response.json() as Promise<Account>;
    },
    onSuccess: async () => {
      track("account_created");
      // A new account moves the total on the overview, so every balance-dependent view goes stale with it.
      await invalidateKeys(queryClient, BALANCE_CHANGED_QUERY_KEYS);
    },
  });
}

/** Updates an existing manual account and, on success, marks every balance-dependent view stale. */
export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateAccountInput }) => {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? pageText("Impossibile aggiornare il conto"));
      }
      return response.json() as Promise<Account>;
    },
    onSuccess: async () => {
      await invalidateKeys(queryClient, BALANCE_CHANGED_QUERY_KEYS);
    },
  });
}

/** Deletes (or unlinks, for automatic accounts) an account and, on success, marks the ledger views stale too. */
export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(pageText("Impossibile eliminare il conto"));
      }
    },
    onSuccess: async () => {
      // The server deletes the account's transactions too: invalidate the ledger views, not just the accounts.
      await invalidateKeys(queryClient, ACCOUNT_DELETED_QUERY_KEYS);
    },
  });
}
