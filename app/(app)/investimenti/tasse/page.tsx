"use client";
import { PlanningScreen } from "@/components/domain/financial-planning";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Scheda Tasse di Investimenti: cifre per anno (plus/minus, ETF, imposte, bollo), zaino delle
 * minusvalenze, simulatore "Prima di vendere", cose da sapere, aliquote degli strumenti e, in fondo, il regime. Stime, non calcolo fiscale.
 */

import * as React from "react";
import { useFilteredInvestmentsOverview } from "@/lib/queries/investments-view";
import {
  InstrumentSettingsDialog,
  InstrumentTaxListCard,
  LossCarryforwardCard,
  SaleSimulatorCard,
  TaxOpportunitiesCard,
  TaxRegimeNote,
  TaxYearCard,
} from "@/components/domain/investments";
import { LoadError, PAGE_SPLIT, PAGE_SPLIT_MAIN, PAGE_SPLIT_SIDE } from "@/components/domain/shared";
import { startOfDay } from "@/lib/calc/expenses";
import type { Instrument } from "@/lib/db/schema/investments";
import { buildTaxView } from "@/lib/investments/tax-view";
import { useUpdatePortfolioMutation } from "@/lib/queries/investments";
import { errorToast } from "@/lib/support/request-report";

function ItalianPage() {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  // Il bollo usa il valore a fine di ogni anno: serve tutto lo storico dei prezzi.
  const overview = useFilteredInvestmentsOverview("max");
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
      <div className={PAGE_SPLIT}>
        <div className={PAGE_SPLIT_MAIN}>
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
          <InstrumentTaxListCard instruments={view.rateListInstruments} resolved={view.resolved} onEdit={setEditing} />
        </div>
        <div className={PAGE_SPLIT_SIDE}>
          <LossCarryforwardCard losses={view.report.losses} carryforwards={view.carryforwards} currency={currency} currentYear={view.currentYear} />
          <TaxOpportunitiesCard opportunities={view.opportunities} instrumentsById={view.instrumentsById} currency={currency} currentYear={view.currentYear} />
        </div>
      </div>
      <div className="mt-10">
        <TaxRegimeNote
          regime={view.regime}
          saving={updatePortfolio.isPending}
          onChange={(taxRegime) => updatePortfolio.mutate({ taxRegime }, { onError: (e) => errorToast(e.message) })}
        />
      </div>
      <InstrumentSettingsDialog instrument={editing} setting={editing ? view.settingsById.get(editing.id) : undefined} onClose={() => setEditing(null)} />
    </>
  );
}

/** Choose the country product before mounting its calculation hooks. */
export default function CountryPage() {
  const { productCountry } = useLocalization();
  return productCountry === "DE" ? <PlanningScreen section="tax" /> : <ItalianPage />;
}
