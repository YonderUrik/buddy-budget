"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import type { AutoCategorizedGroup } from "@/lib/categorization/auto-review";
import { chunkGroups } from "@/lib/categorization/batch-apply";
import type {
  ApplyCategorizationInput,
  CreateRuleInput,
  UpdateRuleInput,
} from "@/lib/validation/categorization-rules";
import type { CategorizationRule } from "@/lib/db/schema/categorization-rules";
import { track } from "@/lib/analytics";

const SUGGESTIONS_QUERY_KEY = ["categorize-suggestions"] as const;
const AUTO_CATEGORIZED_QUERY_KEY = ["auto-categorized"] as const;
const CATEGORIZATION_RULES_QUERY_KEY = ["categorization-rules"] as const;

export type CategorizationRuleWithCategoryName = CategorizationRule & { categoryName: string };

/** Movimenti da categorizzare per esercente e quanti gruppi si applicherebbero da soli adesso. */
export interface CategorizeSuggestionsResponse {
  groups: SuggestionGroup[];
  /** `readyKeys`: gruppi con una proposta sicura che si applicherebbero da soli adesso. */
  autoApply: { enabled: boolean; ready: number; readyKeys: string[] };
}

async function fetchSuggestions(): Promise<CategorizeSuggestionsResponse> {
  const response = await fetch("/api/transactions/categorize-suggestions");
  if (!response.ok) {
    throw new Error("Impossibile caricare le proposte di categorizzazione");
  }
  return (await response.json()) as CategorizeSuggestionsResponse;
}

/** Gruppi di transazioni da categorizzare con le relative proposte (regole simili, scelte passate, assistente). */
export function useCategorizeSuggestionsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: SUGGESTIONS_QUERY_KEY, queryFn: fetchSuggestions, enabled });
}

/** Invalida tutto ciò che cambia quando le categorie dei movimenti cambiano. */
function invalidateCategorized(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: AUTO_CATEGORIZED_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["attention"] });
}

/** Esito di un'applicazione automatica: movimenti categorizzati da soli in tutto e per origine. */
export interface AutoApplyResponse {
  applied: number;
  groups: number;
  bySource: { regola: number; storico: number; assistente: number };
}

/** Applica subito regole e proposte sicure ai movimenti in attesa (la pagina lo chiede quando ne trova di pronte). */
export function useAutoApplyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/transactions/categorize-auto", { method: "POST" });
      if (!response.ok) throw new Error("Impossibile applicare le categorie sicure");
      return (await response.json()) as AutoApplyResponse;
    },
    onSuccess: (result) => {
      if (result.applied > 0) track("categorization_auto_applied", { count: result.applied, groups: result.groups });
      invalidateCategorized(queryClient);
    },
  });
}

/** Categorie applicate da sole e non ancora controllate («Fatte da sole»). */
export interface AutoCategorizedResponse {
  groups: AutoCategorizedGroup[];
  total: number;
  seenAt: string;
}

/** Gruppi di movimenti categorizzati da soli dall'ultimo controllo dell'utente. */
export function useAutoCategorizedQuery() {
  return useQuery({
    queryKey: AUTO_CATEGORIZED_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/transactions/auto-categorized");
      if (!response.ok) throw new Error("Impossibile caricare le categorie applicate da sole");
      return (await response.json()) as AutoCategorizedResponse;
    },
  });
}

/** «Va tutto bene»: le categorie applicate da sole fino a `until` escono dalla lista da controllare. */
export function useMarkAutoCategorizedSeenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ until, count }: { until: string; count: number }) => {
      const response = await fetch("/api/transactions/auto-categorized/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ until, count }),
      });
      if (!response.ok) throw new Error("Impossibile salvare il controllo");
    },
    onSuccess: (_result, { count }) => {
      track("categorization_auto_reviewed", { count });
      queryClient.invalidateQueries({ queryKey: AUTO_CATEGORIZED_QUERY_KEY });
    },
  });
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
    onSettled: () => invalidateCategorized(queryClient),
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

/** Chiede all'assistente le proposte per i movimenti già presenti; risponde subito, le proposte arrivano ricaricando l'elenco. */
export function useGenerateAiSuggestionsMutation() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/transactions/categorize-suggestions/generate", { method: "POST" });
      if (!response.ok) throw new Error("Impossibile avviare l'assistente");
      return (await response.json()) as { status: "started" | "disabled" | "no_key" };
    },
  });
}
