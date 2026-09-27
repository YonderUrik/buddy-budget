"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { chunkGroups } from "@/lib/categorization/batch-apply";
import type {
  ApplyCategorizationInput,
  CreateRuleInput,
  UpdateRuleInput,
} from "@/lib/validation/categorization-rules";
import type { CategorizationRule } from "@/lib/db/schema/categorization-rules";
import { track } from "@/lib/analytics";

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

async function postApplyCategorization(
  input: ApplyCategorizationInput
): Promise<{ applied: number; rulesCreated: number }> {
  const response = await fetch("/api/transactions/categorize-apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Impossibile applicare la categorizzazione");
  }
  return response.json();
}

export interface ApplyCategorizationProgress {
  processedGroups: number;
  totalGroups: number;
  processedTransactions: number;
  totalTransactions: number;
}

/**
 * Esito parziale di un'applicazione in blocco interrotta a metà: quanto è stato scritto con
 * successo prima del gruppo che ha fatto fallire la richiesta, e quali gruppi (per indice
 * nell'array passato alla mutation) sono da considerare già applicati.
 */
export class ApplyCategorizationPartialError extends Error {
  constructor(
    message: string,
    public readonly partial: { applied: number; rulesCreated: number; appliedGroupIndexes: number[] }
  ) {
    super(message);
    this.name = "ApplyCategorizationPartialError";
  }
}

/**
 * Applica in blocco le scelte di categorizzazione spezzando i gruppi in più richieste sequenziali
 * (invece di un'unica richiesta con tutto il batch): l'operazione è comunque veloce (solo scritture
 * DB, nessuna chiamata esterna), ma dare un avanzamento granulare via `onProgress` è più utile di uno
 * spinner unico su batch grandi. Un blocco fallito interrompe i successivi (nessun retry automatico);
 * i gruppi già applicati con successo sono riportati in `ApplyCategorizationPartialError.partial` così
 * il chiamante può deselezionarli e lasciare selezionati solo quelli da ritentare.
 */
export function useApplyCategorizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groups,
      onProgress,
    }: {
      groups: ApplyCategorizationInput["groups"];
      onProgress: (progress: ApplyCategorizationProgress) => void;
    }) => {
      const totalGroups = groups.length;
      const totalTransactions = groups.reduce((sum, group) => sum + group.transactionIds.length, 0);
      let processedGroups = 0;
      let processedTransactions = 0;
      let applied = 0;
      let rulesCreated = 0;
      const appliedGroupIndexes: number[] = [];

      onProgress({ processedGroups, totalGroups, processedTransactions, totalTransactions });

      const batches = chunkGroups(groups);
      let start = 0;
      for (const batch of batches) {
        try {
          const result = await postApplyCategorization({ groups: batch });
          applied += result.applied;
          rulesCreated += result.rulesCreated;
        } catch (error) {
          throw new ApplyCategorizationPartialError(
            error instanceof Error ? error.message : "Impossibile applicare la categorizzazione",
            { applied, rulesCreated, appliedGroupIndexes }
          );
        }
        for (let i = 0; i < batch.length; i++) appliedGroupIndexes.push(start + i);
        start += batch.length;
        processedGroups += batch.length;
        processedTransactions += batch.reduce((sum, group) => sum + group.transactionIds.length, 0);
        onProgress({ processedGroups, totalGroups, processedTransactions, totalTransactions });
      }

      return { applied, rulesCreated };
    },
    onSuccess: (_result, { groups }) => track("categorization_applied", { groups: groups.length }),
    // Anche su fallimento parziale i gruppi già applicati hanno scritto dati reali: invalida sempre,
    // non solo al successo pieno.
    onSettled: () => {
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
    onSuccess: (rule) => {
      track("categorization_rule_saved", { matchType: rule.matchType });
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
    onSuccess: (rule) => {
      track("categorization_rule_saved", { matchType: rule.matchType });
      queryClient.invalidateQueries({ queryKey: CATEGORIZATION_RULES_QUERY_KEY });
    },
  });
}

/** Proposte aggiuntive dall'assistente per i gruppi rimasti senza proposta. Silenziosa se il livello è spento. */
export function useAiSuggestionsMutation() {
  return useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const response = await fetch("/api/transactions/categorize-suggestions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds }),
      });
      if (!response.ok) return { groups: [] as SuggestionGroup[] };
      return response.json() as Promise<{ groups: SuggestionGroup[] }>;
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
