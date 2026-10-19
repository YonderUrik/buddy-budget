"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { StartFocus, StartStatus, StartStepId } from "@/lib/start";
import { pageText } from "@/lib/localization/page-text";

import { START_QUERY_KEY } from "./start-key";

async function fetchStart(): Promise<StartStatus> {
  const response = await fetch("/api/start");
  if (!response.ok) throw new Error(pageText("Impossibile caricare i primi passi"));
  const status = (await response.json()) as StartStatus;
  if (status.justCompleted) track("start_checklist_completed");
  return status;
}

/** How often the steps are re-read while some are missing and the tab is open (imports and syncs finish out of band). */
const START_POLL_MS = 15_000;

/**
 * State of the first steps and of the sample data. It refreshes on its own: when the user comes back to the page,
 * after any write (see `QueryProvider`), and every few seconds while a step is still missing and the tab is visible.
 */
export function useStartQuery() {
  return useQuery({
    queryKey: START_QUERY_KEY,
    queryFn: fetchStart,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data;
      return status && !status.completed && !status.dismissed ? START_POLL_MS : false;
    },
  });
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
      if (!response.ok) throw new Error(pageText("Impossibile aggiornare i primi passi"));
    },
    onSuccess: (_data, { dismissed, done }) => {
      track(dismissed ? "start_checklist_dismissed" : "start_checklist_reopened", dismissed ? { done } : undefined);
      queryClient.invalidateQueries({ queryKey: START_QUERY_KEY });
    },
  });
}

/** Saves what the user keeps an eye on (the checklist's «Cambia»): the steps asked change right away. */
export function useStartFocusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (focus: StartFocus[]) => {
      const response = await fetch("/api/start", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus }),
      });
      if (!response.ok) throw new Error(pageText("Impossibile aggiornare i primi passi"));
    },
    onSuccess: (_data, focus) => {
      track("start_focus_changed", { count: focus.length });
      queryClient.invalidateQueries({ queryKey: START_QUERY_KEY });
    },
  });
}

/** Skips a first step («Non mi serve») or brings it back; the checklist can then finish without it. */
export function useStartSkipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ step, skipped }: { step: StartStepId; skipped: boolean }) => {
      const response = await fetch("/api/start", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, skipped }),
      });
      if (!response.ok) throw new Error(pageText("Impossibile aggiornare i primi passi"));
    },
    onSuccess: (_data, { step, skipped }) => {
      if (step !== "conto") track("start_step_skipped", { step, skipped });
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
        throw new Error(body?.error ?? pageText("Impossibile avviare i dati d'esempio"));
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
      if (!response.ok) throw new Error(pageText("Impossibile azzerare i dati d'esempio"));
    },
    onSuccess: (_data, from) => {
      track("demo_cleared", { from });
      queryClient.invalidateQueries();
    },
  });
}

