"use client";

/** Campo nota libera di una transazione (auto o manuale) per il dettaglio: si salva quando perde il focus. */

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";

const NOTE_MAX_LENGTH = 500;

export interface TransactionNoteFieldProps {
  transaction: Transaction;
}

export function TransactionNoteField({ transaction }: TransactionNoteFieldProps) {
  const updateMutation = useUpdateTransactionMutation();
  const [note, setNote] = React.useState(transaction.note ?? "");
  const id = `nota-${transaction.id}`;

  function commit() {
    if (note.trim() === (transaction.note ?? "")) return;
    updateMutation.mutate({ id: transaction.id, input: { note } });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Nota
      </label>
      <Textarea
        id={id}
        value={note}
        maxLength={NOTE_MAX_LENGTH}
        rows={2}
        placeholder="Aggiungi una nota…"
        onChange={(event) => setNote(event.target.value)}
        onBlur={commit}
      />
      {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
    </div>
  );
}
