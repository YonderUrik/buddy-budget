"use client";

/**
 * Forms opened by «Aggiungi» over the current page: the same dialogs the sections use, with the data they need read
 * here. Loaded only when the user picks one (`next/dynamic` in the provider), so the app layout stays light.
 * They sit outside every section's layout, so everything they need comes through props: a section's actions hook
 * (`useInvestmentsActions`, `useDebtsActions`…) throws here and takes the whole app down.
 */

import * as React from "react";
import { AddAccountDialog } from "@/components/domain/liquidity/add-account-dialog";
import { AddDebtDialog } from "@/components/domain/debts";
import { AddTransactionDialog } from "@/components/domain/expenses";
import { ImportManagementDialog, InvestmentImportDialog, RegisterOperationDialog } from "@/components/domain/investments";
import { AddSubscriptionDialog } from "@/components/domain/subscriptions";
import { authClient } from "@/lib/auth/client";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { useCategoriesQuery } from "@/lib/queries/categories";
import type { QuickAddFormId } from "@/lib/quick-add/actions";
import type { QuickAddPrefill } from "./prefill";

/** A new operation starts from no instrument. */
const NEW_OPERATION = { instrument: null };

export interface QuickAddFormsProps {
  /** Form to show; null closes it. */
  form: QuickAddFormId | null;
  onClose: () => void;
  /** Another form from inside this one (e.g. «Aggiungi un conto» from a movement without accounts). */
  onSwitch: (form: QuickAddFormId) => void;
  /** Starting values for the form (a sentence typed in «Cerca»). */
  prefill?: QuickAddPrefill | null;
}

/** The form picked in «Aggiungi», over whatever page is open. */
export function QuickAddForms({ form, onClose, onSwitch, prefill }: QuickAddFormsProps) {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: categories } = useCategoriesQuery();
  const today = toDateKey(startOfDay(new Date()));
  const change = (open: boolean) => !open && onClose();
  // The portfolio query starts with the first operation form and then stays, so the form can animate out.
  const [operationUsed, setOperationUsed] = React.useState(form === "operazione");
  if (form === "operazione" && !operationUsed) setOperationUsed(true);
  // «Gestisci importazioni» at the end of a broker statement: the list opens here too, not only inside Investimenti.
  const [importsOpen, setImportsOpen] = React.useState(false);

  return (
    <>
      <AddTransactionDialog open={form === "movimento"} onOpenChange={change} categories={categories ?? []} currency={currency} onAddAccount={() => onSwitch("conto")} initial={prefill?.movimento} />
      <AddAccountDialog open={form === "conto"} onOpenChange={change} currency={currency} />
      <AddSubscriptionDialog open={form === "abbonamento"} onOpenChange={change} categories={categories ?? []} today={today} />
      {operationUsed ? <RegisterOperationDialog key={prefill?.operazione ? JSON.stringify({ ...prefill.operazione, instrument: prefill.operazione.instrument?.id ?? null }) : "nuova"} initial={form === "operazione" ? (prefill?.operazione ?? NEW_OPERATION) : null} onClose={onClose} /> : null}
      <InvestmentImportDialog open={form === "rendiconto"} onOpenChange={change} currency={currency} onManageImports={() => setImportsOpen(true)} />
      <ImportManagementDialog open={importsOpen} onOpenChange={setImportsOpen} />
      <AddDebtDialog open={form === "debito"} onOpenChange={change} currency={currency} />
    </>
  );
}
