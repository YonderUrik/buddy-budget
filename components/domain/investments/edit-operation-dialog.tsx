"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Dialog "Modifica operazione": riusa il form di registrazione con i valori salvati. Lo strumento non si cambia. */

import { FormDialogContent } from "@/components/domain/shared";
import { Dialog } from "@/components/ui/dialog";
import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import { PencilIcon } from "lucide-react";
import { PanelDialogHeader } from "./dialog-parts";
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
  const { t: tr } = useLocalization();
  return (
    <Dialog open={transaction !== null} onOpenChange={(open) => !open && onClose()}>
      <FormDialogContent>
        <PanelDialogHeader icon={PencilIcon} title={tr("Modifica operazione")} description={tr("Lo strumento non si cambia: per un altro strumento elimina e registra di nuovo.")} color="var(--swatch-indigo)" />
        {transaction ? (
          <RegisterOperationForm
            key={transaction.id}
            currency={currency}
            initial={initialFromTransaction(transaction, instrument ?? null)}
            editing={{ id: transaction.id, note: transaction.note }}
            onSuccess={onClose}
          />
        ) : null}
      </FormDialogContent>
    </Dialog>
  );
}
