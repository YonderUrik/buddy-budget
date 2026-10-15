"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { GoalKind } from "@/lib/goals/constants";
import type { GoalsView } from "@/lib/goals/view";

/** Chiave della vista degli obiettivi: la leggono la vista Obiettivi e la Panoramica. */
export const GOALS_QUERY_KEY = ["goals"] as const;
/** La vista ricalcola tutto il piano delle Analitiche: per qualche minuto basta quella in cache (le mutazioni la invalidano). */
const GOALS_STALE_MS = 5 * 60_000;

/** Parte di un conto o di un titolo come la manda il form. */
export interface GoalSourcePayload {
  accountId?: string | null;
  instrumentId?: string | null;
  amount: number;
}

/** Dati di un obiettivo come li manda il form (creazione o modifica completa). */
export interface GoalPayload {
  name: string;
  kind: GoalKind;
  targetAmount: number;
  targetDate: string | null;
  monthlyAmount: number;
  priority?: number;
  sources: GoalSourcePayload[];
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

async function send(url: string, method: string, body: unknown, fallback: string) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw await readError(response, fallback);
  return response.status === 204 ? null : response.json();
}

/** Obiettivi con il piano del risparmio; `enabled` falso per non chiederli (es. paese senza Analitiche). */
export function useGoalsQuery(enabled = true) {
  return useQuery({
    queryKey: GOALS_QUERY_KEY,
    enabled,
    staleTime: GOALS_STALE_MS,
    queryFn: async (): Promise<GoalsView> => {
      const response = await fetch("/api/goals");
      if (!response.ok) throw new Error("Impossibile caricare gli obiettivi");
      return response.json();
    },
  });
}

/** Crea un obiettivo. */
export function useCreateGoalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalPayload): Promise<{ id: string }> => send("/api/goals", "POST", input, "Impossibile creare l'obiettivo"),
    onSuccess: (_row, input) => {
      track("goal_created", { kind: input.kind, sources: input.sources.length, dated: input.targetDate !== null });
      queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY });
    },
  });
}

/** Modifica un obiettivo (anche solo le fonti). */
export function useUpdateGoalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; kind: GoalKind; input: Partial<GoalPayload> }) => send(`/api/goals/${id}`, "PATCH", input, "Impossibile salvare l'obiettivo"),
    onSuccess: (_row, { kind, input }) => {
      track("goal_updated", { kind: input.kind ?? kind, sources: input.sources?.length ?? 0 });
      queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY });
    },
  });
}

/** Segna un obiettivo come raggiunto o lo riapre. */
export function useAchieveGoalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, achieved }: { id: string; kind: GoalKind; achieved: boolean }) => send(`/api/goals/${id}`, "PATCH", { achieved }, "Impossibile aggiornare l'obiettivo"),
    onSuccess: (_row, { kind, achieved }) => {
      track("goal_achieved", { kind, achieved });
      queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY });
    },
  });
}

/** Elimina un obiettivo (i saldi veri non cambiano). */
export function useDeleteGoalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; kind: GoalKind }) => send(`/api/goals/${id}`, "DELETE", undefined, "Impossibile eliminare l'obiettivo"),
    onSuccess: (_row, { kind }) => {
      track("goal_deleted", { kind });
      queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY });
    },
  });
}

/** Salva il nuovo ordine di priorità. Aggiorna subito la lista in cache e la ricarica dal server (il piano cambia). */
export function useReorderGoalsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => send("/api/goals/reorder", "POST", { ids }, "Impossibile cambiare l'ordine"),
    onMutate: (ids) => {
      queryClient.setQueryData<GoalsView>(GOALS_QUERY_KEY, (old) =>
        old ? { ...old, goals: ids.map((id) => old.goals.find((g) => g.id === id)).filter((g): g is GoalsView["goals"][number] => Boolean(g)) } : old,
      );
    },
    onSuccess: (_row, ids) => track("goal_reordered", { count: ids.length }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY }),
  });
}
