"use client";

/**
 * Scheda Proventi di Investimenti: riepilogo di dividendi e cedole, previsione dei prossimi 12 mesi, proventi da
 * registrare, incassi mese per mese e per strumento.
 */

import * as React from "react";
import { useFilteredInvestmentsOverview } from "@/lib/queries/investments-view";
import { toast } from "sonner";
import {
  IncomeForecastCard,
  IncomeHistoryCard,
  IncomeInstrumentsCard,
  IncomeMonthsCard,
  InstrumentSettingsDialog,
  MissingIncomeCard,
  useInvestmentsActions,
} from "@/components/domain/investments";
import { LoadError } from "@/components/domain/shared";
import { startOfDay } from "@/lib/calc/expenses";
import type { Instrument } from "@/lib/db/schema/investments";
import type { MissingIncome } from "@/lib/investments/dividends";
import { buildIncomeView } from "@/lib/investments/income-view";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useDismissDividendMutation } from "@/lib/queries/investments";

/** Mentre gli storici dividendi si scaricano in background, la pagina si aggiorna ogni tanto (al massimo qualche volta). */
const PENDING_REFRESH_MS = 4000;
const PENDING_REFRESH_MAX = 6;

export default function ProventiPage() {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const overview = useFilteredInvestmentsOverview(INVESTMENTS_DEFAULT_PERIOD);
  const view = React.useMemo(() => (overview.data ? buildIncomeView(overview.data, today) : null), [overview.data, today]);
  const { openRegister } = useInvestmentsActions();
  const dismiss = useDismissDividendMutation();
  const [couponsFor, setCouponsFor] = React.useState<Instrument | null>(null);
  const [refreshes, setRefreshes] = React.useState(0);
  const { refetch } = overview;

  const pending = view?.pendingDividendHistory ?? 0;
  React.useEffect(() => {
    if (pending === 0 || refreshes >= PENDING_REFRESH_MAX) return;
    const timer = setTimeout(() => {
      setRefreshes((n) => n + 1);
      void refetch();
    }, PENDING_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [pending, refreshes, refetch]);

  function register(item: MissingIncome) {
    if (!view) return;
    openRegister({
      instrument: view.instrumentsById.get(item.instrumentId) ?? null,
      type: item.kind,
      date: item.date,
      grossAmount: item.gross,
      taxes: item.estimatedTax,
    });
  }

  function ignore(items: MissingIncome[]) {
    const input = { items: items.map((item) => ({ instrumentId: item.instrumentId, date: item.date })) };
    dismiss.mutate(input, {
      onSuccess: () =>
        toast(items.length === 1 ? "Proposta ignorata" : `${items.length} proposte ignorate`, {
          action: { label: "Annulla", onClick: () => dismiss.mutate({ ...input, restore: true }) },
        }),
      onError: (e) => toast.error(e.message),
    });
  }

  if (overview.isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (overview.isError || !view) return <LoadError message="Impossibile caricare i proventi." onRetry={() => overview.refetch()} />;
  if (!view.hasTransactions) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Qui vedrai dividendi e cedole: registra prima un acquisto nella scheda Portafoglio.
      </p>
    );
  }

  const currency = view.currency;
  const pendingItem = dismiss.isPending ? dismiss.variables?.items[0] : undefined;
  const dismissingKey = pendingItem ? `${pendingItem.instrumentId}|${pendingItem.date}` : null;
  return (
    <>
      {pending > 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Scarico lo storico dei dividendi di {pending === 1 ? "uno strumento" : `${pending} strumenti`}…
        </p>
      ) : null}
      {view.history.count > 0 ? <IncomeHistoryCard income={view.history} instrumentsById={view.instrumentsById} currency={currency} /> : null}
      {view.missing.length > 0 ? (
        <MissingIncomeCard
          missing={view.missing}
          instrumentsById={view.instrumentsById}
          currency={currency}
          onRegister={register}
          onDismiss={(item) => ignore([item])}
          onDismissOld={ignore}
          dismissingKey={dismissingKey}
          todayKey={view.todayKey}
        />
      ) : null}
      <IncomeForecastCard forecast={view.forecast} instrumentsById={view.instrumentsById} currency={currency} onEditCoupons={setCouponsFor} />
      {view.byMonth.length > 0 ? <IncomeMonthsCard years={view.byMonth} currency={currency} /> : null}
      {view.byInstrument.length > 0 ? (
        <IncomeInstrumentsCard rows={view.byInstrument} instrumentsById={view.instrumentsById} currency={currency} onEditCoupons={setCouponsFor} />
      ) : null}
      <InstrumentSettingsDialog
        instrument={couponsFor}
        setting={couponsFor ? overview.data?.instrumentSettings.find((s) => s.instrumentId === couponsFor.id) : undefined}
        onClose={() => setCouponsFor(null)}
      />
    </>
  );
}
