"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { Budget } from "@/lib/db/schema/budgets";
import type { UpsertBudgetInput } from "@/lib/validation/budgets";
import { pageText } from "@/lib/localization/page-text";

const BUDGETS_QUERY_KEY = ["budgets"] as const;

async function fetchBudgets(): Promise<Budget[]> {
  const response = await fetch("/api/budgets");
  if (!response.ok) {
    throw new Error(pageText("Impossibile caricare i budget"));
  }
  return response.json();
}

/** Recupera i budget mensili per categoria dell'utente autenticato. */
export function useBudgetsQuery() {
  return useQuery({ queryKey: BUDGETS_QUERY_KEY, queryFn: fetchBudgets });
}

/** Crea o aggiorna il budget mensile di una categoria e invalida la cache. */
export function useUpsertBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, input }: { categoryId: string; input: UpsertBudgetInput }) => {
      const response = await fetch(`/api/budgets/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? pageText("Impossibile aggiornare il budget"));
      }
      return response.json() as Promise<Budget>;
    },
    onSuccess: () => {
      track("budget_set");
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}
