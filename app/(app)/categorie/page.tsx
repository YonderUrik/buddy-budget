"use client";

/** Pagina Categorie: elenco categorie dell'utente con gestione completa (crea/rinomina/elimina/icona/colore). */

import { CategoryGroupedList, DistributeColorsButton } from "@/components/domain/categories";
import { RulesManager } from "@/components/domain/categorization";
import { LoadError } from "@/components/domain/shared";
import { useCategoriesQuery } from "@/lib/queries/categories";

export default function CategoriePage() {
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();
  const safeCategories = categories ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Categorie</h1>
          <p className="text-sm text-muted-foreground">
            Le spese sono divise in quattro gruppi: Dovute, Volute, Te futuro e Saltuarie.
          </p>
        </div>
        <DistributeColorsButton />
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : isError ? (
        <LoadError message="Impossibile caricare le categorie." onRetry={() => refetch()} />
      ) : (
        <CategoryGroupedList categories={safeCategories} />
      )}

      {!isLoading && !isError && <RulesManager categories={safeCategories} />}
    </div>
  );
}
