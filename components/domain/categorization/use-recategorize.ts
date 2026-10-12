"use client";

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

function movedText(count: number): string {
  return count === 1 ? "Un movimento ha cambiato categoria" : `${count} movimenti hanno cambiato categoria`;
}

function restoredText(count: number): string {
  if (count === 0) return "Nessun movimento da riportare indietro: li hai già cambiati tu";
  return count === 1 ? "Un movimento è tornato com'era" : `${count} movimenti sono tornati com'erano`;
}

export type RecategorizeRunInput = Pick<RecategorizeApplyInput, "scope"> & Partial<RecategorizeApplyInput>;

export function useRecategorizeActions() {
  const { mutate: applyMutate, isPending: applying } = useRecategorizeMutation();
  const { mutate: undoMutate, isPending: undoing } = useUndoRecategorizeMutation();

  const undoRun = React.useCallback(
    (runId: string) =>
      undoMutate(runId, {
        onSuccess: (result) => toast.success(restoredText(result.restored)),
        onError: (error) => errorToast(error.message, "movimento"),
      }),
    [undoMutate]
  );

  const run = React.useCallback(
    (input: RecategorizeRunInput, options: { onSuccess?: () => void } = {}) =>
      applyMutate(input, {
        onSuccess: (result) => {
          options.onSuccess?.();
          if (result.changed === 0 || !result.runId) {
            toast("Niente da cambiare: nel frattempo questi movimenti sono già cambiati");
            return;
          }
          const runId = result.runId;
          toast.success(movedText(result.changed), {
            description: "Li trovi in «Fatte da sole».",
            action: { label: "Annulla", onClick: () => undoRun(runId) },
            duration: UNDO_TOAST_DURATION_MS,
          });
        },
        onError: (error) => errorToast(error.message, "movimento"),
      }),
    [applyMutate, undoRun]
  );

  return { run, undoRun, applying, undoing };
}
