"use client";

/**
 * Pannello di modifica di una transazione manuale (descrizione, data, importo), aperto sotto la riga.
 * Ogni campo si salva quando perde il focus, come negli altri punti di editing inline dell'app.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/domain/accounts";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";
import { cn } from "@/lib/utils";

export interface TransactionEditPanelProps {
  transaction: Transaction;
  currency: string;
  onClose: () => void;
}

export function TransactionEditPanel({ transaction, currency, onClose }: TransactionEditPanelProps) {
  const updateMutation = useUpdateTransactionMutation();
  const isIncome = Number(transaction.amount) > 0;
  const [description, setDescription] = React.useState(transaction.description);
  const [amountValue, setAmountValue] = React.useState<number | null>(Math.abs(Number(transaction.amount)));
  const [date, setDate] = React.useState(transaction.date);
  const idPrefix = `edit-${transaction.id}`;

  function commitDescription() {
    if (description.trim() === "" || description === transaction.description) return;
    updateMutation.mutate({ id: transaction.id, input: { description } });
  }

  function commitAmount() {
    if (amountValue === null || amountValue === Math.abs(Number(transaction.amount))) return;
    updateMutation.mutate({ id: transaction.id, input: { amount: amountValue } });
  }

  function commitDate() {
    if (date === "" || date === transaction.date) return;
    updateMutation.mutate({ id: transaction.id, input: { date } });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-muted/50 px-4 py-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-description`} className="text-xs text-muted-foreground">
          Descrizione
        </label>
        <Input
          id={`${idPrefix}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
          className="h-9 bg-background text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${idPrefix}-date`} className="text-xs text-muted-foreground">
            Data
          </label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={commitDate}
            className="h-9 bg-background text-sm"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${idPrefix}-amount`} className="text-xs text-muted-foreground">
            {isIncome ? "Importo entrata" : "Importo uscita"}
          </label>
          <CurrencyInput
            id={`${idPrefix}-amount`}
            value={amountValue}
            onChange={setAmountValue}
            onBlur={commitAmount}
            currency={currency}
            className={cn("h-9 w-full bg-background text-right", isIncome && "text-pos")}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {updateMutation.isPending
            ? "Salvataggio in corso..."
            : updateMutation.isError
              ? "Salvataggio non riuscito, riprova."
              : "Le modifiche si salvano da sole."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Fatto
        </Button>
      </div>
    </div>
  );
}
