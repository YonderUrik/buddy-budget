"use client";

/** Pagina "Categorizza": revisione delle proposte di categorizzazione automatica, raggruppate per merchant. */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CategorizeGroupRow } from "@/components/domain/categorization";
import { LoadError, ProgressBar } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { authClient } from "@/lib/auth/client";
import type { CategorizeSuggestion, SuggestionGroup } from "@/lib/categorization/suggest";
import type { Category } from "@/lib/db/schema/categories";
import {
  ApplyCategorizationPartialError,
  type ApplyCategorizationProgress,
  useAiSuggestionsMutation,
  useApplyCategorizationMutation,
  useCategorizeSuggestionsQuery,
} from "@/lib/queries/categorization";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";

/** Testo della barra di avanzamento durante l'applicazione in blocco. */
function applyProgressLabel(progress: ApplyCategorizationProgress): string {
  const noun = progress.totalTransactions === 1 ? "transazione" : "transazioni";
  return `Applicate ${progress.processedTransactions} di ${progress.totalTransactions} ${noun}`;
}

interface GroupOverride {
  selected: boolean;
  categoryId: string;
  excludedPercentage: number;
}

/**
 * Categoria proposta di default per un gruppo: **solo** quella suggerita, mai un default arbitrario.
 * Un gruppo senza proposta deve restare senza categoria scelta finché l'utente non ne seleziona una a
 * mano dal dropdown — un default alfabetico sarebbe indistinguibile da una proposta reale e rischierebbe
 * di essere applicato (e trasformato in una regola "appresa" permanente) senza che l'utente se ne accorga.
 */
function defaultCategoryId(group: SuggestionGroup): string {
  return group.suggestion?.suggestedCategoryId ?? "";
}

/** Esiste almeno una categoria (non fallback) compatibile con la direzione del gruppo. */
function hasCompatibleCategory(group: SuggestionGroup, categories: Category[]): boolean {
  const isIncome = group.totalAmount > 0;
  return categories.some((c) => !c.isFallback && (isIncome ? c.type === "entrata" : c.type !== "entrata"));
}

/**
 * Motivo per cui un gruppo non può essere selezionato/applicato in questo momento: o non esiste affatto
 * una categoria compatibile con la sua direzione (caso limite), oppure il gruppo non ha ancora una
 * categoria scelta (nessuna proposta e l'utente non ne ha selezionata una manualmente) — in entrambi i
 * casi la selezione/applicazione resta bloccata finché la condizione non cambia.
 */
function disabledReason(group: SuggestionGroup, categories: Category[], categoryId: string): string | undefined {
  if (!hasCompatibleCategory(group, categories)) return "Nessuna categoria disponibile per questa direzione";
  if (categoryId === "") return "Scegli una categoria per continuare";
  return undefined;
}

