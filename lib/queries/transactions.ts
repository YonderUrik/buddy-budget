"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/lib/validation/transactions";
import { track } from "@/lib/analytics";
import { pageText } from "@/lib/localization/page-text";
import type { TransactionDetailData } from "@/lib/transactions/detail";
import type { SingleSuggestion } from "@/lib/categorization/ai/single-suggestion";

export type TransactionDirectionParam = "uscita" | "entrata" | "tutte";

/** Movimento come arriva dall'elenco: con l'indirizzo del logo dell'esercente, se il server ne ha trovato uno. */
export type ListedTransaction = Transaction & { logoPath?: string | null };

function transactionsQueryKey(from: string, to: string, type: TransactionDirectionParam) {
  return ["transactions", from, to, type] as const;
}

async function fetchTransactions(from: string, to: string, type: TransactionDirectionParam): Promise<ListedTransaction[]> {
  const response = await fetch(`/api/transactions?from=${from}&to=${to}&type=${type}`);
  if (!response.ok) {
    throw new Error(pageText("Impossibile caricare le transazioni"));
  }
  return response.json();
}

/** Opzioni di `useTransactionsQuery`: `enabled` per aspettare un dato che serve all'intervallo, `keepPrevious` per tenere i movimenti precedenti mentre arrivano quelli di un intervallo nuovo. */
export interface TransactionsQueryOptions {
  enabled?: boolean;
  keepPrevious?: boolean;
}

/** Recupera le transazioni dell'utente nell'intervallo [from, to] (YYYY-MM-DD), filtrate per direzione (default "uscita"). */
export function useTransactionsQuery(from: string, to: string, type: TransactionDirectionParam = "uscita", options: TransactionsQueryOptions = {}) {
  return useQuery({
    queryKey: transactionsQueryKey(from, to, type),
    queryFn: () => fetchTransactions(from, to, type),
    enabled: options.enabled ?? true,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

/** Years with movements are stable between imports; every transaction mutation still refreshes them (`["transactions"]` key). */
const TRANSACTION_YEARS_STALE_MS = 5 * 60_000;

/** Years that hold movements, newest first, for loading older history on demand. */
export function useTransactionYearsQuery() {
  return useQuery({
    queryKey: ["transactions", "years"] as const,
    staleTime: TRANSACTION_YEARS_STALE_MS,
    queryFn: async (): Promise<number[]> => {
      const response = await fetch("/api/transactions/years");
      if (!response.ok) throw new Error(pageText("Impossibile caricare le transazioni"));
      return ((await response.json()) as { years: number[] }).years;
    },
  });
}

/** Detail of one transaction as `GET /api/transactions/[id]` returns it. */
export type TransactionDetail = TransactionDetailData<ListedTransaction>;

/** Thrown when the transaction no longer exists (deleted, or a link to someone else's). */
export class TransactionNotFoundError extends Error {}

/**
 * Detail of one transaction (origin, rule, same merchant). `placeholder` is the row already in a list, shown at once
 * while the rest arrives. The key sits under `["transactions"]`, so every transaction mutation refreshes it too.
 */
export function useTransactionDetailQuery(id: string | null, placeholder?: ListedTransaction) {
  return useQuery({
    queryKey: ["transactions", "detail", id] as const,
    enabled: id !== null,
    queryFn: async (): Promise<TransactionDetail> => {
      const response = await fetch(`/api/transactions/${id}`);
      if (response.status === 404) throw new TransactionNotFoundError(pageText("Questo movimento non c'è più"));
      if (!response.ok) throw new Error(pageText("Impossibile caricare il movimento"));
      return response.json();
    },
    placeholderData: placeholder && placeholder.id === id ? { transaction: placeholder, account: null, origin: { kind: "manuale" }, rule: null, merchant: null } : undefined,
    retry: (count, error) => !(error instanceof TransactionNotFoundError) && count < 2,
  });
}

/** «Chiedi all'AI» for one transaction: the category the model would give it. Writes nothing. */
export function useAiSuggestionMutation() {
  return useMutation({
    mutationFn: async (id: string): Promise<SingleSuggestion> => {
      const response = await fetch(`/api/transactions/${id}/ai-suggestion`, { method: "POST" });
      if (!response.ok) throw new Error(pageText("L'AI non ha risposto. Riprova tra poco."));
      return response.json();
    },
    onSuccess: (result) => track("transaction_ai_asked", { outcome: result.status }),
  });
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
        throw new Error(body?.error ?? pageText("Impossibile creare la transazione"));
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
        throw new Error(body?.error ?? pageText("Impossibile aggiornare la transazione"));
      }
      return response.json() as Promise<Transaction>;
    },
    onSuccess: (_transaction, { input }) => {
      if (input.categoryId !== undefined) track("transaction_category_changed", { source: "row" });
      if (input.excludedAmount !== undefined) track("transaction_split");
      if (input.note !== undefined) track("transaction_note_saved", { cleared: !input.note?.trim() });
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
        throw new Error(body?.error ?? pageText("Impossibile eliminare la transazione"));
      }
    },
    onSuccess: (_result, id) => {
      track("transaction_deleted");
      // The deleted row's detail would only answer 404: drop it instead of refetching.
      queryClient.removeQueries({ queryKey: ["transactions", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["attention"] });
    },
  });
}
