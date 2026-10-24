"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Dialog «Nuovo movimento»: the movement form in a full-screen panel on the phone, used by Liquidità and by «Aggiungi». */

import { ReceiptTextIcon } from "lucide-react";
import { PanelDialogHeader } from "@/components/domain/investments/light";
import { FormDialogContent } from "@/components/domain/shared";
import { Dialog } from "@/components/ui/dialog";
import type { Category } from "@/lib/db/schema/categories";
import { AddTransactionForm } from "./add-transaction-form";

export interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  currency: string;
  /** Opens «Nuovo conto» instead, for a user without a manual account. */
  onAddAccount?: () => void;
}

export function AddTransactionDialog({ open, onOpenChange, categories, currency, onAddAccount }: AddTransactionDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent>
        <PanelDialogHeader className="pr-10" icon={ReceiptTextIcon} title={tr("Nuovo movimento")} description={tr("Una spesa o un'entrata su un conto manuale.")} />
        <AddTransactionForm categories={categories} currency={currency} onSuccess={() => onOpenChange(false)} onAddAccount={onAddAccount} />
      </FormDialogContent>
    </Dialog>
  );
}
