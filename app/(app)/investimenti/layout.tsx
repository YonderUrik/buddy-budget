"use client";
import { useLocalization } from "@/lib/localization/provider";
import { isCountryPathAvailable } from "@/lib/localization/config";

/**
 * Layout di Investimenti: titolo, «Importazioni fatte», schede (Portafoglio, Proventi, Tasse) e i dialog condivisi
 * (the empty state and the tabs open them; a new operation or broker statement otherwise comes from the app-wide
 * «Aggiungi»). Usa la stessa query della scheda Portafoglio al periodo di default: nessuna richiesta in più.
 * La pagina di un singolo titolo è una scheda a sé: niente intestazione né schede, solo i dialog condivisi.
 */

import { SectionHeading } from "@/components/domain/shared";
import * as React from "react";
import { BrokerSelectionProvider } from "@/lib/investments/broker-selection";
import { usePathname } from "next/navigation";
import { DatabaseIcon } from "lucide-react";
import {
  ImportManagementDialog,
  InvestmentImportDialog,
  BrokerSelector,
  InvestmentsActionsProvider,
  InvestmentsTabs,
  INVESTMENTS_TABS,
  RegisterOperationDialog,
  type RegisterOperationInitial,
} from "@/components/domain/investments";
import { Button } from "@/components/ui/button";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";

/** Le pagine dei singoli titoli vivono sotto questo indirizzo: hanno la propria testata con il ritorno indietro. */
const TITLE_PAGES_BASE = "/investimenti/titoli/";

export default function InvestimentiLayout({ children }: { children: React.ReactNode }) {
  const { t: tr } = useLocalization();
  const { productCountry } = useLocalization();
  const tabs = INVESTMENTS_TABS.filter(tab => isCountryPathAvailable(productCountry, tab.href));
  const pathname = usePathname();
  const isTitlePage = pathname.startsWith(TITLE_PAGES_BASE);
  const overview = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD);
  const [registerInitial, setRegisterInitial] = React.useState<RegisterOperationInitial | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [managementOpen, setManagementOpen] = React.useState(false);
  const actions = React.useMemo(() => ({ openRegister: setRegisterInitial, openImport: () => setImportOpen(true), openImportManagement: () => setManagementOpen(true) }), []);

  const data = overview.data;
  const currency = data?.currency ?? "EUR";

  return (
    <BrokerSelectionProvider><InvestmentsActionsProvider value={actions}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        {isTitlePage ? null : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading title={tr("Investimenti")} tabs={tabs} activeHref={pathname} analyticsKey="investimenti" />
              <Button variant="ghost" size="icon" className="size-11 shrink-0 sm:size-9" onClick={() => setManagementOpen(true)} aria-label={tr("Importazioni fatte")} title={tr("Importazioni fatte")}>
                <DatabaseIcon size={16} aria-hidden="true" />
              </Button>
            </div>
            <InvestmentsTabs activeHref={pathname} />
          </div>
        )}
        {data && !pathname.includes("/rendiconti") && !pathname.includes("/titoli") ? <BrokerSelector data={data} /> : null}
        {children}
      </div>

      <RegisterOperationDialog initial={registerInitial} onClose={() => setRegisterInitial(null)} />
      <ImportManagementDialog open={managementOpen} onOpenChange={setManagementOpen} />
      <InvestmentImportDialog open={importOpen} onOpenChange={setImportOpen} currency={currency} />
    </InvestmentsActionsProvider></BrokerSelectionProvider>
  );
}
