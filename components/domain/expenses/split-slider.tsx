"use client";

/** UI "Dividi": ripartisce l'importo di una transazione tra spesa effettiva e quota esclusa dal conteggio. */

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface SplitSliderProps {
  transaction: Transaction;
  currency: string;
  onClose: () => void;
}

export function SplitSlider({ transaction, currency, onClose }: SplitSliderProps) {
  const updateMutation = useUpdateTransactionMutation();
  const totalAmount = Math.abs(Number(transaction.amount));
  const [excluded, setExcluded] = React.useState(Math.abs(Number(transaction.excludedAmount)));

  function commit() {
    updateMutation.mutate({ id: transaction.id, input: { excludedAmount: excluded } }, { onSuccess: onClose });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa
        (rimborsi, quote di altri, giroconto).
      </p>
      <Slider
        value={[excluded]}
        min={0}
        max={totalAmount}
        step={0.01}
        disabled={updateMutation.isPending}
        onValueChange={([value]) => setExcluded(value)}
        onValueCommitted={commit}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
      {updateMutation.isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
      {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
    </div>
  );
}
