"use client";

/**
 * Layout di Investimenti: titolo, bottoni Importa/Registra, schede (Portafoglio, Proventi, Tasse) e i dialog
 * condivisi. Usa la stessa query della scheda Portafoglio al periodo di default: nessuna richiesta in più.
 */

import * as React from "react";
import { BrokerSelectionProvider } from "@/lib/investments/broker-selection";
import { usePathname } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import {
  InvestmentImportDialog,
  BrokerSelector,
  InvestmentsActionsProvider,
  InvestmentsTabs,
  PanelDialogHeader,
  RegisterOperationForm,
  type RegisterOperationInitial,
} from "@/components/domain/investments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usedInstruments } from "@/lib/investments/view";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";

/** Le pagine dei singoli titoli vivono sotto questo indirizzo e appartengono alla scheda Portafoglio. */
const TITLE_PAGES_BASE = "/investimenti/titoli/";

export default function InvestimentiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const overview = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD);
  const [registerInitial, setRegisterInitial] = React.useState<RegisterOperationInitial | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const actions = React.useMemo(() => ({ openRegister: setRegisterInitial, openImport: () => setImportOpen(true) }), []);

  const data = overview.data;
  const currency = data?.currency ?? "EUR";
  const suggestions = React.useMemo(
    () => (data ? usedInstruments(data.transactions, new Map(data.instruments.map((i) => [i.id, i]))) : []),
    [data]
  );

  return (
    <BrokerSelectionProvider><InvestmentsActionsProvider value={actions}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-medium text-foreground">Investimenti</h1>
              <p className="text-sm text-muted-foreground">Prezzi di chiusura aggiornati ogni sera</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <Upload size={15} aria-hidden="true" /> Importa
              </Button>
              <Button className="gap-1.5 shadow-xs" onClick={() => setRegisterInitial({ instrument: null })}>
                <Plus size={15} aria-hidden="true" /> Registra
              </Button>
            </div>
          </div>
          <InvestmentsTabs activeHref={pathname.startsWith(TITLE_PAGES_BASE) ? "/investimenti" : pathname} />
        </div>
        {data && !pathname.includes("/rendiconti") && !pathname.includes("/titoli") ? <BrokerSelector data={data} /> : null}
        {children}
      </div>

      <Dialog open={registerInitial !== null} onOpenChange={(open) => !open && setRegisterInitial(null)}>
        <DialogContent className="max-w-lg">
          <PanelDialogHeader icon={Plus} title="Registra operazione" description="Un acquisto, una vendita, un dividendo o un altro movimento del portafoglio." color="var(--swatch-indigo)" />
          {registerInitial ? (
            <RegisterOperationForm
              currency={currency}
              initial={registerInitial}
              usedInstruments={suggestions}
              onSuccess={() => setRegisterInitial(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <InvestmentImportDialog open={importOpen} onOpenChange={setImportOpen} currency={currency} />
    </InvestmentsActionsProvider></BrokerSelectionProvider>
  );
}
