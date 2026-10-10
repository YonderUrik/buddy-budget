"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { StartStatus } from "@/lib/start";

const START_QUERY_KEY = ["start"] as const;

async function fetchStart(): Promise<StartStatus> {
  const response = await fetch("/api/start");
  if (!response.ok) throw new Error("Impossibile caricare i primi passi");
  const status = (await response.json()) as StartStatus;
  if (status.justCompleted) track("start_checklist_completed");
  return status;
}

/** Stato dei primi passi e dei dati d'esempio; si aggiorna da solo quando l'utente torna sulla pagina. */
export function useStartQuery() {
  return useQuery({ queryKey: START_QUERY_KEY, queryFn: fetchStart, staleTime: 0 });
}

/** Chiude o riapre la checklist dei primi passi. */
export function useStartDismissMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dismissed }: { dismissed: boolean; done: number }) => {
      const response = await fetch("/api/start", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed }),
      });
      if (!response.ok) throw new Error("Impossibile aggiornare i primi passi");
    },
    onSuccess: (_data, { dismissed, done }) => {
      track(dismissed ? "start_checklist_dismissed" : "start_checklist_reopened", dismissed ? { done } : undefined);
      queryClient.invalidateQueries({ queryKey: START_QUERY_KEY });
    },
  });
}

/** Avvia i dati d'esempio: cambiano conti, movimenti e patrimonio, quindi si ricarica tutto. */
export function useStartDemoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/start/demo", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile avviare i dati d'esempio");
      }
    },
    onSuccess: () => {
      track("demo_started");
      queryClient.invalidateQueries();
    },
  });
}

/** Azzera i dati d'esempio; `from` dice da dove (banner sempre visibile o Panoramica). */
export function useClearDemoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (from: "banner" | "panoramica") => {
      void from;
      const response = await fetch("/api/start/demo", { method: "DELETE" });
      if (!response.ok) throw new Error("Impossibile azzerare i dati d'esempio");
    },
    onSuccess: (_data, from) => {
      track("demo_cleared", { from });
      queryClient.invalidateQueries();
    },
  });
}

