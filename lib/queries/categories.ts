"use client";

import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/lib/db/schema/categories";

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
