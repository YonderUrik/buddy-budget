"use client";

/** Icona + popover per leggere/editare la nota libera di una transazione (auto o manuale). */

import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";

const NOTE_MAX_LENGTH = 500;

export interface TransactionNotePopoverProps {
  transaction: Transaction;
}

export function TransactionNotePopover({ transaction }: TransactionNotePopoverProps) {
  const updateMutation = useUpdateTransactionMutation();
  const [note, setNote] = React.useState(transaction.note ?? "");
  const [open, setOpen] = React.useState(false);
  const hasNote = (transaction.note ?? "").trim() !== "";

  function commit() {
    if (note.trim() === (transaction.note ?? "")) return;
    updateMutation.mutate({ id: transaction.id, input: { note } });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) commit();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={
          hasNote
            ? "flex size-6 shrink-0 items-center justify-center rounded-md text-primary hover:bg-muted"
            : "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100"
        }
        aria-label={hasNote ? "Modifica nota" : "Aggiungi nota"}
        title={hasNote ? (transaction.note ?? undefined) : "Aggiungi nota"}
      >
        <NotebookPen className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Aggiungi una nota (es. a cosa si riferisce questa spesa)"
          className="min-h-20 text-sm"
          aria-label="Nota transazione"
        />
        {updateMutation.isError && (
          <p className="mt-1 text-xs text-destructive">Salvataggio non riuscito, riprova.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
