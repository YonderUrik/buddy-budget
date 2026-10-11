"use client";

/** Pagina "Categorizza": conferma rapida «a carte» delle proposte, o vista a elenco per lavorare in blocco. */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AiSuggestBanner, CategorizeListView, CategorizeSwipeDeck } from "@/components/domain/categorization";
import { LoadError, SegmentedControl, type SegmentedControlOption } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import type { DeckDecision } from "@/lib/categorization/swipe-deck";
import { track } from "@/lib/analytics";
import { useApplyCategorizationMutation, useCategorizeSuggestionsQuery, useGenerateAiSuggestionsMutation } from "@/lib/queries/categorization";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";
import { useAiCategorizationQuery, useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";

/** Ogni quanto si ricarica l'elenco mentre l'assistente lavora, e per quanti giri al massimo (~4 minuti). */
const GENERATE_POLL_MS = 4000;
const GENERATE_POLL_MAX_TICKS = 60;
/** Giri senza nuove proposte, dopo almeno una comparsa, oltre i quali si considera finito (restano i nomi non inviabili). */
const GENERATE_IDLE_TICKS = 8;

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
  const generateMutation = useGenerateAiSuggestionsMutation();
  const consentMutation = useUpdateAiCategorizationMutation();
  const [generating, setGenerating] = React.useState(false);
  const [foundCount, setFoundCount] = React.useState<number | undefined>(undefined);
  const missingRef = React.useRef(0);
  const startMissingRef = React.useRef(0);

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
    startMissingRef.current = missingRef.current;
    let ticks = 0;
    let idle = 0;
    let lastMissing = missingRef.current;
    const timer = setInterval(async () => {
      ticks += 1;
      await refetch();
      const changed = missingRef.current !== lastMissing;
      idle = changed ? 0 : idle + 1;
      lastMissing = missingRef.current;
      const settled = idle >= GENERATE_IDLE_TICKS && missingRef.current < startMissingRef.current;
      if (ticks >= GENERATE_POLL_MAX_TICKS || missingRef.current === 0 || settled) {
        clearInterval(timer);
        setGenerating(false);
        setFoundCount(Math.max(0, startMissingRef.current - missingRef.current));
      }
    }, GENERATE_POLL_MS);
  }

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
      </div>

      {assistant?.available && total > 0 && (missingCount > 0 || generating || foundCount !== undefined) && (
        <AiSuggestBanner missingCount={missingCount} consentGiven={Boolean(assistant.enabled)} generating={generating} foundCount={foundCount} onGenerate={handleGenerate} />
      )}

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
