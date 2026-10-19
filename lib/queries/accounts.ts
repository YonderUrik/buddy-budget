"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { Account } from "@/lib/db/schema/accounts";
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validation/accounts";
import { pageText } from "@/lib/localization/page-text";

const ACCOUNTS_QUERY_KEY = ["accounts"] as const;

/** An account as `GET /api/accounts` returns it: `followsTransactions` is true for linked banks and file imports. */
export type AccountListItem = Account & { followsTransactions: boolean };

async function fetchAccounts(): Promise<AccountListItem[]> {
  const response = await fetch("/api/accounts");
  if (!response.ok) {
    throw new Error(pageText("Impossibile caricare i conti"));
  }
  return response.json();
}

/** Recupera la lista dei conti dell'utente autenticato. */
export function useAccountsQuery() {
  return useQuery({ queryKey: ACCOUNTS_QUERY_KEY, queryFn: fetchAccounts });
}

/** Crea un nuovo conto manuale e invalida la lista al successo. */
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
    onSuccess: () => {
      track("account_created");
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}

/** Aggiorna un conto manuale esistente e invalida la lista al successo. */
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}

/** Elimina (o scollega, per i conti auto) un conto e invalida la lista al successo. */
export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(pageText("Impossibile eliminare il conto"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
      // Scollegare l'ultimo conto di una banca libera il posto: il pulsante «Collega» va ricontrollato.
      queryClient.invalidateQueries({ queryKey: ["gocardless", "capacity"] });
    },
  });
}
