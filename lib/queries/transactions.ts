"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/lib/validation/transactions";
import { track } from "@/lib/analytics";

export type TransactionDirectionParam = "uscita" | "entrata" | "tutte";

function transactionsQueryKey(from: string, to: string, type: TransactionDirectionParam) {
  return ["transactions", from, to, type] as const;
}

async function fetchTransactions(from: string, to: string, type: TransactionDirectionParam): Promise<Transaction[]> {
  const response = await fetch(`/api/transactions?from=${from}&to=${to}&type=${type}`);
  if (!response.ok) {
    throw new Error("Impossibile caricare le transazioni");
  }
  return response.json();
}

/** Recupera le transazioni dell'utente nell'intervallo [from, to] (YYYY-MM-DD), filtrate per direzione (default "uscita"). */
export function useTransactionsQuery(from: string, to: string, type: TransactionDirectionParam = "uscita") {
  return useQuery({ queryKey: transactionsQueryKey(from, to, type), queryFn: () => fetchTransactions(from, to, type) });
}

/** Crea una spesa manuale e invalida tutte le liste di transazioni in cache. */
export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile creare la transazione");
      }
      return response.json() as Promise<Transaction>;
    },
    onSuccess: (transaction) => {
      track("transaction_added", { direction: Number(transaction.amount) >= 0 ? "entrata" : "uscita" });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["attention"] });
    },
  });
}

/** Aggiorna una transazione (categoria/dividi sempre; descrizione/importo/data solo se manuale) e invalida la cache. */
export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTransactionInput }) => {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile aggiornare la transazione");
      }
      return response.json() as Promise<Transaction>;
    },
    onSuccess: (_transaction, { input }) => {
      if (input.categoryId !== undefined) track("transaction_category_changed", { source: "row" });
      if (input.excludedAmount !== undefined) track("transaction_split");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["attention"] });
    },
  });
}

/** Elimina una spesa manuale e invalida la cache. */
export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile eliminare la transazione");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["attention"] });
    },
  });
}
