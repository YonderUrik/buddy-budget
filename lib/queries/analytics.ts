"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { countChangedFields, type AssumptionsResponse, type UpdateAssumptionsInput } from "@/lib/analitiche/assumptions";

export const ANALYTICS_QUERY_KEY = ["analytics", "assumptions"] as const;

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

/** Ipotesi di Analitiche dell'utente (con i default) e se ha già visto la guida. */
export function useAnalyticsAssumptionsQuery() {
  return useQuery<AssumptionsResponse>({
    queryKey: [...ANALYTICS_QUERY_KEY],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const response = await fetch("/api/analytics/assumptions");
      if (!response.ok) throw await readError(response, "Impossibile caricare le ipotesi");
      return response.json();
    },
  });
}

/** Salva alcune ipotesi: la cache si aggiorna subito con la risposta del server. */
export function useUpdateAssumptionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateAssumptionsInput): Promise<AssumptionsResponse> => {
      const response = await fetch("/api/analytics/assumptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile salvare le ipotesi");
      return response.json();
    },
    onSuccess: (next) => {
      const previous = queryClient.getQueryData<AssumptionsResponse>([...ANALYTICS_QUERY_KEY]);
      queryClient.setQueryData([...ANALYTICS_QUERY_KEY], next);
      track("analytics_assumptions_saved", { fields: previous ? countChangedFields(previous.assumptions, next.assumptions) : 0 });
    },
  });
}

/** Segna la guida iniziale come vista. */
export function useMarkWalkthroughSeenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/analytics/walkthrough", { method: "POST" });
      if (!response.ok) throw await readError(response, "Impossibile salvare");
    },
    onSuccess: () =>
      queryClient.setQueryData<AssumptionsResponse>([...ANALYTICS_QUERY_KEY], (old) => (old ? { ...old, walkthroughSeen: true } : old)),
  });
}
