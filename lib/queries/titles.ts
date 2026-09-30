"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { UserPriceAlert } from "@/lib/db/schema/investments";
import type { TitleAnalysis } from "@/lib/investments/title-view";
import type { TitleListItem } from "@/lib/investments/titles-list";
import type { TitleChartPeriod } from "@/lib/investments/title-stats";
import type { CreatePriceAlertInput } from "@/lib/validation/investments";

const TITLES_KEY = ["investments", "titles"] as const;
/** Intervallo di polling mentre lo storico di un titolo si sta scaricando. */
export const TITLE_BACKFILL_POLL_MS = 2500;

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

/** Elenco dei titoli dell'utente (watchlist e posseduti). */
export function useTitleListQuery() {
  return useQuery({
    queryKey: [...TITLES_KEY, "list"],
    queryFn: async (): Promise<{ items: TitleListItem[] }> => {
      const response = await fetch("/api/investments/titles");
      if (!response.ok) throw new Error("Impossibile caricare i titoli");
      return response.json();
    },
  });
}

/** Pagina di un titolo. Mentre lo storico si scarica la richiesta si ripete da sola. */
export function useTitleAnalysisQuery(instrumentId: string, period: TitleChartPeriod) {
  return useQuery({
    queryKey: [...TITLES_KEY, "analysis", instrumentId, period],
    queryFn: async (): Promise<TitleAnalysis> => {
      const response = await fetch(`/api/instruments/${instrumentId}/analysis?period=${period}`);
      if (!response.ok) throw await readError(response, "Impossibile caricare il titolo");
      return response.json();
    },
    refetchInterval: (query) => (query.state.data?.backfilling ? TITLE_BACKFILL_POLL_MS : false),
  });
}

function useInvalidateTitles() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["investments", "sidebar-summary"] });
    return queryClient.invalidateQueries({ queryKey: [...TITLES_KEY] });
  };
}

/** Segue o smette di seguire un titolo. */
export function useWatchMutation() {
  const invalidate = useInvalidateTitles();
  return useMutation({
    mutationFn: async ({ instrumentId, watch }: { instrumentId: string; watch: boolean }) => {
      const response = await fetch(`/api/instruments/${instrumentId}/watch`, { method: watch ? "PUT" : "DELETE" });
      if (!response.ok) throw await readError(response, "Operazione non riuscita");
      return { watch };
    },
    onSuccess: ({ watch }) => {
      if (watch) track("title_watched");
      return invalidate();
    },
  });
}

/** Crea un avviso di prezzo. */
export function useCreateAlertMutation(instrumentId: string) {
  const invalidate = useInvalidateTitles();
  return useMutation({
    mutationFn: async (input: CreatePriceAlertInput): Promise<UserPriceAlert> => {
      const response = await fetch(`/api/instruments/${instrumentId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile creare l'avviso");
      return response.json();
    },
    onSuccess: (_alert, input) => {
      track("price_alert_created", { direction: input.direction });
      return invalidate();
    },
  });
}

/** Elimina un avviso di prezzo. */
export function useDeleteAlertMutation(instrumentId: string) {
  const invalidate = useInvalidateTitles();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/instruments/${instrumentId}/alerts/${alertId}`, { method: "DELETE" });
      if (!response.ok) throw await readError(response, "Impossibile eliminare l'avviso");
    },
    onSuccess: invalidate,
  });
}

export interface CommentaryResult {
  available: boolean;
  text: string | null;
}

/** Chiede il commento del modello locale sul titolo. */
export function useCommentaryMutation(instrumentId: string) {
  return useMutation({
    mutationFn: async (): Promise<CommentaryResult> => {
      const response = await fetch(`/api/instruments/${instrumentId}/commentary`, { method: "POST" });
      if (!response.ok) throw await readError(response, "Impossibile generare il commento");
      return response.json();
    },
    onSuccess: () => track("title_commentary_requested"),
  });
}
