"use client";

/** Pagina "Categorizza": revisione delle proposte di categorizzazione automatica, raggruppate per merchant. */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CategorizeGroupRow } from "@/components/domain/categorization";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import type { Category } from "@/lib/db/schema/categories";
import { useApplyCategorizationMutation, useCategorizeSuggestionsQuery } from "@/lib/queries/categorization";
import { useCategoriesQuery } from "@/lib/queries/categories";

interface GroupOverride {
  selected: boolean;
  categoryId: string;
  excludedPercentage: number;
}

/** Categoria proposta di default per un gruppo: quella suggerita, altrimenti la prima categoria compatibile con la direzione. */
function defaultCategoryId(group: SuggestionGroup, categories: Category[]): string {
  if (group.suggestion) return group.suggestion.suggestedCategoryId;
  const isIncome = group.totalAmount > 0;
  const candidate = categories
    .filter((c) => !c.isFallback && (isIncome ? c.type === "entrata" : c.type !== "entrata"))
    .sort((a, b) => a.name.localeCompare(b.name))[0];
  if (candidate) return candidate.id;
  return categories.find((c) => c.isFallback)?.id ?? "";
}

export default function CategorizzaPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: groups, isLoading, isError } = useCategorizeSuggestionsQuery();
  const { data: categories } = useCategoriesQuery();
  const applyMutation = useApplyCategorizationMutation();
  const [overrides, setOverrides] = React.useState<Map<string, GroupOverride>>(new Map());

  const safeGroups = groups ?? [];
  const safeCategories = categories ?? [];

  function getOverride(group: SuggestionGroup): GroupOverride {
    return (
      overrides.get(group.merchantKey) ?? {
        selected: false,
        categoryId: defaultCategoryId(group, safeCategories),
        excludedPercentage: group.suggestion?.suggestedSplitPercentage ?? 0,
      }
    );
  }

  function updateOverride(group: SuggestionGroup, patch: Partial<GroupOverride>) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(group.merchantKey, { ...getOverride(group), ...patch });
      return next;
    });
  }

  function handleSelectAll(selectAll: boolean) {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const group of safeGroups) {
        next.set(group.merchantKey, { ...getOverride(group), selected: selectAll });
      }
      return next;
    });
  }

  const selectedGroups = safeGroups.filter((group) => getOverride(group).selected);
  const totalTransactionCount = safeGroups.reduce((sum, group) => sum + group.transactionIds.length, 0);

  function handleApply() {
    if (selectedGroups.length === 0) return;
    applyMutation.mutate(
      {
        groups: selectedGroups.map((group) => {
          const override = getOverride(group);
          return {
            transactionIds: group.transactionIds,
            categoryId: override.categoryId,
            excludedPercentage: override.excludedPercentage,
            createRule: true,
            merchantKey: group.merchantKey,
          };
        }),
      },
      {
        onSuccess: (result) => {
          toast.success(`${result.applied} transazioni categorizzate, ${result.rulesCreated} regole create`);
          setOverrides(new Map());
        },
      }
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/spese"
          className="w-fit text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          ← Torna a Transazioni
        </Link>
        <h1 className="font-heading text-2xl font-medium text-foreground">Categorizza</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Caricamento in corso..."
            : totalTransactionCount === 0
              ? "Nessuna transazione da categorizzare"
              : `${totalTransactionCount} transazioni in attesa di categorizzazione`}
        </p>
      </div>

      {!isLoading && !isError && safeGroups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => handleSelectAll(true)}>
              Seleziona tutto
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => handleSelectAll(false)}>
              Deseleziona tutto
            </Button>
          </div>
          <Button type="button" onClick={handleApply} disabled={selectedGroups.length === 0 || applyMutation.isPending}>
            Applica selezionate ({selectedGroups.length})
          </Button>
        </div>
      )}

      {applyMutation.isError && (
        <p className="text-sm text-destructive">
          {applyMutation.error instanceof Error ? applyMutation.error.message : "Impossibile applicare la categorizzazione"}
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Impossibile caricare le proposte di categorizzazione.</p>
      ) : safeGroups.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nessuna transazione da categorizzare</Card>
      ) : (
        <Card className="p-0">
          {safeGroups.map((group) => {
            const override = getOverride(group);
            return (
              <CategorizeGroupRow
                key={group.merchantKey}
                group={group}
                categories={safeCategories}
                currency={currency}
                selected={override.selected}
                categoryId={override.categoryId}
                excludedPercentage={override.excludedPercentage}
                onToggleSelected={(selected) => updateOverride(group, { selected })}
                onCategoryChange={(categoryId) => updateOverride(group, { categoryId })}
                onExcludedPercentageChange={(excludedPercentage) => updateOverride(group, { excludedPercentage })}
              />
            );
          })}
        </Card>
      )}
    </div>
  );
}
