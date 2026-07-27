"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/lib/validation/transactions";
import type { CategorizeSuggestion } from "@/lib/calc/categorize-suggestions";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
    },
  });
}

async function fetchCategorizeSuggestions(): Promise<CategorizeSuggestion[]> {
  const response = await fetch("/api/transactions/categorize-suggestions");
  if (!response.ok) {
    throw new Error("Impossibile calcolare i suggerimenti di categorizzazione");
  }
  return response.json();
}

/** Suggerimenti di categorizzazione automatica basati sullo storico; non parte al mount, va invocata con refetch(). */
export function useCategorizeSuggestionsQuery() {
  return useQuery({
    queryKey: ["transactions", "categorize-suggestions"] as const,
    queryFn: fetchCategorizeSuggestions,
    enabled: false,
  });
}
