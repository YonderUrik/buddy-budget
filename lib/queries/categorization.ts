"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import type { ApplyCategorizationInput } from "@/lib/validation/categorization-rules";

const SUGGESTIONS_QUERY_KEY = ["categorize-suggestions"] as const;

async function fetchSuggestions(): Promise<SuggestionGroup[]> {
  const response = await fetch("/api/transactions/categorize-suggestions");
  if (!response.ok) {
    throw new Error("Impossibile caricare le proposte di categorizzazione");
  }
  const body = (await response.json()) as { groups: SuggestionGroup[] };
  return body.groups;
}

/** Gruppi di transazioni da categorizzare con le relative proposte da regole e storico. */
export function useCategorizeSuggestionsQuery() {
  return useQuery({ queryKey: SUGGESTIONS_QUERY_KEY, queryFn: fetchSuggestions });
}

/** Applica in blocco le scelte di categorizzazione e invalida proposte e transazioni al successo. */
export function useApplyCategorizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApplyCategorizationInput) => {
      const response = await fetch("/api/transactions/categorize-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile applicare la categorizzazione");
      }
      return response.json() as Promise<{ applied: number; rulesCreated: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
