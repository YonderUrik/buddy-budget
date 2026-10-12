"use client";

/**
 * Stato del pulsante «Categorizza con l'AI»: registra il consenso se manca, avvia la generazione e ricarica l'elenco
 * finché le proposte arrivano (contatori veri: esercenti senza proposta all'avvio e quanti ne restano).
 */

import * as React from "react";
import { toast } from "sonner";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { track } from "@/lib/analytics";
import { useGenerateAiSuggestionsMutation } from "@/lib/queries/categorization";
import { useAiCategorizationQuery, useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";

/** Ogni quanto si ricarica l'elenco mentre l'assistente lavora, e per quanti giri al massimo (~4 minuti). */
const GENERATE_POLL_MS = 4000;
const GENERATE_POLL_MAX_TICKS = 60;
/** Giri senza nuove proposte, dopo almeno una comparsa, oltre i quali si considera finito (restano i nomi non inviabili). */
const GENERATE_IDLE_TICKS = 8;

export interface UseAiGenerationOptions {
  /** Gruppi da decidere: quelli senza proposta sono il lavoro dell'assistente. */
  groups: readonly SuggestionGroup[];
  /** Ricarica l'elenco delle proposte. */
  refetch: () => Promise<unknown>;
}

export function useAiGeneration({ groups, refetch }: UseAiGenerationOptions) {
  const { data: assistant } = useAiCategorizationQuery();
  const generateMutation = useGenerateAiSuggestionsMutation();
  const consentMutation = useUpdateAiCategorizationMutation();
  const [generating, setGenerating] = React.useState(false);
  const [foundCount, setFoundCount] = React.useState<number | undefined>(undefined);
  const [startMissing, setStartMissing] = React.useState(0);
  const missingCount = groups.filter((group) => !group.suggestion).length;
  const missingRef = React.useRef(missingCount);
  React.useEffect(() => {
    missingRef.current = missingCount;
  });

  const start = React.useCallback(async () => {
    track("ai_suggestions_generate_clicked", { missing: missingRef.current, consentGiven: Boolean(assistant?.enabled) });
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
        toast.success(found === 1 ? "1 esercente ha una proposta" : `${found} esercenti hanno una proposta`);
      }
    }, GENERATE_POLL_MS);
  }, [assistant?.enabled, consentMutation, generateMutation, refetch]);

  return {
    assistant,
    missingCount,
    generating,
    foundCount,
    startMissing,
    done: Math.max(0, startMissing - missingCount),
    start,
  };
}
