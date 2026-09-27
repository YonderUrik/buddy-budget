"use client";

/** Icona + popover per leggere/editare la nota libera di una transazione (auto o manuale). */

import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  const hasSaveError = updateMutation.isError;

  function commit() {
    if (note.trim() === (transaction.note ?? "")) return;
    updateMutation.mutate({ id: transaction.id, input: { note } });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      // Riapertura: l'utente sta per riprovare, non lasciare lo stato d'errore
      // precedente visibile mentre modifica di nuovo la nota.
      updateMutation.reset();
    } else {
      commit();
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(
          "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium hover:bg-muted sm:size-8 sm:px-0",
          hasSaveError
            ? "text-destructive"
            : hasNote
              ? "text-primary"
              : "text-muted-foreground sm:text-muted-foreground/50 sm:hover:text-muted-foreground"
        )}
        aria-label={
          hasSaveError
            ? "Salvataggio della nota non riuscito, riprova"
            : hasNote
              ? "Modifica nota"
              : "Aggiungi nota"
        }
        title={
          hasSaveError
            ? "Salvataggio della nota non riuscito, riprova"
            : hasNote
              ? (transaction.note ?? undefined)
              : "Aggiungi nota"
        }
      >
        <NotebookPen className="size-4" aria-hidden="true" />
        <span className="sm:sr-only">Nota</span>
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
