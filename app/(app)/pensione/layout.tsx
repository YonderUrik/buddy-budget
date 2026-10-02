"use client";

/** Layout di Pensione: titolo, selettore del fondo e schede; gestisce caricamento, errore e stato vuoto. */

import * as React from "react";
import { usePathname } from "next/navigation";
import { PENSION_TABS, PensionEmptyState, PensionFundSelector } from "@/components/domain/pension";
import { LoadError, SectionTabs } from "@/components/domain/shared";
import { PensionProvider, usePensionView } from "@/lib/pension/pension-context";
import { useCreatePensionFundMutation } from "@/lib/queries/pension";

function PensioneShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const view = usePensionView();
  const createFund = useCreatePensionFundMutation();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Pensione</h1>
          <p className="text-sm text-muted-foreground">Il tuo fondo pensione: quanto rende, quanto ti resterebbe e dove arriverà</p>
        </div>
        {view.funds.length > 1 && view.fund ? <PensionFundSelector funds={view.funds} value={view.fund.id} onChange={view.selectFund} /> : null}
        {view.fund ? <SectionTabs tabs={PENSION_TABS} activeHref={pathname} ariaLabel="Sezioni di Pensione" /> : null}
      </div>
      {view.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-52 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : view.isError ? (
        <LoadError message="Impossibile caricare i dati della pensione." onRetry={view.refetch} />
      ) : !view.fund ? (
        <PensionEmptyState
          today={view.today}
          pending={createFund.isPending}
          errorMessage={createFund.isError ? createFund.error.message : null}
          onSubmit={(input) => createFund.mutate(input)}
        />
      ) : (
        <>
          {children}
          <p className="text-xs text-muted-foreground">Stime a scopo informativo, non consulenza finanziaria o fiscale: regole e aliquote vanno verificate con un professionista.</p>
        </>
      )}
    </div>
  );
}

export default function PensioneLayout({ children }: { children: React.ReactNode }) {
  return (
    <PensionProvider>
      <PensioneShell>{children}</PensioneShell>
    </PensionProvider>
  );
}
