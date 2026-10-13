"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Icona + popover per leggere/editare la nota libera di una transazione (auto o manuale). */

import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";

const NOTE_MAX_LENGTH = 500;

export interface TransactionNotePopoverProps {
  transaction: Transaction;
}

export function TransactionNotePopover({ transaction }: TransactionNotePopoverProps) {
  const { t: tr } = useLocalization();
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
            ? tr("Salvataggio della nota non riuscito, riprova")
            : hasNote
              ? tr("Modifica nota")
              : tr("Aggiungi nota")
        }
        title={
          hasSaveError
            ? tr("Salvataggio della nota non riuscito, riprova")
            : hasNote
              ? (transaction.note ?? undefined)
              : tr("Aggiungi nota")
        }
      >
        <NotebookPen className="size-4" aria-hidden="true" />
        <span className="sm:sr-only">{tr("Nota")}</span>
      </PopoverTrigger>
      <PopoverContent align="end">
        {/* Sul telefono il popover è un foglio dal basso: titolo e «Fatto» danno contesto e un modo chiaro per chiudere. */}
        <PopoverTitle className="font-heading text-base font-semibold sm:sr-only">{tr("Nota")}</PopoverTitle>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={tr("Aggiungi una nota (es. a cosa si riferisce questa spesa)")}
          className="min-h-20 text-sm"
          aria-label={tr("Nota transazione")}
        />
        {updateMutation.isError && (
          <p className="mt-1 text-xs text-destructive">{tr("Salvataggio non riuscito, riprova.")}</p>
        )}
        <Button type="button" className="h-11 sm:hidden" onClick={() => handleOpenChange(false)}>{tr("Fatto")}</Button>
      </PopoverContent>
    </Popover>
  );
}
