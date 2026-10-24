"use client";

/**
 * Forms opened by «Aggiungi» over the current page: the same dialogs the sections use, with the data they need read
 * here. Loaded only when the user picks one (`next/dynamic` in the provider), so the app layout stays light.
 */

import * as React from "react";
import { Plus, ReceiptTextIcon } from "lucide-react";
import { AddAccountDialog } from "@/components/domain/liquidity/add-account-dialog";
import { AddDebtDialog } from "@/components/domain/debts";
import { AddTransactionForm } from "@/components/domain/expenses";
import { InvestmentImportDialog, PanelDialogHeader, RegisterOperationForm } from "@/components/domain/investments";
import { FormDialogContent } from "@/components/domain/shared";
import { AddSubscriptionDialog } from "@/components/domain/subscriptions";
import { Dialog } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/client";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { heldInstruments, toTransactionInputs } from "@/lib/investments/view";
import { useLocalization } from "@/lib/localization/provider";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import type { QuickAddFormId } from "@/lib/quick-add/actions";

export interface QuickAddFormsProps {
  /** Form to show; null closes it. */
  form: QuickAddFormId | null;
  onClose: () => void;
  /** Another form from inside this one (e.g. «Aggiungi un conto» from a movement without accounts). */
  onSwitch: (form: QuickAddFormId) => void;
}

function RegisterOperationDialog({ open, onClose, currency }: { open: boolean; onClose: () => void; currency: string }) {
  const { t: tr } = useLocalization();
  // Same query and period as the Portafoglio tab: the instruments already held are suggested first.
  const overview = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD);
  const data = overview.data;
  const suggestions = React.useMemo(
    () => (data ? heldInstruments(toTransactionInputs(data), new Map(data.instruments.map((i) => [i.id, i])), toDateKey(startOfDay(new Date()))) : []),
    [data]
  );
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <FormDialogContent>
        <PanelDialogHeader icon={Plus} title={tr("Registra operazione")} description={tr("Un acquisto, una vendita, un dividendo o un altro movimento del portafoglio.")} color="var(--swatch-indigo)" />
        {open ? <RegisterOperationForm currency={data?.currency ?? currency} initial={{ instrument: null }} heldInstruments={suggestions} onSuccess={onClose} /> : null}
      </FormDialogContent>
    </Dialog>
  );
}

/** The form picked in «Aggiungi», over whatever page is open. */
export function QuickAddForms({ form, onClose, onSwitch }: QuickAddFormsProps) {
  const { t: tr } = useLocalization();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: categories } = useCategoriesQuery();
  const today = toDateKey(startOfDay(new Date()));
  const change = (open: boolean) => !open && onClose();

  return (
    <>
      <Dialog open={form === "movimento"} onOpenChange={change}>
        <FormDialogContent>
          <PanelDialogHeader className="pr-10" icon={ReceiptTextIcon} title={tr("Nuovo movimento")} description={tr("Una spesa o un'entrata su un conto manuale.")} />
          {form === "movimento" ? (
            <AddTransactionForm categories={categories ?? []} currency={currency} onSuccess={onClose} onAddAccount={() => onSwitch("conto")} />
          ) : null}
        </FormDialogContent>
      </Dialog>
      <AddAccountDialog open={form === "conto"} onOpenChange={change} currency={currency} />
      <AddSubscriptionDialog open={form === "abbonamento"} onOpenChange={change} categories={categories ?? []} today={today} />
      {form === "operazione" ? <RegisterOperationDialog open onClose={onClose} currency={currency} /> : null}
      <InvestmentImportDialog open={form === "rendiconto"} onOpenChange={change} currency={currency} />
      <AddDebtDialog open={form === "debito"} onOpenChange={change} currency={currency} />
    </>
  );
}
