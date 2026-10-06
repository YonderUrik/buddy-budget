"use client";

/** Pagina Panoramica: patrimonio netto nel tempo, composizione per classe di asset e riepilogo del mese corrente. */

import * as React from "react";
import Link from "next/link";
import { RenewalBanner, buildRenewalAlerts, computeAccountsKpi } from "@/components/domain/accounts";
import { AttentionSection } from "@/components/domain/attention";
import {
  buildCompositionItems,
  NetWorthChartCard,
  NetWorthCompositionRow,
} from "@/components/domain/net-worth";
import { InvestmentsPulseSection, MonthPaceSection, OverviewVoice, UpcomingDuesSection } from "@/components/domain/overview";
import { LoadError } from "@/components/domain/shared";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { addMonths, endOfMonth, startOfDay, startOfMonth } from "@/lib/calc/expenses";
import { computeMonthPace, MONTH_PACE_LOOKBACK } from "@/lib/calc/month-pace";
import {
  buildNetWorthSeries,
  computeNetWorthChange,
  excludeClassFromSeries,
  toDateKey,
  type NetWorthByClass,
  type NetWorthPeriod,
} from "@/lib/calc/net-worth";
import { computeValueBreakdown } from "@/lib/investments/insights";
import { buildInvestmentsView } from "@/lib/investments/view";
import { useDebtsQuery } from "@/lib/queries/debts";
import { useAttentionQuery } from "@/lib/queries/attention";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useBankConnectionsStatusQuery } from "@/lib/queries/gocardless";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { usePensionInNetWorth } from "@/lib/hooks/use-pension-in-net-worth";
import { usePensionQuery } from "@/lib/queries/pension";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import { pensionTotalOn } from "@/lib/net-worth/pension-history";
import { useNetWorthSnapshotsQuery } from "@/lib/queries/net-worth";
import { useTransactionsQuery } from "@/lib/queries/transactions";

