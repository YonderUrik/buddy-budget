"use client";

/** The free note of a transaction, written in place inside its detail: saved when the field loses focus. */

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import type { Transaction } from "@/lib/db/schema/transactions";
import { useLocalization } from "@/lib/localization/provider";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";

/** Longest note the server accepts. */
const NOTE_MAX_LENGTH = 500;

export interface MovementDetailNoteProps {
  transaction: Transaction;
}

export function MovementDetailNote({ transaction }: MovementDetailNoteProps) {
  const { t: tr } = useLocalization();
  const update = useUpdateTransactionMutation();
  const saved = transaction.note ?? "";
  const [note, setNote] = React.useState(saved);
  const id = React.useId();

  function commit() {
    if (note.trim() === saved.trim()) return;
    update.mutate({ id: transaction.id, input: { note } });
  }

  const status = update.isPending ? tr("Salvataggio…") : update.isError ? tr("Nota non salvata, riprova.") : update.isSuccess ? tr("Nota salvata") : null;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-text-2">{tr("Nota")}</label>
      <Textarea
        id={id}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={commit}
        maxLength={NOTE_MAX_LENGTH}
        rows={2}
        placeholder={tr("Scrivi qualcosa da ricordare su questo movimento")}
        className="min-h-16 rounded-2xl"
      />
      <p className="text-xs text-text-2 empty:hidden" aria-live="polite">{status}</p>
    </div>
  );
}
