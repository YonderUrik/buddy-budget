"use client";

/** Pagina Investimenti: valore e guadagno del portafoglio, andamento, posizioni, composizione, PAC e operazioni. */

import * as React from "react";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  CURRENCY_COLORS,
  INSTRUMENT_TYPE_COLOR,
  InvestmentImportDialog,
  InvestmentTransactionsList,
  ManualPriceDialog,
  PlansCard,
  PortfolioComposition,
  PortfolioHeroCard,
  PositionsList,
  prefillFromPlan,
  RegisterOperationForm,
  type RegisterOperationInitial,
} from "@/components/domain/investments";
import { LoadError } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolvePrice } from "@/lib/calc/investments";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import type { Instrument, InstrumentType, InvestmentPlan } from "@/lib/db/schema/investments";
import {
  CURRENCY_EXPOSURE_THRESHOLD,
  computeConcentration,
  computeCurrencyExposure,
  computeValueBreakdown,
} from "@/lib/investments/insights";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/investments/labels";
import { buildInvestmentsView } from "@/lib/investments/view";
import {
  useBackfillStatusQuery,
  useDeleteInvestmentTransactionMutation,
  useInvestmentsOverviewQuery,
} from "@/lib/queries/investments";

const DEFAULT_PERIOD: NetWorthPeriod = "3mesi";

function typeLabel(key: string): string {
  return INSTRUMENT_TYPE_LABELS[key as InstrumentType] ?? key;
}

/** Frase sull'esposizione valutaria: sotto soglia non c'è rischio di cambio da segnalare. */
function currencyInsight(exposure: number, currency: string): string {
  if (exposure < CURRENCY_EXPOSURE_THRESHOLD) return `Quasi tutto in ${currency}: il cambio non sposta il valore.`;
  return `Il ${Math.round(exposure * 100)}% è in altre valute: il cambio muove il valore anche a mercati fermi.`;
}

export default function InvestimentiPage() {
  const [period, setPeriod] = React.useState<NetWorthPeriod>(DEFAULT_PERIOD);
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const overview = useInvestmentsOverviewQuery(period);
  const view = React.useMemo(
    () => (overview.data ? buildInvestmentsView(overview.data, period, today) : null),
    [overview.data, period, today]
  );
  const backfill = useBackfillStatusQuery(view?.instruments.map((i) => i.id) ?? []);
  const deleteOperation = useDeleteInvestmentTransactionMutation();

  const [registerInitial, setRegisterInitial] = React.useState<RegisterOperationInitial | null>(null);
  const [priceInstrument, setPriceInstrument] = React.useState<Instrument | null>(null);
  const [showAllOperations, setShowAllOperations] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  function registerFromPlan(plan: InvestmentPlan) {
    if (!view) return;
    const last = resolvePrice(view.priceIndex, plan.instrumentId, toDateKey(today));
    const prefill = prefillFromPlan(plan, last?.close ?? null);
    setRegisterInitial({ ...prefill, instrument: view.instrumentsById.get(plan.instrumentId) ?? null });
  }

  const currency = view?.currency ?? "EUR";
  const header = (
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
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      {header}
      {overview.isLoading ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : overview.isError || !view ? (
        <LoadError message="Impossibile caricare gli investimenti." onRetry={() => overview.refetch()} />
      ) : !view.hasTransactions ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-heading text-lg font-medium text-foreground">Registra il tuo primo investimento</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cerca uno strumento per nome, ticker o ISIN (ETF, azioni, BTP, fondi, crypto) e inserisci l&apos;acquisto:
            valore e guadagno si aggiornano da soli con i prezzi di chiusura.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setRegisterInitial({ instrument: null })}>Registra un acquisto</Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Importa da file CSV
            </Button>
          </div>
        </div>
      ) : (
        <>
          <PortfolioHeroCard
            summary={view.summary}
            breakdown={computeValueBreakdown(view.summary)}
            series={view.series}
            period={period}
            onPeriodChange={setPeriod}
            currency={currency}
          />
          <PositionsList
            rows={view.summary.rows}
            concentration={computeConcentration(view.summary.rows)}
            currency={currency}
            todayKey={toDateKey(today)}
            backfill={backfill.data ?? []}
            onManualPrice={(row) => setPriceInstrument(view.instrumentsById.get(row.instrument.id) ?? null)}
          />
          <PortfolioComposition
            currency={currency}
            groups={[
              {
                title: "Per tipo",
                slices: view.byType,
                labelFor: typeLabel,
                colorFor: (key) => INSTRUMENT_TYPE_COLOR[key as InstrumentType] ?? "var(--swatch-slate)",
                insight: view.byType[0] ? `Soprattutto ${typeLabel(view.byType[0].key)} (${Math.round(view.byType[0].share * 100)}%).` : null,
              },
              {
                title: "Per valuta",
                slices: view.byCurrency,
                colorFor: (_key, index) => CURRENCY_COLORS[index % CURRENCY_COLORS.length],
                insight: currencyInsight(computeCurrencyExposure(view.byCurrency, currency), currency),
              },
            ]}
          />
        </>
      )}
      {view ? (
        <>
          <PlansCard
            plans={overview.data?.plans ?? []}
            instrumentsById={view.instrumentsById}
            currency={currency}
            today={today}
            onRegisterExecution={registerFromPlan}
          />
          {view.hasTransactions ? (
            <InvestmentTransactionsList
              transactions={overview.data?.transactions ?? []}
              instrumentsById={view.instrumentsById}
              showAll={showAllOperations}
              onToggleShowAll={() => setShowAllOperations((v) => !v)}
              deletingId={deleteOperation.isPending ? deleteOperation.variables : null}
              onDelete={(t) => deleteOperation.mutate(t.id, { onError: (e) => toast.error(e.message) })}
            />
          ) : null}
        </>
      ) : null}

      <Dialog open={registerInitial !== null} onOpenChange={(open) => !open && setRegisterInitial(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registra operazione</DialogTitle>
          </DialogHeader>
          {registerInitial ? (
            <RegisterOperationForm currency={currency} initial={registerInitial} onSuccess={() => setRegisterInitial(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
      <ManualPriceDialog instrument={priceInstrument} onClose={() => setPriceInstrument(null)} />
      <InvestmentImportDialog open={importOpen} onOpenChange={setImportOpen} currency={currency} />
    </div>
  );
}
