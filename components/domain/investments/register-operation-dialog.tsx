"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Dialog «Registra operazione», used by Investimenti and by «Aggiungi». It reads the portfolio with the same query and
 * period as the Portafoglio tab (no extra request there), so the instruments already held are suggested first.
 */

import * as React from "react";
import { Plus } from "lucide-react";
import { FormDialogContent } from "@/components/domain/shared";
import { Dialog } from "@/components/ui/dialog";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { heldInstruments, toTransactionInputs } from "@/lib/investments/view";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { PanelDialogHeader } from "./dialog-parts";
import { RegisterOperationForm, type RegisterOperationInitial } from "./register-operation-form";

export interface RegisterOperationDialogProps {
  /** Starting values (instrument, amounts); null closes the dialog. */
  initial: RegisterOperationInitial | null;
  onClose: () => void;
}

export function RegisterOperationDialog({ initial, onClose }: RegisterOperationDialogProps) {
  const { t: tr } = useLocalization();
  const overview = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD);
  const data = overview.data;
  const suggestions = React.useMemo(
    () => (data ? heldInstruments(toTransactionInputs(data), new Map(data.instruments.map((i) => [i.id, i])), toDateKey(startOfDay(new Date()))) : []),
    [data]
  );
  return (
    <Dialog open={initial !== null} onOpenChange={(open) => !open && onClose()}>
      <FormDialogContent>
        <PanelDialogHeader icon={Plus} title={tr("Registra operazione")} description={tr("Un acquisto, una vendita, un dividendo o un altro movimento del portafoglio.")} color="var(--swatch-indigo)" />
        {initial ? <RegisterOperationForm currency={data?.currency ?? "EUR"} initial={initial} heldInstruments={suggestions} onSuccess={onClose} /> : null}
      </FormDialogContent>
    </Dialog>
  );
}
