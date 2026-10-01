"use client";

/** Dialog "Modifica operazione": riusa il form di registrazione con i valori salvati. Lo strumento non si cambia. */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import { RegisterOperationForm } from "./register-operation-form";
import { initialFromTransaction } from "./register-operation-form.state";

export interface EditOperationDialogProps {
  /** Operazione da modificare; null = dialog chiuso. */
  transaction: InvestmentTransaction | null;
  instrument: Instrument | undefined;
  currency: string;
  onClose: () => void;
}

export function EditOperationDialog({ transaction, instrument, currency, onClose }: EditOperationDialogProps) {
  return (
    <Dialog open={transaction !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifica operazione</DialogTitle>
        </DialogHeader>
        {transaction ? (
          <RegisterOperationForm
            key={transaction.id}
            currency={currency}
            initial={initialFromTransaction(transaction, instrument ?? null)}
            editing={{ id: transaction.id, note: transaction.note }}
            onSuccess={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
