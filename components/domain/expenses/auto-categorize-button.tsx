"use client";

/** Bottone "Categorizza automaticamente": scansiona le transazioni "Da categorizzare" e apre il wizard di conferma se trova suggerimenti. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useCategorizeSuggestionsQuery } from "@/lib/queries/transactions";
import type { Category } from "@/lib/db/schema/categories";
import type { CategorizeSuggestion } from "@/lib/calc/categorize-suggestions";
import { AutoCategorizeWizard } from "./auto-categorize-wizard";

export interface AutoCategorizeButtonProps {
  categories: Category[];
  currency: string;
}

export function AutoCategorizeButton({ categories, currency }: AutoCategorizeButtonProps) {
  const { refetch, isFetching, isError } = useCategorizeSuggestionsQuery();
  const [wizardSuggestions, setWizardSuggestions] = React.useState<CategorizeSuggestion[] | null>(null);
  const [showEmptyMessage, setShowEmptyMessage] = React.useState(false);

  async function handleClick() {
    setShowEmptyMessage(false);
    const result = await refetch();
    const suggestions = result.data ?? [];
    if (suggestions.length === 0) {
      setShowEmptyMessage(true);
      return;
    }
    setWizardSuggestions(suggestions);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isFetching}>
        {isFetching ? "Ricerca in corso..." : "Categorizza automaticamente"}
      </Button>
      {showEmptyMessage && (
        <p className="text-xs text-muted-foreground">Nessuna transazione simile trovata da suggerire.</p>
      )}
      {isError && <p className="text-xs text-destructive">Scansione non riuscita, riprova.</p>}
      {wizardSuggestions && (
        <AutoCategorizeWizard
          suggestions={wizardSuggestions}
          categories={categories}
          currency={currency}
          onClose={() => setWizardSuggestions(null)}
        />
      )}
    </div>
  );
}
