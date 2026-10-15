"use client";

/** Conferma dell'eliminazione di un obiettivo: dice che i saldi dei conti non cambiano. */

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

export interface DeleteGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function DeleteGoalDialog({ open, onOpenChange, name, pending, error, onConfirm }: DeleteGoalDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr("Eliminare «{0}»?", { 0: name })}</AlertDialogTitle>
          <AlertDialogDescription>{tr("L'obiettivo sparisce dalla lista. I saldi dei conti e gli investimenti non cambiano: le parti assegnate tornano libere.")}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{tr(error)}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending ? tr("Eliminazione…") : tr("Elimina")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
