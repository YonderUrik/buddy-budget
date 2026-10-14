"use client";
import { useLocalization } from "@/lib/localization/provider";
import { translate, type MessageValues } from "@/lib/localization/messages";
import type { Language } from "@/lib/localization/config";

/**
 * Azioni di «Ricategorizza» con i loro avvisi: `run` sposta i movimenti e offre «Annulla» nel toast, `undoRun` riporta
 * com'era l'ultima ricategorizzazione. Le usano il dialog in Categorizza e l'avviso dopo il salvataggio di una regola.
 */

import * as React from "react";
import { toast } from "sonner";
import { useRecategorizeMutation, useUndoRecategorizeMutation } from "@/lib/queries/categorization";
import { errorToast } from "@/lib/support/request-report";
import type { RecategorizeApplyInput } from "@/lib/validation/categorization-rules";

/** Quanto resta in vista l'avviso con «Annulla» (più dei 4 s di default: serve il tempo di leggere). */
const UNDO_TOAST_DURATION_MS = 10_000;

function movedText(count: number, language: Language = "it"): string {
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
  return count === 1 ? tr("Un movimento ha cambiato categoria") : tr("{0} movimenti hanno cambiato categoria", {0: count});
}

function restoredText(count: number, language: Language = "it"): string {
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
  if (count === 0) return tr("Nessun movimento da riportare indietro: li hai già cambiati tu");
  return count === 1 ? tr("Un movimento è tornato com'era") : tr("{0} movimenti sono tornati com'erano", {0: count});
}

export type RecategorizeRunInput = Pick<RecategorizeApplyInput, "scope"> & Partial<RecategorizeApplyInput>;

export function useRecategorizeActions() {
  const { t: tr, language } = useLocalization();
  const { mutate: applyMutate, isPending: applying } = useRecategorizeMutation();
  const { mutate: undoMutate, isPending: undoing } = useUndoRecategorizeMutation();

  const undoRun = React.useCallback(
    (runId: string) =>
      undoMutate(runId, {
        onSuccess: (result) => toast.success(restoredText(result.restored, language)),
        onError: (error) => errorToast(error.message, "movimento"),
      }),
    [language, undoMutate]
  );

  const run = React.useCallback(
    (input: RecategorizeRunInput, options: { onSuccess?: () => void } = {}) =>
      applyMutate(input, {
        onSuccess: (result) => {
          options.onSuccess?.();
          if (result.changed === 0 || !result.runId) {
            toast(tr("Niente da cambiare: nel frattempo questi movimenti sono già cambiati"));
            return;
          }
          const runId = result.runId;
          toast.success(movedText(result.changed, language), {
            description: tr("Li trovi in «Messe dall'app»."),
            action: { label: tr("Annulla"), onClick: () => undoRun(runId) },
            duration: UNDO_TOAST_DURATION_MS,
          });
        },
        onError: (error) => errorToast(error.message, "movimento"),
      }),
    [applyMutate, language, tr, undoRun]
  );

  return { run, undoRun, applying, undoing };
}
