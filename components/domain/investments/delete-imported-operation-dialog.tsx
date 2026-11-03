"use client";

/** Confirmation before deleting an operation that came from an imported file: says that later imports leave it out. */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocalization } from "@/lib/localization/provider";

export interface DeleteImportedOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the security, shown in the title. */
  name: string;
  onConfirm: () => void;
}

export function DeleteImportedOperationDialog({ open, onOpenChange, name, onConfirm }: DeleteImportedOperationDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr("Eliminare l'operazione su {0}?", { 0: name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {tr("Viene da un file importato: anche i prossimi import dello stesso conto la lasciano fuori. Per riaverla, elimina quel file da «Gestisci importazioni» e importalo di nuovo.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{tr("Elimina")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
