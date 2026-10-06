"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { DebtsViewData } from "@/lib/debts/view";
import type { CreateDebtEventInput, CreateDebtInput, UpdateDebtInput } from "@/lib/validation/debts";

export const DEBTS_QUERY_KEY = ["debts"] as const;
/** Quanto restano valide le cifre dei debiti prima di ricaricarle: cambiano solo per azioni dell'utente o col passare dei giorni. */
const DEBTS_STALE_TIME_MS = 60 * 1000;

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

function useInvalidateDebts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [...DEBTS_QUERY_KEY] });
}

/** Piani, totali e scadenze dei debiti dell'utente: una sola richiesta per tutte le schede. */
export function useDebtsQuery() {
  return useQuery<DebtsViewData>({
    queryKey: [...DEBTS_QUERY_KEY],
    staleTime: DEBTS_STALE_TIME_MS,
    queryFn: async () => {
      const response = await fetch("/api/debts");
      if (!response.ok) throw await readError(response, "Impossibile caricare i debiti");
      return response.json();
    },
  });
}

/** Crea un finanziamento; restituisce l'id. */
export function useCreateDebtMutation() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async (input: CreateDebtInput): Promise<{ id: string }> => {
      const response = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile aggiungere il debito");
      return response.json();
    },
    onSuccess: (_row, input) => {
      track("debt_added", { startMode: input.startMode });
      invalidate();
    },
  });
}

/** Modifica nome e spese di un debito. */
export function useUpdateDebtMutation() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateDebtInput }) => {
      const response = await fetch(`/api/debts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile salvare le modifiche");
    },
    onSuccess: invalidate,
  });
}

/** Elimina un debito con tutti i suoi eventi. */
export function useDeleteDebtMutation() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/debts/${id}`, { method: "DELETE" });
      if (!response.ok) throw await readError(response, "Impossibile eliminare il debito");
    },
    onSuccess: invalidate,
  });
}

/** Registra un evento (rata pagata, cambio tasso, correzione del residuo). */
export function useCreateDebtEventMutation() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async ({ debtId, input }: { debtId: string; input: CreateDebtEventInput }) => {
      const response = await fetch(`/api/debts/${debtId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile registrare l'evento");
    },
    onSuccess: (_row, { input }) => {
      track("debt_event_added", { type: input.type });
      invalidate();
    },
  });
}

/** Elimina un evento: il piano si ricalcola senza. */
export function useDeleteDebtEventMutation() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async ({ debtId, eventId }: { debtId: string; eventId: string }) => {
      const response = await fetch(`/api/debts/${debtId}/events/${eventId}`, { method: "DELETE" });
      if (!response.ok) throw await readError(response, "Impossibile eliminare l'evento");
    },
    onSuccess: invalidate,
  });
}

/** Segna come pagate in blocco le rate scadute fino alla rata indicata (pregresso di un finanziamento in corso). */
export function useBulkPayDebtMutation() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async ({ debtId, upToInstallment }: { debtId: string; upToInstallment: number }): Promise<{ count: number }> => {
      const response = await fetch(`/api/debts/${debtId}/payments/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upToInstallment }),
      });
      if (!response.ok) throw await readError(response, "Impossibile segnare le rate");
      return response.json();
    },
    onSuccess: () => {
      track("debt_event_added", { type: "payment" });
      invalidate();
    },
  });
}
