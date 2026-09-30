"use client";

/** Movimenti · Regole: le regole che assegnano da sole la categoria ai movimenti riconosciuti. */

import { RulesManager } from "@/components/domain/categorization";
import { LoadError } from "@/components/domain/shared";
import { useCategoriesQuery } from "@/lib/queries/categories";

export default function MovimentiRegolePage() {
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();
  return (
    <>
      <p className="text-sm text-muted-foreground">Le regole assegnano da sole la categoria ai movimenti che riconoscono.</p>
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : isError ? (
        <LoadError message="Impossibile caricare le categorie." onRetry={() => refetch()} />
      ) : (
        <RulesManager categories={categories ?? []} />
      )}
    </>
  );
}
