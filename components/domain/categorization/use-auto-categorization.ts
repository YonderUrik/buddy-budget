"use client";
import { useLocalization } from "@/lib/localization/provider";
import { translate, type MessageValues } from "@/lib/localization/messages";
import type { Language } from "@/lib/localization/config";

/**
 * Stato e azioni delle categorie applicate da sole in Categorizza: applica subito le proposte sicure che la pagina trova
 * pronte (e lo dice con un toast), corregge un gruppo di «Messe dall'app», accende l'opzione.
 */

import * as React from "react";
import { toast } from "sonner";
import type { AutoCategorizedGroup } from "@/lib/categorization/auto-review";
import { track } from "@/lib/analytics";
import {
  useApplyCategorizationMutation,
  useAutoApplyMutation,
  useAutoCategorizedQuery,
  type CategorizeSuggestionsResponse,
} from "@/lib/queries/categorization";
import { useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";
import { errorToast } from "@/lib/support/request-report";

/** «N movimenti categorizzati da soli» per il toast dopo un'applicazione automatica. */
export function appliedToastText(count: number, language: Language = "it"): string {
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
  return count === 1 ? tr("1 movimento categorizzato da solo") : tr("{0} movimenti categorizzati da soli", {0: count});
}

export interface UseAutoCategorizationOptions {
  suggestions?: CategorizeSuggestionsResponse;
  /** Quando sono arrivate le proposte: si prova ad applicare una volta per ogni caricamento. */
  dataUpdatedAt: number;
  /** Porta l'utente a «Messe dall'app» (azione del toast). */
  onShowApplied: () => void;
}

export function useAutoCategorization({ suggestions, dataUpdatedAt, onShowApplied }: UseAutoCategorizationOptions) {
  const { t: tr, language } = useLocalization();
  const autoQuery = useAutoCategorizedQuery();
  const applyMutation = useApplyCategorizationMutation();
  const autoApplyMutation = useAutoApplyMutation();
  const settingsMutation = useUpdateAiCategorizationMutation();
  const [correctingKey, setCorrectingKey] = React.useState<string | null>(null);
  const onShowRef = React.useRef(onShowApplied);
  React.useEffect(() => {
    onShowRef.current = onShowApplied;
  });

  // Se l'applicazione fallisce le proposte sicure restano fra quelle da decidere.
  const readyKeys = React.useMemo(
    () => (autoApplyMutation.isError ? new Set<string>() : new Set(suggestions?.autoApply.readyKeys ?? [])),
    [suggestions, autoApplyMutation.isError]
  );

  const { mutate: autoApply, isPending: autoApplying } = autoApplyMutation;
  const lastAttemptRef = React.useRef(0);
  React.useEffect(() => {
    if (readyKeys.size === 0 || autoApplying || lastAttemptRef.current === dataUpdatedAt) return;
    lastAttemptRef.current = dataUpdatedAt;
    autoApply(undefined, {
      onSuccess: (result) => {
        if (result.applied === 0) return;
        toast.success(appliedToastText(result.applied, language), {
          description: tr("Le trovi in «Messe dall'app»."),
          action: { label: tr("Guarda"), onClick: () => onShowRef.current() },
        });
      },
    });
  }, [readyKeys, autoApplying, dataUpdatedAt, autoApply, language, tr]);

  /** Una categoria applicata da sola non va: la si cambia per tutto il gruppo e, se richiesto, per i prossimi. */
  const correct = React.useCallback(
    async (group: AutoCategorizedGroup, categoryId: string, remember: boolean) => {
      setCorrectingKey(group.groupKey);
      try {
        await applyMutation.mutateAsync({
          groups: [{ transactionIds: group.transactionIds, categoryId, excludedPercentage: 0, createRule: remember, merchantKey: group.merchantKey }],
          onProgress: () => {},
        });
        track("categorization_auto_corrected", { source: group.source, count: group.transactionIds.length, remember, from: "categorizza" });
        toast.success(remember ? tr("Categoria cambiata, anche per i prossimi") : tr("Categoria cambiata"));
      } catch (error) {
        errorToast(error instanceof Error ? error.message : tr("Impossibile cambiare la categoria"), "movimento");
      } finally {
        setCorrectingKey(null);
      }
    },
    [applyMutation, tr]
  );

  const enableAutoApply = React.useCallback(() => {
    settingsMutation.mutate(
      { autoApply: true },
      {
        onSuccess: () => track("categorization_auto_apply_toggled", { enabled: true, from: "categorizza" }),
        onError: (error) => errorToast(error.message),
      }
    );
  }, [settingsMutation]);

  return {
    readyKeys,
    autoData: autoQuery.data,
    correct,
    correctingKey,
    enableAutoApply,
    enabling: settingsMutation.isPending,
    saveChoices: applyMutation.mutateAsync,
  };
}
