"use client";

/** Pagina Categorie: board per gruppo (crea/sposta/modifica/elimina) e, in una scheda separata, le regole di categorizzazione. */

import * as React from "react";
import { CategoryBoard, DistributeColorsButton } from "@/components/domain/categories";
import { RulesManager } from "@/components/domain/categorization";
import { LoadError, SegmentedControl } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import { useCategoriesQuery } from "@/lib/queries/categories";

type CategoriesTab = "categorie" | "regole";

const TAB_OPTIONS = [
  { value: "categorie", label: "Categorie" },
  { value: "regole", label: "Regole" },
] as const;

export default function CategoriePage() {
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();
  const [tab, setTab] = React.useState<CategoriesTab>("categorie");
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const safeCategories = categories ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Categorie</h1>
          <p className="text-sm text-muted-foreground">
            {tab === "categorie"
              ? "Trascina una categoria in un altro gruppo, oppure toccala per modificarla."
              : "Le regole assegnano da sole la categoria ai movimenti che riconoscono."}
          </p>
        </div>
        {tab === "categorie" && <DistributeColorsButton />}
      </div>

      <SegmentedControl<CategoriesTab> ariaLabel="Sezione" options={TAB_OPTIONS} value={tab} onChange={setTab} className="sm:self-start" stretch />

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : isError ? (
        <LoadError message="Impossibile caricare le categorie." onRetry={() => refetch()} />
      ) : tab === "categorie" ? (
        <CategoryBoard categories={safeCategories} currency={currency} />
      ) : (
        <RulesManager categories={safeCategories} />
      )}
    </div>
  );
}
