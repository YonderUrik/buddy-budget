"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Layout di Debiti: titolo e "Aggiungi debito". Il dialog di aggiunta vive qui, così ogni scheda può aprirlo.
 * Il dettaglio di un finanziamento ha la sua testata con «‹ Debiti»: lì il titolo della sezione non si ripete.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { AddDebtDialog, DebtsActionsProvider } from "@/components/domain/debts";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { PAGE_TITLE } from "@/components/domain/shared";

/** Pagine di dettaglio dei singoli finanziamenti. */
const DETAIL_PAGES_BASE = "/debiti/finanziamenti";

export default function DebitiLayout({ children }: { children: React.ReactNode }) {
  const { t: tr } = useLocalization();
  const { data: session } = authClient.useSession();
  const isDetail = usePathname().startsWith(DETAIL_PAGES_BASE);
  const [addOpen, setAddOpen] = React.useState(false);
  const actions = React.useMemo(() => ({ openAdd: () => setAddOpen(true) }), []);

  return (
    <DebtsActionsProvider value={actions}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        <div className={isDetail ? "hidden" : "flex flex-col gap-3"}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className={PAGE_TITLE}>{tr("Debiti")}</h1>
              <p className="text-sm text-muted-foreground">{tr("Cosa pagare, cosa pesa, come uscirne")}</p>
            </div>
            <Button variant="sun" className="gap-1.5 shadow-xs" onClick={actions.openAdd}>
              <Plus size={15} aria-hidden="true" />{" "}{tr("Aggiungi")}</Button>
          </div>
        </div>
        {children}
      </div>
      <AddDebtDialog open={addOpen} onOpenChange={setAddOpen} currency={session?.user.currency ?? "EUR"} />
    </DebtsActionsProvider>
  );
}
