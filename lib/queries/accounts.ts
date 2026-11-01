"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { Account } from "@/lib/db/schema/accounts";
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validation/accounts";
import { pageText } from "@/lib/localization/page-text";
import { markHistoryRefreshPending } from "./history-refresh-signal";
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
/** What deleting an account removes, as `GET /api/accounts/[id]/deletion` returns it. */
export interface AccountDeletionPreview {
  token: string;
  name: string;
  cashCount: number;
  investmentCount: number;
  portfolios: string[];
  imports: number;
}

/** Reads what deleting the account would remove; only while the confirmation is open (`enabled`), never cached. */
export function useAccountDeletionPreviewQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["account-deletion", id],
    enabled,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<AccountDeletionPreview> => {
      const response = await fetch(`/api/accounts/${id}/deletion`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? pageText("Impossibile eliminare il conto"));
      return body;
    },
  });
}

/**
 * Deletes an account with what it brought in. `token` comes from the preview and is required when the account carries
 * investments or imports; then every view is refreshed (portfolio, imports, history), not only the ledger.
 */
export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, token }: { id: string; token?: string }) => {
      const response = await fetch(`/api/accounts/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { token } : {}) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? pageText("Impossibile eliminare il conto"));
      }
    },
    onSuccess: async (_result, { token }) => {
      // The server deletes the account's transactions too: invalidate the ledger views, not just the accounts.
      await invalidateKeys(queryClient, ACCOUNT_DELETED_QUERY_KEYS);
      // With a token, operations, portfolios and imports went too.
      if (token) {
        markHistoryRefreshPending();
        await queryClient.invalidateQueries();
      }
    },
  });
}
