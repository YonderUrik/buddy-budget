"use client";

/** Pagina Categorie: elenco categorie dell'utente con gestione completa (crea/rinomina/elimina/icona/colore). */

import { AddCategoryForm, CategoryRow } from "@/components/domain/categories";
import { Card } from "@/components/ui/card";
import { useCategoriesQuery } from "@/lib/queries/categories";

export default function CategoriePage() {
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();
  const safeCategories = categories ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Categorie</h1>
        <p className="text-sm text-muted-foreground">
          Gestisci le categorie di spesa: nome, tipo, icona e colore.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare le categorie.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <Card className="p-0">
          {safeCategories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
          <AddCategoryForm />
        </Card>
      )}
    </div>
  );
}
