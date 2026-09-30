"use client";

/** Movimenti · Categorie: board per gruppo (crea/sposta/modifica/elimina la categoria, colori automatici). */

import { CategoryBoard, DistributeColorsButton } from "@/components/domain/categories";
import { LoadError } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import { useCategoriesQuery } from "@/lib/queries/categories";

export default function MovimentiCategoriePage() {
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Trascina una categoria in un altro gruppo, oppure toccala per modificarla.</p>
        <DistributeColorsButton />
      </div>
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : isError ? (
        <LoadError message="Impossibile caricare le categorie." onRetry={() => refetch()} />
      ) : (
        <CategoryBoard categories={categories ?? []} currency={currency} />
      )}
    </>
  );
}
