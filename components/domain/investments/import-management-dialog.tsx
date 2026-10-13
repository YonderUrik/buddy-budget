"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Dialog «Importazioni» di Investimenti: i file caricati e la loro gestione, a un tocco dall'intestazione. */

import { DatabaseIcon } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogContent } from "@/components/domain/shared";
import { PanelDialogHeader } from "./dialog-parts";
import { ImportManagement } from "./import-management";

export interface ImportManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportManagementDialog({ open, onOpenChange }: ImportManagementDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent size="wide">
        <PanelDialogHeader icon={DatabaseIcon} title={tr("Importazioni")} description={tr("I file che hai caricato. Per aggiornare un periodo importa un file più recente: le operazioni già presenti vengono saltate.")} color="var(--swatch-slate)" />
        {open ? <ImportManagement embedded /> : null}
      </FormDialogContent>
    </Dialog>
  );
}
