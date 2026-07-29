"use client";

/** UI "Dividi": ripartisce l'importo di una transazione (spesa o entrata) tra quota effettiva e quota esclusa dal conteggio. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";
import { clampExcluded, computeSplitExcluded } from "./split-slider.utils";

const SPLIT_SHORTCUTS = [2, 3, 4] as const;

export interface SplitSliderProps {
  transaction: Transaction;
  currency: string;
  onClose: () => void;
}

export function SplitSlider({ transaction, currency, onClose }: SplitSliderProps) {
  const updateMutation = useUpdateTransactionMutation();
  const totalAmount = Math.abs(Number(transaction.amount));
  const isIncome = Number(transaction.amount) > 0;
  const [excluded, setExcluded] = React.useState(Math.abs(Number(transaction.excludedAmount)));
  const [spentInput, setSpentInput] = React.useState(() => (totalAmount - excluded).toFixed(2));

  function commit(value: number) {
    updateMutation.mutate({ id: transaction.id, input: { excludedAmount: value } }, { onSuccess: onClose });
  }

  function applySplit(n: number) {
    const value = computeSplitExcluded(totalAmount, n);
    setExcluded(value);
    setSpentInput((totalAmount - value).toFixed(2));
    commit(value);
  }

  function commitSpentInput() {
    if (spentInput.trim() === "") {
      setSpentInput((totalAmount - excluded).toFixed(2));
      return;
    }
    const spent = clampExcluded(Number(spentInput), totalAmount);
    const value = clampExcluded(totalAmount - spent, totalAmount);
    setSpentInput((totalAmount - value).toFixed(2));
    if (value === excluded) return;
    setExcluded(value);
    commit(value);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {isIncome
          ? "Sposta il cursore per escludere una parte dal conteggio: è entrata sul conto, ma non è reddito reale (rimborsi, giroconto, storni)."
          : "Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)."}
      </p>
      <div className="flex gap-1.5">
        {SPLIT_SHORTCUTS.map((n) => (
          <Button
            key={n}
            type="button"
            variant="outline"
            size="sm"
            disabled={updateMutation.isPending}
            onClick={() => applySplit(n)}
          >
            ÷{n}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`spesa-effettiva-${transaction.id}`} className="text-xs text-muted-foreground">
          {isIncome ? "Entrata effettiva" : "Spesa effettiva"}
        </label>
        <Input
          id={`spesa-effettiva-${transaction.id}`}
          type="number"
          min={0}
          max={totalAmount}
          step={0.01}
          disabled={updateMutation.isPending}
          value={spentInput}
          onChange={(event) => setSpentInput(event.target.value)}
          onBlur={commitSpentInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="w-24"
        />
      </div>
      <Slider
        value={[excluded]}
        min={0}
        max={totalAmount}
        step={0.01}
        disabled={updateMutation.isPending}
        onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value;
          setExcluded(next);
          setSpentInput((totalAmount - next).toFixed(2));
        }}
        onValueCommitted={(value) => commit(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount))}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {isIncome ? "Entrata effettiva" : "Spesa effettiva"}: {formatCurrency(totalAmount - excluded, currency)}
        </span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
      {updateMutation.isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
      {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
    </div>
  );
}
