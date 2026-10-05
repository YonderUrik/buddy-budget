"use client";

/**
 * Scheda Tasse di Investimenti: regime fiscale, cifre per anno (plus/minus, ETF, imposte, bollo), zaino delle
 * minusvalenze, simulatore "Prima di vendere", cose da sapere e aliquote degli strumenti. Stime, non calcolo fiscale.
 */

import * as React from "react";
import { toast } from "sonner";
import {
  Disclosure,
  InstrumentSettingsDialog,
  InstrumentTaxListCard,
  LossCarryforwardCard,
  SaleSimulatorCard,
  TaxOpportunitiesCard,
  TaxDisclaimer,
  TaxRegimeCard,
  TaxYearCard,
} from "@/components/domain/investments";
import { LoadError } from "@/components/domain/shared";
import { startOfDay } from "@/lib/calc/expenses";
import type { Instrument } from "@/lib/db/schema/investments";
import { buildTaxView } from "@/lib/investments/tax-view";
import { useInvestmentsOverviewQuery, useUpdatePortfolioMutation } from "@/lib/queries/investments";

export default function TassePage() {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  // Il bollo usa il valore a fine di ogni anno: serve tutto lo storico dei prezzi.
  const overview = useInvestmentsOverviewQuery("max");
  const view = React.useMemo(() => (overview.data ? buildTaxView(overview.data, today) : null), [overview.data, today]);
  const updatePortfolio = useUpdatePortfolioMutation();
  const [editing, setEditing] = React.useState<Instrument | null>(null);

  if (overview.isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (overview.isError || !view) return <LoadError message="Impossibile caricare le tasse." onRetry={() => overview.refetch()} />;

  const { currency } = view;
  const manualLosses = view.carryforwards.map((c) => ({ year: c.year, amount: Number(c.amount) }));
  return (
    <>
      <TaxRegimeCard
        regime={view.regime}
        saving={updatePortfolio.isPending}
        onChange={(taxRegime) => updatePortfolio.mutate({ taxRegime }, { onError: (e) => toast.error(e.message) })}
      />
      {view.report.years.length > 0 ? (
        <TaxYearCard years={view.report.years} regime={view.regime} currency={currency} currentYear={view.currentYear} />
      ) : null}
      {view.sellable.length > 0 ? (
        <SaleSimulatorCard
          positions={view.sellable}
          transactions={view.transactions}
          instruments={view.taxInstruments}
          regime={view.regime}
          manualLosses={manualLosses}
          todayKey={view.todayKey}
          currency={currency}
        />
      ) : null}
      <LossCarryforwardCard losses={view.report.losses} carryforwards={view.carryforwards} currency={currency} currentYear={view.currentYear} />
      <Disclosure title="Per esperti" summary="Cose da sapere e aliquote strumento per strumento">
        <TaxOpportunitiesCard opportunities={view.opportunities} instrumentsById={view.instrumentsById} currency={currency} currentYear={view.currentYear} />
        <InstrumentTaxListCard instruments={view.instruments} resolved={view.resolved} onEdit={setEditing} />
      </Disclosure>
      <TaxDisclaimer />
      <InstrumentSettingsDialog instrument={editing} setting={editing ? view.settingsById.get(editing.id) : undefined} onClose={() => setEditing(null)} />
    </>
  );
}
