"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import type {
  ApplyCategorizationInput,
  CreateRuleInput,
  UpdateRuleInput,
} from "@/lib/validation/categorization-rules";
import type { CategorizationRule } from "@/lib/db/schema/categorization-rules";

const SUGGESTIONS_QUERY_KEY = ["categorize-suggestions"] as const;
const CATEGORIZATION_RULES_QUERY_KEY = ["categorization-rules"] as const;

export type CategorizationRuleWithCategoryName = CategorizationRule & { categoryName: string };

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

async function fetchCategorizationRules(): Promise<CategorizationRuleWithCategoryName[]> {
  const response = await fetch("/api/categorization-rules");
  if (!response.ok) {
    throw new Error("Impossibile caricare le regole di categorizzazione");
  }
  return response.json();
}

/** Recupera le regole di categorizzazione dell'utente autenticato, con il nome della categoria collegata. */
export function useCategorizationRulesQuery() {
  return useQuery({ queryKey: CATEGORIZATION_RULES_QUERY_KEY, queryFn: fetchCategorizationRules });
}

/** Crea una nuova regola manuale e invalida la lista al successo. */
export function useCreateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const response = await fetch("/api/categorization-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile creare la regola");
      }
      return response.json() as Promise<CategorizationRule>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIZATION_RULES_QUERY_KEY });
    },
  });
}

/** Aggiorna una regola esistente e invalida la lista al successo. */
export function useUpdateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateRuleInput }) => {
      const response = await fetch(`/api/categorization-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile aggiornare la regola");
      }
      return response.json() as Promise<CategorizationRule>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIZATION_RULES_QUERY_KEY });
    },
  });
}

/** Elimina una regola e invalida la lista al successo. */
export function useDeleteRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categorization-rules/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile eliminare la regola");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIZATION_RULES_QUERY_KEY });
    },
  });
}
