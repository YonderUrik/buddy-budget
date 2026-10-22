"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { Budget } from "@/lib/db/schema/budgets";
import type { AcceptProposalsInput, UpsertBudgetInput } from "@/lib/validation/budgets";
import type { BudgetMonthView } from "@/lib/views/budget-month";
import { pageText } from "@/lib/localization/page-text";

const BUDGETS_QUERY_KEY = ["budgets"] as const;
/** Prefix of every month of Liquidità · Budget: a budget change refreshes them all. */
const BUDGET_MONTH_QUERY_KEY = ["budget-month"] as const;

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
    onSuccess: (budget, { input }) => {
      if (input.monthlyAmount !== undefined) track("budget_set");
      if (input.rollover !== undefined) track("budget_rollover_toggled", { enabled: input.rollover });
      if (input.singleMonth) track("budget_single_month_set", { removed: input.singleMonth.amount === null });
      queryClient.invalidateQueries({ queryKey: BUDGET_MONTH_QUERY_KEY });
      // The saved row goes into the cache right away, so a field that reads it never sees the old value while the list refetches.
      queryClient.setQueryData<Budget[]>(BUDGETS_QUERY_KEY, (current) => [...(current ?? []).filter((b) => b.categoryId !== budget.categoryId), budget]);
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}

/** Removes the monthly budget of a category (the category is no longer tracked against a limit). */
export function useRemoveBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await fetch(`/api/budgets/${categoryId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(pageText("Impossibile togliere il budget"));
    },
    onSuccess: (_, categoryId) => {
      track("budget_removed");
      queryClient.invalidateQueries({ queryKey: BUDGET_MONTH_QUERY_KEY });
      queryClient.setQueryData<Budget[]>(BUDGETS_QUERY_KEY, (current) => current?.filter((b) => b.categoryId !== categoryId));
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}

/** Liquidità · Budget for one month (`YYYY-MM`), computed on the server; `undefined` = the current month. */
export function useBudgetMonthQuery(month: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: [...BUDGET_MONTH_QUERY_KEY, month ?? "current"],
    queryFn: async (): Promise<BudgetMonthView> => {
      const response = await fetch(`/api/budgets/month${month ? `?month=${month}` : ""}`);
      if (!response.ok) throw new Error(pageText("Impossibile caricare i budget"));
      return response.json();
    },
    placeholderData: (previous) => previous,
  });
}

/** Creates in one go the budgets kept from the app's proposals («Usa questi budget»). */
export function useAcceptProposalsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AcceptProposalsInput) => {
      const response = await fetch("/api/budgets/accept-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(pageText("Impossibile salvare i budget"));
      return response.json() as Promise<{ created: number }>;
    },
    onSuccess: ({ created }, input) => {
      track("budget_proposals_accepted", { count: created, changed: input.items.filter((item) => item.changed).length });
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BUDGET_MONTH_QUERY_KEY });
    },
  });
}
