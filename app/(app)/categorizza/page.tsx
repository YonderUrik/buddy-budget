"use client";

/** Pagina "Categorizza": conferma rapida «a carte» delle proposte, o vista a elenco per lavorare in blocco. */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CategorizeListView, CategorizeSwipeDeck } from "@/components/domain/categorization";
import { LoadError, SegmentedControl, type SegmentedControlOption } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import type { DeckDecision } from "@/lib/categorization/swipe-deck";
import { useApplyCategorizationMutation, useCategorizeSuggestionsQuery } from "@/lib/queries/categorization";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";
import { useAiCategorizationQuery } from "@/lib/queries/notifications";

type View = "carte" | "elenco";
const VIEW_OPTIONS: readonly SegmentedControlOption<View>[] = [
  { value: "carte", label: "Una alla volta" },
  { value: "elenco", label: "Elenco" },
];

export default function CategorizzaPage() {
  useMarkMovementsSeen();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [view, setView] = React.useState<View>("carte");
  const { data: groups, isLoading, isError, refetch } = useCategorizeSuggestionsQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: categoryUsage } = useCategoryUsageQuery();
  const { data: assistant } = useAiCategorizationQuery();
  const applyMutation = useApplyCategorizationMutation();

  const groupByKey = React.useMemo(() => new Map((groups ?? []).map((group) => [group.groupKey, group])), [groups]);

  /** Salva le scelte fatte sulle carte; le regole nascono solo dove l'utente ha spuntato «Ricorda». */
  const saveDecisions = React.useCallback(
    async (decisions: DeckDecision[]) => {
      const items = decisions.flatMap((decision) => {
        const group = groupByKey.get(decision.groupKey);
        return group
          ? [{
              transactionIds: group.transactionIds,
              categoryId: decision.categoryId,
              excludedPercentage: decision.excludedPercentage,
              createRule: decision.remember,
              merchantKey: group.merchantKey,
            }]
          : [];
      });
      if (items.length === 0) return;
      try {
        await applyMutation.mutateAsync({ groups: items, onProgress: () => {} });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Impossibile salvare le scelte");
        throw error;
      }
    },
    [groupByKey, applyMutation]
  );

  const total = groups?.reduce((sum, group) => sum + group.transactionIds.length, 0) ?? 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-1">
        <Link href="/liquidita" className="-my-1 w-fit py-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
          ← Torna a Movimenti
        </Link>
        <h1 className="font-heading text-2xl font-medium text-foreground">Categorizza</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Caricamento in corso..." : total === 0 ? "Nessuna transazione da categorizzare" : `${total} transazioni in attesa.`}
        </p>
        {assistant?.available && !assistant.enabled && total > 0 && (
          <p className="text-sm text-muted-foreground">
            Vuoi una proposta già pronta per ogni esercente?{" "}
            <Link href="/impostazioni#impostazioni-assistente-categorie" className="underline underline-offset-2 hover:text-foreground">
              Attiva l&apos;assistente
            </Link>
            .
          </p>
        )}
      </div>

      <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="Modo di categorizzare" stretch className="sm:max-w-xs" />

      {isError ? (
        <LoadError message="Impossibile caricare le proposte di categorizzazione." onRetry={() => refetch()} />
      ) : view === "carte" ? (
        isLoading || !categories ? (
          <div className="mx-auto h-80 w-full max-w-sm animate-pulse rounded-2xl bg-muted" aria-busy="true" />
        ) : (
          <CategorizeSwipeDeck groups={groups ?? []} categories={categories} currency={currency} categoryUsage={categoryUsage} onSave={saveDecisions} />
        )
      ) : (
        <CategorizeListView />
      )}
    </div>
  );
}
