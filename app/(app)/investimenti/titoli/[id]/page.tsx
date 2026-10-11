"use client";

/**
 * Pagina di un titolo: prezzo e numeri in breve, grafico con i tuoi acquisti, la tua posizione, quanto rischia e gli
 * avvisi; sotto, per tipo, gli indicatori fondamentali (azioni) o composizione e costi (ETF e fondi). Da qui si
 * segue il titolo o si registra un'operazione.
 */

import * as React from "react";
import { useParams } from "next/navigation";
import {
  TitleAlertsCard,
  TitleCommentaryCard,
  TitleDetailSections,
  TitleHeader,
  TitleInsideFunds,
  TitleKeyFacts,
  TitlePositionCard,
  TitlePriceChart,
  TitleQuotationCard,
  TitleRiskSection,
  TitleStatsCard,
  useInvestmentsActions,
} from "@/components/domain/investments";
import { LoadError } from "@/components/domain/shared";
import { TITLE_DEFAULT_CHART_PERIOD, type TitleChartPeriod } from "@/lib/investments/title-stats";
import { useTitleAnalysisQuery, useWatchMutation } from "@/lib/queries/titles";

export default function TitoloPage() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = React.useState<TitleChartPeriod>(TITLE_DEFAULT_CHART_PERIOD);
  const analysis = useTitleAnalysisQuery(id, period);
  const watch = useWatchMutation();
  const { openRegister } = useInvestmentsActions();

  if (analysis.isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (analysis.isError || !analysis.data) {
    return <LoadError message={analysis.error?.message ?? "Impossibile caricare il titolo."} onRetry={() => void analysis.refetch()} />;
  }

  const data = analysis.data;
  const { instrument } = data;
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <TitleHeader
        instrument={instrument}
        stats={data.stats}
        watching={data.watching}
        held={data.position !== null}
        watchPending={watch.isPending}
        onToggleWatch={() => watch.mutate({ instrumentId: instrument.id, watch: !data.watching })}
        onRegister={() => openRegister({ instrument })}
      />
      <TitleKeyFacts
        type={instrument.type}
        currency={instrument.currency}
        stats={data.stats}
        fundamentals={data.fundamentals}
        stock={data.stock}
        dividends={data.dividends}
      />
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-3">
          <TitlePriceChart
            series={data.series}
            currency={instrument.currency}
            period={period}
            onPeriodChange={setPeriod}
            backfilling={data.backfilling}
            purchases={data.position?.purchases}
            averagePrice={data.position?.averagePrice ?? null}
          />
          {instrument.priceMode === "manuale" && instrument.isin && instrument.createdByUserId ? (
            <TitleQuotationCard instrumentId={instrument.id} isin={instrument.isin} currency={instrument.currency} />
          ) : null}
          {data.stats ? <TitleStatsCard stats={data.stats} currency={instrument.currency} /> : null}
        </div>
        <div className="flex flex-col gap-10 lg:col-span-2">
          {data.position ? <TitlePositionCard position={data.position} currency={instrument.currency} /> : null}
          {data.stats ? <TitleRiskSection stats={data.stats} /> : null}
          <TitleInsideFunds funds={data.insideFunds} />
          <TitleAlertsCard
            instrumentId={instrument.id}
            currency={instrument.currency}
            alerts={data.alerts}
            lastClose={data.stats?.lastClose ?? null}
            supported={instrument.priceMode === "auto"}
          />
        </div>
      </div>
      <TitleDetailSections data={data} />
      {data.commentaryAvailable && data.stats ? <TitleCommentaryCard instrumentId={instrument.id} /> : null}
    </div>
  );
}
