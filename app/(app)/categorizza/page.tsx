"use client";

/** Pagina "Categorizza": conferma rapida «a carte» delle proposte, o vista a elenco per lavorare in blocco. */

import * as React from "react";
import { toast } from "sonner";
import { AiProgressStrip, AiSuggestBanner, CategorizeListView, CategorizeSwipeDeck } from "@/components/domain/categorization";
import { BackLink, LoadError, SegmentedControl, type SegmentedControlOption } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import type { DeckDecision } from "@/lib/categorization/swipe-deck";
import { track } from "@/lib/analytics";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useApplyCategorizationMutation, useCategorizeSuggestionsQuery, useGenerateAiSuggestionsMutation } from "@/lib/queries/categorization";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";
import { useAiCategorizationQuery, useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";
import { errorToast } from "@/lib/support/request-report";

/** Ogni quanto si ricarica l'elenco mentre l'assistente lavora, e per quanti giri al massimo (~4 minuti). */
const GENERATE_POLL_MS = 4000;
const GENERATE_POLL_MAX_TICKS = 60;
/** Giri senza nuove proposte, dopo almeno una comparsa, oltre i quali si considera finito (restano i nomi non inviabili). */
const GENERATE_IDLE_TICKS = 8;

/** Da questa larghezza (breakpoint `md` del layout) compaiono tab, elenco e banner completo; sotto c'è solo la carta. */
const DESKTOP_QUERY = "(min-width: 768px)";

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
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const activeView: View = isDesktop ? view : "carte";
  const { data: groups, isLoading, isError, refetch } = useCategorizeSuggestionsQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: categoryUsage } = useCategoryUsageQuery();
  const { data: assistant } = useAiCategorizationQuery();
  const applyMutation = useApplyCategorizationMutation();
  const generateMutation = useGenerateAiSuggestionsMutation();
  const consentMutation = useUpdateAiCategorizationMutation();
  const [generating, setGenerating] = React.useState(false);
  const [foundCount, setFoundCount] = React.useState<number | undefined>(undefined);
  const missingRef = React.useRef(0);
  const [startMissing, setStartMissing] = React.useState(0);

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
        errorToast(error instanceof Error ? error.message : "Impossibile salvare le scelte", "movimento");
        throw error;
      }
    },
    [groupByKey, applyMutation]
  );

  const missingCount = groups?.filter((group) => !group.suggestion).length ?? 0;
  React.useEffect(() => {
    missingRef.current = missingCount;
  });

  /** Chiede le proposte (registrando prima il consenso se manca) e ricarica l'elenco finché arrivano. */
  async function handleGenerate() {
    track("ai_suggestions_generate_clicked", { missing: missingCount, consentGiven: Boolean(assistant?.enabled) });
    setFoundCount(undefined);
    setGenerating(true);
    try {
      if (!assistant?.enabled) await consentMutation.mutateAsync(true);
      const { status } = await generateMutation.mutateAsync();
      if (status !== "started") throw new Error("L'assistente non è disponibile");
    } catch (error) {
      setGenerating(false);
      toast.error(error instanceof Error ? error.message : "Impossibile avviare l'assistente");
      return;
    }
    const startedWith = missingRef.current;
    setStartMissing(startedWith);
    let ticks = 0;
    let idle = 0;
    let lastMissing = missingRef.current;
    const timer = setInterval(async () => {
      ticks += 1;
      await refetch();
      const changed = missingRef.current !== lastMissing;
      idle = changed ? 0 : idle + 1;
      lastMissing = missingRef.current;
      const settled = idle >= GENERATE_IDLE_TICKS && missingRef.current < startedWith;
      if (ticks >= GENERATE_POLL_MAX_TICKS || missingRef.current === 0 || settled) {
        clearInterval(timer);
        setGenerating(false);
        const found = Math.max(0, startedWith - missingRef.current);
        setFoundCount(found);
        toast.success(found === 1 ? "1 proposta pronta nelle carte" : `${found} proposte pronte nelle carte`);
      }
    }, GENERATE_POLL_MS);
  }

  const total = groups?.reduce((sum, group) => sum + group.transactionIds.length, 0) ?? 0;

  const banner =
    assistant?.available && total > 0 && (missingCount > 0 || generating || foundCount !== undefined) ? (
      <AiSuggestBanner
        missingCount={missingCount}
        consentGiven={Boolean(assistant.enabled)}
        generating={generating}
        foundCount={foundCount}
        onGenerate={handleGenerate}
        compact={!isDesktop}
      />
    ) : null;
  const progress = generating ? <AiProgressStrip done={Math.max(0, startMissing - missingCount)} total={startMissing} /> : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4 max-md:min-h-[calc(100dvh-3.5rem-var(--bottom-nav-offset,0px)-env(safe-area-inset-bottom))] sm:gap-6 sm:p-6 md:gap-5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <BackLink href="/liquidita" label="Movimenti" className="-my-1.5" />
          <h1 className="font-heading text-xl font-medium text-foreground md:text-2xl">Categorizza</h1>
          <p className="text-sm text-muted-foreground max-md:hidden">
            {isLoading ? "Caricamento in corso..." : total === 0 ? "Nessuna transazione da categorizzare" : `${total} transazioni in attesa.`}
          </p>
        </div>
        {!isDesktop ? banner : null}
      </div>

      {isDesktop ? banner : null}
      {progress}

      {isDesktop ? <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="Modo di categorizzare" stretch className="sm:max-w-xs" /> : null}

      <div className={cn("flex flex-col", activeView === "carte" && "max-md:flex-1")}>
        {isError ? (
          <LoadError message="Impossibile caricare le proposte di categorizzazione." onRetry={() => refetch()} />
        ) : activeView === "carte" ? (
          isLoading || !categories ? (
            <div className="mx-auto h-80 w-full max-w-sm animate-pulse rounded-2xl bg-muted" aria-busy="true" />
          ) : (
            <CategorizeSwipeDeck groups={groups ?? []} categories={categories} currency={currency} categoryUsage={categoryUsage} onSave={saveDecisions} />
          )
        ) : (
          <CategorizeListView />
        )}
      </div>
    </div>
  );
}
