"use client";

/**
 * Layout di Investimenti: titolo, bottoni Importa/Registra, schede (Portafoglio, Proventi, Tasse) e i dialog
 * condivisi. Usa la stessa query della scheda Portafoglio al periodo di default: nessuna richiesta in più.
 * La pagina di un singolo titolo è una scheda a sé: niente intestazione né schede, solo i dialog condivisi.
 */

import { FormDialogContent } from "@/components/domain/shared";
import * as React from "react";
import { BrokerSelectionProvider } from "@/lib/investments/broker-selection";
import { usePathname } from "next/navigation";
import { DatabaseIcon, Plus, Upload } from "lucide-react";
import {
  ImportManagementDialog,
  InvestmentImportDialog,
  BrokerSelector,
  InvestmentsActionsProvider,
  InvestmentsTabs,
  PanelDialogHeader,
  RegisterOperationForm,
  type RegisterOperationInitial,
} from "@/components/domain/investments";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usedInstruments } from "@/lib/investments/view";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";

/** Le pagine dei singoli titoli vivono sotto questo indirizzo: hanno la propria testata con il ritorno indietro. */
const TITLE_PAGES_BASE = "/investimenti/titoli/";

export default function InvestimentiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTitlePage = pathname.startsWith(TITLE_PAGES_BASE);
  const overview = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD);
  const [registerInitial, setRegisterInitial] = React.useState<RegisterOperationInitial | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [managementOpen, setManagementOpen] = React.useState(false);
  const actions = React.useMemo(() => ({ openRegister: setRegisterInitial, openImport: () => setImportOpen(true), openImportManagement: () => setManagementOpen(true) }), []);

  const data = overview.data;
  const currency = data?.currency ?? "EUR";
  const suggestions = React.useMemo(
    () => (data ? usedInstruments(data.transactions, new Map(data.instruments.map((i) => [i.id, i]))) : []),
    [data]
  );

  return (
    <BrokerSelectionProvider><InvestmentsActionsProvider value={actions}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        {isTitlePage ? null : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 font-heading text-2xl font-medium text-foreground">Investimenti</h1>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="icon" className="size-11 sm:size-9" onClick={() => setManagementOpen(true)} aria-label="Importazioni fatte" title="Importazioni fatte">
                  <DatabaseIcon size={16} aria-hidden="true" />
                </Button>
                {/* Su mobile solo icone: con le etichette la testata era più larga dello schermo e la pagina scorreva di lato. */}
                <Button variant="outline" className="size-11 gap-1.5 sm:size-auto" onClick={() => setImportOpen(true)} aria-label="Importa">
                  <Upload size={15} aria-hidden="true" /> <span className="hidden sm:inline">Importa</span>
                </Button>
                <Button className="size-11 gap-1.5 shadow-xs sm:size-auto" onClick={() => setRegisterInitial({ instrument: null })} aria-label="Registra operazione">
                  <Plus size={15} aria-hidden="true" /> <span className="hidden sm:inline">Registra</span>
                </Button>
              </div>
            </div>
            <InvestmentsTabs activeHref={pathname} />
          </div>
        )}
        {data && !pathname.includes("/rendiconti") && !pathname.includes("/titoli") ? <BrokerSelector data={data} /> : null}
        {children}
      </div>

      <Dialog open={registerInitial !== null} onOpenChange={(open) => !open && setRegisterInitial(null)}>
        <FormDialogContent>
          <PanelDialogHeader icon={Plus} title="Registra operazione" description="Un acquisto, una vendita, un dividendo o un altro movimento del portafoglio." color="var(--swatch-indigo)" />
          {registerInitial ? (
            <RegisterOperationForm
              currency={currency}
              initial={registerInitial}
              usedInstruments={suggestions}
              onSuccess={() => setRegisterInitial(null)}
            />
          ) : null}
        </FormDialogContent>
      </Dialog>
      <ImportManagementDialog open={managementOpen} onOpenChange={setManagementOpen} />
      <InvestmentImportDialog open={importOpen} onOpenChange={setImportOpen} currency={currency} />
    </InvestmentsActionsProvider></BrokerSelectionProvider>
  );
}
