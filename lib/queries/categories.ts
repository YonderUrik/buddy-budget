"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@/lib/db/schema/categories";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/validation/categories";
import type { CategoryUsageCounts } from "@/lib/categories/picker";

const CATEGORIES_QUERY_KEY = ["categories"] as const;

async function fetchCategories(): Promise<Category[]> {
  const response = await fetch("/api/categories");
  if (!response.ok) {
    throw new Error("Impossibile caricare le categorie");
  }
  return response.json();
}

/** Recupera la lista delle categorie dell'utente autenticato. */
export function useCategoriesQuery() {
  return useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: fetchCategories });
}

// Sotto-chiave di CATEGORIES_QUERY_KEY: le mutation sulle categorie la invalidano già per prefisso.
const CATEGORY_USAGE_QUERY_KEY = [...CATEGORIES_QUERY_KEY, "usage"] as const;

/** Gli utilizzi cambiano lentamente: niente refetch a ogni cambio categoria, così l'ordine del selettore resta stabile mentre si lavora. */
const CATEGORY_USAGE_STALE_TIME_MS = 5 * 60 * 1000;

async function fetchCategoryUsage(): Promise<CategoryUsageCounts> {
  const response = await fetch("/api/categories/usage");
  if (!response.ok) {
    throw new Error("Impossibile caricare l'utilizzo delle categorie");
  }
  return response.json();
}

/** Numero di transazioni recenti per categoria, usato dal selettore per mostrare in cima le più usate. */
export function useCategoryUsageQuery() {
  return useQuery({
    queryKey: CATEGORY_USAGE_QUERY_KEY,
    queryFn: fetchCategoryUsage,
    staleTime: CATEGORY_USAGE_STALE_TIME_MS,
  });
}

/** Crea una nuova categoria e invalida la lista al successo. */
export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile creare la categoria");
      }
      return response.json() as Promise<Category>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

/** Aggiorna una categoria esistente e invalida la lista al successo. */
export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCategoryInput }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile aggiornare la categoria");
      }
      return response.json() as Promise<Category>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

/** Elimina una categoria (riassegnando le transazioni collegate) e invalida la lista al successo. */
export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile eliminare la categoria");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

/** Ridistribuisce automaticamente i colori delle categorie non-fallback ed invalida la lista al successo. */
export function useDistributeColorsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/categories/distribute-colors", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile distribuire i colori");
      }
      return response.json() as Promise<Category[]>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}