/** Inizio della finestra di fetch degli snapshot: tutto lo storico, così il cambio periodo non richiede nuove richieste. */
const NET_WORTH_FETCH_FROM = "2000-01-01";
/** Per il valore di oggi degli investimenti basta l'ultimo mese di prezzi. */
const INVESTMENTS_PERIOD: NetWorthPeriod = "1mese";
/** Porta in Conti e vi apre subito il flusso di rinnovo (il valore dice da dove si arriva). */
const RENEW_PATH = "/conti?rinnova=";
const DEFAULT_PERIOD: NetWorthPeriod = "3mesi";
const MONTH_NAME_FORMAT = new Intl.DateTimeFormat("it-IT", { month: "long" });
/** Dove porta ogni tessera: il valore va nell'evento `overview_tile_clicked`. */
const TILE_MONTH = "mese";
const TILE_DUES = "scadenze";
const TILE_INVESTMENTS = "investimenti";
const HEADER_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function PanoramicaPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [period, setPeriod] = React.useState<NetWorthPeriod>(DEFAULT_PERIOD);
  const today = React.useMemo(() => startOfDay(new Date()), []);
  // Il mese corrente più i precedenti: servono a dire se si spende più del solito a questo punto del mese.
  const monthRange = React.useMemo(() => ({ from: addMonths(startOfMonth(today), -MONTH_PACE_LOOKBACK), to: endOfMonth(today) }), [today]);

  const attentionQuery = useAttentionQuery();
  const accountsQuery = useAccountsQuery();
  const snapshotsQuery = useNetWorthSnapshotsQuery(NET_WORTH_FETCH_FROM, toDateKey(today));
  const monthTransactionsQuery = useTransactionsQuery(toDateKey(monthRange.from), toDateKey(monthRange.to), "tutte");
  // I budget sono opzionali: senza, la tessera del mese salta la barra.
  const budgetsQuery = useBudgetsQuery();
  const investmentsQuery = useInvestmentsOverviewQuery(INVESTMENTS_PERIOD);
  // Un errore sui debiti non blocca la Panoramica: semplicemente non compaiono.
  const debtsQuery = useDebtsQuery();
  // Lo stesso vale per la previdenza.
  const pensionQuery = usePensionQuery();
  // Anche questo è opzionale: se lo stato delle connessioni non carica, semplicemente non c'è il banner.
  const connectionsQuery = useBankConnectionsStatusQuery();
  const renewalAlerts = buildRenewalAlerts(connectionsQuery.data ?? [], today);

  const isLoading =
    accountsQuery.isLoading || snapshotsQuery.isLoading || monthTransactionsQuery.isLoading || investmentsQuery.isLoading;
  const isError = accountsQuery.isError || snapshotsQuery.isError || monthTransactionsQuery.isError;
  const retry = () => {
    accountsQuery.refetch();
    snapshotsQuery.refetch();
    monthTransactionsQuery.refetch();
    investmentsQuery.refetch();
    debtsQuery.refetch();
    pensionQuery.refetch();
  };

  const accounts = accountsQuery.data ?? [];
  const { totalLiquidity } = computeAccountsKpi(accounts);
  // Un errore sugli investimenti non blocca la Panoramica: si mostra la sola liquidità.
  const investments = React.useMemo(() => {
    if (!investmentsQuery.data || investmentsQuery.data.transactions.length === 0) return null;
    const { summary } = buildInvestmentsView(investmentsQuery.data, INVESTMENTS_PERIOD, today);
    const { paid, market } = computeValueBreakdown(summary);
    return { value: summary.totalValue, positions: summary.rows.length, paid, marketGain: market };
  }, [investmentsQuery.data, today]);
  const debtsData = debtsQuery.data?.overview;
  const debts = debtsData && debtsData.totalDebt > 0 ? { total: debtsData.totalDebt, count: debtsData.openCount } : null;
  const pensionFunds = pensionQuery.data?.funds ?? [];
  const pensionValue = pensionTotalOn(pensionFunds, toDateKey(today));
  const pension = pensionValue > 0 ? { value: pensionValue, funds: pensionFunds.filter((f) => f.snapshots.length > 0).length } : null;
  const todayByClass: NetWorthByClass = {
    liquidita: totalLiquidity,
    ...(investments ? { investimenti: investments.value } : {}),
    ...(pension ? { previdenza: pension.value } : {}),
    ...(debts ? { debiti: -debts.total } : {}),
  };
  const [pensionIncluded, setPensionIncluded] = usePensionInNetWorth();
  const fullSeries = buildNetWorthSeries(snapshotsQuery.data ?? [], todayByClass, period, today);
  // Escludere la previdenza toglie solo il totale: l'area resta nel grafico (in grigio).
  const series = pensionIncluded ? fullSeries : excludeClassFromSeries(fullSeries, "previdenza");
  const change = computeNetWorthChange(series);
  const compositionItems = buildCompositionItems(accounts, investments, debts, pension ? { ...pension, excluded: !pensionIncluded } : null);
  const pace = React.useMemo(
    () => computeMonthPace(monthTransactionsQuery.data ?? [], budgetsQuery.data ?? [], today),
    [monthTransactionsQuery.data, budgetsQuery.data, today]
  );
  const monthLabel = MONTH_NAME_FORMAT.format(today);
  const dues = debtsData?.nextDue ?? [];
  const debtsFootnote = debtsData ? `Residuo dei debiti: ${formatCurrency(debtsData.totalDebt, currency, { maximumFractionDigits: 0 })}${debtsData.debtFreeDate ? `, ultima rata il ${formatDateWithYear(debtsData.debtFreeDate)}` : ""}` : undefined;
  const headerDate = HEADER_DATE_FORMAT.format(today);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <OverviewVoice
        firstName={session?.user.name?.split(" ")[0]}
        dateLabel={headerDate.charAt(0).toUpperCase() + headerDate.slice(1)}
        pace={pace}
        monthLabel={monthLabel}
        currency={currency}
        nextDue={dues[0] ? { name: dues[0].name, date: dues[0].date, amount: dues[0].amount } : null}
        uncategorizedCount={attentionQuery.data?.uncategorizedCount ?? 0}
        today={today}
      />

      <RenewalBanner alerts={renewalAlerts} renewHref={`${RENEW_PATH}panoramica`} />

      {isLoading ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <div className="h-80 animate-pulse rounded-xl bg-muted" />
          <div className="h-36 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : isError ? (
        <LoadError message="Impossibile caricare i dati della panoramica." onRetry={retry} />
      ) : accounts.length === 0 && !investments && !pension ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-heading text-lg font-medium text-foreground">Nessun conto ancora</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggiungi o collega un conto per vedere il tuo patrimonio netto.
          </p>
          <Link href="/conti" className={buttonVariants({ className: "mt-4" })}>
            Aggiungi un conto
          </Link>
        </div>
      ) : (
        <>
          <NetWorthChartCard
            series={series}
            change={change}
            period={period}
            onPeriodChange={setPeriod}
            currency={currency}
            pensionIncluded={pensionIncluded}
            onPensionIncludedChange={setPensionIncluded}
          />
          <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-5">
            <div className="flex flex-col gap-10 lg:col-span-3">
              <NetWorthCompositionRow items={compositionItems} currency={currency} title="Dove sta il patrimonio" className="bg-transparent p-0 ring-0" />
              <MonthPaceSection pace={pace} monthLabel={monthLabel} currency={currency} onLinkClick={() => track("overview_tile_clicked", { tile: TILE_MONTH })} />
            </div>
            <div className="flex flex-col gap-8 lg:col-span-2">
              <AttentionSection currency={currency} />
              <UpcomingDuesSection dues={dues} currency={currency} footnote={debtsFootnote} onLinkClick={() => track("overview_tile_clicked", { tile: TILE_DUES })} />
              {investments ? (
                <InvestmentsPulseSection
                  value={investments.value}
                  paid={investments.paid}
                  marketGain={investments.marketGain}
                  positions={investments.positions}
                  currency={currency}
                  onLinkClick={() => track("overview_tile_clicked", { tile: TILE_INVESTMENTS })}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
