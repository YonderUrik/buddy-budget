"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Pagina "Categorizza": «Da decidere» (carte o elenco per le proposte incerte e i movimenti senza proposta) e «Messe
 * dall'app» (le categorie applicate senza chiedere, da controllare e correggere). Le proposte sicure non passano dalle carte:
 * appena la pagina le trova le applica e lo dice. «Ricategorizza» rifà le categorie messe da sole con le regole di oggi.
 */

import * as React from "react";
import { EllipsisIcon, RefreshCwIcon } from "lucide-react";
import {
  AiProgressStrip,
  AiSuggestBanner,
  AutoApplyPrompt,
  AutoCategorizedList,
  CategorizeListView,
  CategorizeSwipeDeck,
  RecategorizeDialog,
  useAiGeneration,
  useAutoCategorization,
} from "@/components/domain/categorization";
import { LoadError, SegmentedControl, type SegmentedControlOption, PAGE_TITLE } from "@/components/domain/shared";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import type { DeckDecision } from "@/lib/categorization/swipe-deck";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useCategorizeSuggestionsQuery } from "@/lib/queries/categorization";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";
import { errorToast } from "@/lib/support/request-report";

/** Da questa larghezza (breakpoint `md` del layout) compaiono la scelta carte/elenco e il banner completo; sotto c'è solo la carta. */
const DESKTOP_QUERY = "(min-width: 768px)";

type Tab = "da-decidere" | "fatte";
type View = "carte" | "elenco";
const VIEW_OPTIONS: readonly SegmentedControlOption<View>[] = [
  { value: "carte", label: "Una alla volta" },
  { value: "elenco", label: "Elenco" },
];

export default function CategorizzaPage() {
  const { t: tr } = useLocalization();
  useMarkMovementsSeen();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [chosenTab, setChosenTab] = React.useState<Tab | null>(null);
  const [view, setView] = React.useState<View>("carte");
  const [recategorizing, setRecategorizing] = React.useState(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const activeView: View = isDesktop ? view : "carte";
  const { data: suggestions, dataUpdatedAt, isLoading, isError, refetch } = useCategorizeSuggestionsQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: categoryUsage } = useCategoryUsageQuery();
  const auto = useAutoCategorization({ suggestions, dataUpdatedAt, onShowApplied: () => setChosenTab("fatte") });

  const groups = React.useMemo(() => suggestions?.groups ?? [], [suggestions]);
  const toDecide = React.useMemo(() => groups.filter((group) => !auto.readyKeys.has(group.groupKey)), [groups, auto.readyKeys]);
  const groupByKey = React.useMemo(() => new Map(groups.map((group) => [group.groupKey, group])), [groups]);
  const toDecideTotal = toDecide.reduce((sum, group) => sum + group.transactionIds.length, 0);
  const autoApplyEnabled = suggestions?.autoApply.enabled ?? true;
  // Always opens on «Da decidere»: «Messe dall'app» is a history to look at on request, not work waiting for the user.
  const tab: Tab = chosenTab ?? "da-decidere";
  const generation = useAiGeneration({ groups: toDecide, refetch });
  const { saveChoices } = auto;

  /** Salva le scelte fatte sulle carte; le regole nascono solo dove l'utente ha spuntato «Usa sempre». */
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
        await saveChoices({ groups: items, onProgress: () => {} });
      } catch (error) {
        errorToast(error instanceof Error ? error.message : tr("Impossibile salvare le scelte"), "movimento");
        throw error;
      }
    },
    [groupByKey, saveChoices, tr]
  );

  const assistant = generation.assistant;
  const banner =
    assistant?.available && tab === "da-decidere" && toDecideTotal > 0 && (generation.missingCount > 0 || generation.generating || generation.foundCount !== undefined) ? (
      <AiSuggestBanner
        missingCount={generation.missingCount}
        consentGiven={Boolean(assistant.enabled)}
        generating={generation.generating}
        foundCount={generation.foundCount}
        onGenerate={generation.start}
        compact={!isDesktop}
        autoApplyEnabled={autoApplyEnabled}
      />
    ) : null;
  const tabOptions: readonly SegmentedControlOption<Tab>[] = [
    { value: "da-decidere", label: isLoading ? tr("Da decidere") : tr("Da decidere · {0}", { 0: toDecideTotal }) },
    { value: "fatte", label: tr("Messe dall'app") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4 max-md:min-h-[calc(100dvh-3.5rem-var(--bottom-nav-offset,0px)-env(safe-area-inset-bottom))] sm:gap-6 sm:p-6 md:gap-5">
      {/* In basso: il menu «⋯» sta all'altezza del titolo, non del link in alto. */}
      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className={PAGE_TITLE}>{tr("Categorizza")}</h1>
          <p className="text-sm text-muted-foreground max-md:hidden">
            {tr("Quando è abbastanza sicura l'app mette la categoria da sola: qui scegli le altre e controlli quelle già messe.")}</p>
        </div>
        {!isDesktop ? banner : null}
        {/* Strumento per chi cambia le regole: in un menu, così la pagina mostra solo le due schede. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 shrink-0 cursor-pointer md:size-9")}
            aria-label={tr("Altre azioni")}
            disabled={!categories}
          >
            <EllipsisIcon className="size-5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-64">
            <DropdownMenuItem className="min-h-11 items-start gap-2 py-2" onClick={() => setRecategorizing(true)}>
              <RefreshCwIcon className="mt-0.5 size-4" aria-hidden="true" />
              <span className="flex flex-col gap-0.5">
                <span>{tr("Ricategorizza")}</span>
                <span className="text-xs text-muted-foreground">{tr("Rifà le categorie messe dall'app con le regole di oggi")}</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {categories ? <RecategorizeDialog open={recategorizing} onOpenChange={setRecategorizing} categories={categories} currency={currency} /> : null}

      <SegmentedControl options={tabOptions} value={tab} onChange={setChosenTab} ariaLabel={tr("Movimenti da decidere o già categorizzati")} stretch className="sm:max-w-sm" />
      {suggestions && !autoApplyEnabled ? <AutoApplyPrompt onEnable={auto.enableAutoApply} pending={auto.enabling} /> : null}
      {isDesktop ? banner : null}
      {generation.generating ? <AiProgressStrip done={generation.done} total={generation.startMissing} /> : null}

      {tab === "da-decidere" ? (
        <>
          {isDesktop ? <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel={tr("Modo di categorizzare")} /> : null}
          <div className={cn("flex flex-col", activeView === "carte" && "max-md:flex-1")}>
            {isError ? (
              <LoadError message={tr("Impossibile caricare le proposte di categorizzazione.")} onRetry={() => refetch()} />
            ) : activeView === "carte" ? (
              isLoading || !categories ? (
                <div className="mx-auto h-80 w-full max-w-sm animate-pulse rounded-2xl bg-muted" aria-busy="true" />
              ) : (
                <CategorizeSwipeDeck groups={toDecide} categories={categories} currency={currency} categoryUsage={categoryUsage} onSave={saveDecisions} />
              )
            ) : (
              <CategorizeListView groups={toDecide} isLoading={isLoading} />
            )}
          </div>
        </>
      ) : !auto.autoData || !categories ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <AutoCategorizedList
          groups={auto.autoData.groups}
          total={auto.autoData.total}
          categories={categories}
          currency={currency}
          categoryUsage={categoryUsage}
          correctingKey={auto.correctingKey}
          onCorrect={auto.correct}
          autoApplyEnabled={autoApplyEnabled}
        />
      )}
    </div>
  );
}