export default function CategorizzaPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: groups, isLoading, isError, refetch } = useCategorizeSuggestionsQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: categoryUsage } = useCategoryUsageQuery();
  const applyMutation = useApplyCategorizationMutation();
  const aiSuggestionsMutation = useAiSuggestionsMutation();
  const [overrides, setOverrides] = React.useState<Map<string, GroupOverride>>(new Map());
  const [aiSuggestionsByMerchant, setAiSuggestionsByMerchant] = React.useState<Map<string, CategorizeSuggestion>>(
    new Map()
  );
  const [applyProgress, setApplyProgress] = React.useState<ApplyCategorizationProgress | null>(null);
  const aiRequestedRef = React.useRef(false);

  // Richiama l'assistente una sola volta per i gruppi rimasti senza proposta, appena i dati sono
  // arrivati. Un fallimento non produce mai un errore visibile: la mutation stessa risolve sempre
  // con { groups: [] } in quel caso, quindi qui c'è solo il caso "nessuna proposta aggiuntiva".
  React.useEffect(() => {
    if (isLoading || isError || !groups || aiRequestedRef.current) return;
    aiRequestedRef.current = true;

    const unsuggestedIds = groups.filter((group) => !group.suggestion).flatMap((group) => group.transactionIds);
    if (unsuggestedIds.length === 0) return;

    aiSuggestionsMutation.mutate(unsuggestedIds, {
      onSuccess: (result) => {
        setAiSuggestionsByMerchant((prev) => {
          const next = new Map(prev);
          for (const group of result.groups) {
            if (group.suggestion) next.set(group.groupKey, group.suggestion);
          }
          return next;
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isError, groups]);

  const safeGroups = React.useMemo(() => {
    return (groups ?? []).map((group) => {
      if (group.suggestion) return group;
      const aiSuggestion = aiSuggestionsByMerchant.get(group.groupKey);
      return aiSuggestion ? { ...group, suggestion: aiSuggestion } : group;
    });
  }, [groups, aiSuggestionsByMerchant]);
  const safeCategories = categories ?? [];

  function getOverride(group: SuggestionGroup): GroupOverride {
    return (
      overrides.get(group.groupKey) ?? {
        selected: false,
        categoryId: defaultCategoryId(group),
        excludedPercentage: group.suggestion?.suggestedSplitPercentage ?? 0,
      }
    );
  }

  function updateOverride(group: SuggestionGroup, patch: Partial<GroupOverride>) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(group.groupKey, { ...getOverride(group), ...patch });
      return next;
    });
  }

  function handleSelectAll(selectAll: boolean) {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const group of safeGroups) {
        const override = getOverride(group);
        // Un gruppo senza categoria compatibile, o senza ancora una categoria scelta, non può mai
        // essere selezionato da "Seleziona tutto" — solo una scelta esplicita dal dropdown lo sblocca.
        if (selectAll && disabledReason(group, safeCategories, override.categoryId)) continue;
        next.set(group.groupKey, { ...override, selected: selectAll });
      }
      return next;
    });
  }

  const selectedGroups = safeGroups.filter(
    (group) => getOverride(group).selected && !disabledReason(group, safeCategories, getOverride(group).categoryId)
  );
  const totalTransactionCount = safeGroups.reduce((sum, group) => sum + group.transactionIds.length, 0);
  const selectedTransactionCount = selectedGroups.reduce((sum, group) => sum + group.transactionIds.length, 0);
  const selectableGroupCount = safeGroups.filter(
    (group) => !disabledReason(group, safeCategories, getOverride(group).categoryId)
  ).length;
  const allSelected = selectableGroupCount > 0 && selectedGroups.length === selectableGroupCount;

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
        onProgress: setApplyProgress,
      },
      {
        onSuccess: (result) => {
          toast.success(`${result.applied} transazioni categorizzate, ${result.rulesCreated} regole create`);
          setOverrides(new Map());
          setApplyProgress(null);
        },
        onError: (error) => {
          // Un blocco fallito interrompe i successivi: i gruppi già applicati con successo escono
          // dalla selezione (sono già stati scritti), quelli non ancora processati restano selezionati
          // per poter ritentare senza doverli ricercare/riselezionare.
          if (error instanceof ApplyCategorizationPartialError) {
            const appliedGroupKeys = new Set(
              error.partial.appliedGroupIndexes.map((index) => selectedGroups[index].groupKey)
            );
            setOverrides((prev) => {
              const next = new Map(prev);
              for (const key of appliedGroupKeys) next.delete(key);
              return next;
            });
            toast.error(
              `Applicate ${error.partial.applied} transazioni prima dell'errore, le altre restano selezionate: ${error.message}`
            );
          }
          setApplyProgress(null);
        },
      }
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/movimenti"
          className="-my-1 w-fit py-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          ← Torna a Movimenti
        </Link>
        <h1 className="font-heading text-2xl font-medium text-foreground">Categorizza</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Caricamento in corso..."
            : totalTransactionCount === 0
              ? "Nessuna transazione da categorizzare"
              : `${totalTransactionCount} transazioni in attesa, raggruppate per esercente.`}
        </p>
        {!isLoading && totalTransactionCount > 0 && (
          <p className="text-sm text-muted-foreground">
            Controlla la categoria proposta, spunta i gruppi giusti e premi{" "}
            <span className="font-medium text-foreground">Applica</span>: da lì in poi lo stesso esercente verrà
            categorizzato da solo. Cambiare categoria seleziona il gruppo.
          </p>
        )}
        {aiSuggestionsMutation.isPending && (
          <p className="text-xs text-muted-foreground">Ricerca di altre proposte in corso…</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <LoadError message="Impossibile caricare le proposte di categorizzazione." onRetry={() => refetch()} />
      ) : safeGroups.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nessuna transazione da categorizzare</Card>
      ) : (
        <>
          <Card className="gap-0 p-0">
            <label className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
              <Checkbox
                checked={allSelected}
                disabled={selectableGroupCount === 0 || applyMutation.isPending}
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
              />
              <span>
                Seleziona tutti{" "}
                <span className="tabular-nums">
                  ({selectableGroupCount} {selectableGroupCount === 1 ? "gruppo pronto" : "gruppi pronti"})
                </span>
              </span>
            </label>
            {safeGroups.map((group) => {
              const override = getOverride(group);
              return (
                <CategorizeGroupRow
                  key={group.groupKey}
                  group={group}
                  categories={safeCategories}
                  currency={currency}
                  selected={override.selected}
                  categoryId={override.categoryId}
                  categoryUsage={categoryUsage}
                  excludedPercentage={override.excludedPercentage}
                  disabledReason={disabledReason(group, safeCategories, override.categoryId)}
                  onToggleSelected={(selected) => updateOverride(group, { selected })}
                  // Scegliere una categoria è già una conferma: il gruppo si seleziona da solo.
                  onCategoryChange={(categoryId) => updateOverride(group, { categoryId, selected: true })}
                  onExcludedPercentageChange={(excludedPercentage) => updateOverride(group, { excludedPercentage })}
                />
              );
            })}
          </Card>

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
            {applyMutation.isPending && applyProgress ? (
              <div className="flex flex-col gap-1">
                <ProgressBar
                  label={applyProgressLabel(applyProgress)}
                  state={{
                    kind: "determinate",
                    value: applyProgress.processedTransactions,
                    max: Math.max(applyProgress.totalTransactions, 1),
                  }}
                />
                <p className="text-xs text-muted-foreground">{applyProgressLabel(applyProgress)}</p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {selectedGroups.length === 0 ? (
                    "Nessun gruppo selezionato"
                  ) : (
                    <>
                      <span className="font-medium text-foreground tabular-nums">{selectedTransactionCount}</span>{" "}
                      {selectedTransactionCount === 1 ? "transazione" : "transazioni"} in {selectedGroups.length}{" "}
                      {selectedGroups.length === 1 ? "gruppo" : "gruppi"}
                    </>
                  )}
                </p>
                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={selectedGroups.length === 0 || applyMutation.isPending}
                  className="h-10 shrink-0 px-5 sm:h-9"
                >
                  Applica
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
