"use client";

import { financialCountry } from "@/lib/localization/financial-country";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

import * as React from "react";
import { TrendingUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelSection } from "./panel-section";
import type { PortfolioReturns } from "@/lib/calc/returns";
import type { Instrument } from "@/lib/db/schema/investments";

import type { PortfolioChartRange } from "@/lib/investments/chart-period";

import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { localizedReturnInsights } from "@/lib/investments/returns-insights";
import { useUpdatePortfolioMutation } from "@/lib/queries/investments";
import { matchBenchmarkSuggestion } from "@/lib/investments/benchmark-suggestions";
import { BenchmarkDialog } from "./benchmark-dialog";
import { BenchmarkSummary } from "./benchmark-summary";

import { ReturnMetric } from "./return-metric";
import { ReturnsChart } from "./returns-chart";

export interface ReturnsCardProps {
  returns: PortfolioReturns;
  inspected: PortfolioReturns | null;
  onInspect: (date: string | null) => void;
  onSelectRange: (range: PortfolioChartRange) => void;
  benchmark: Instrument | null;
  benchmarkFirstPriceDate: string | null;
  benchmarkBackfill: BackfillStateView | null | undefined;
  currency: string;
  /** Page controls shown in the card header next to «Confronta con» (broker filter, period). */
  controls?: React.ReactNode;
}

/**
 * The chart first (design option 2, 2026-10-31): header with title and every control, the chart, one line of
 * instructions, then the figures of the period (or of the date under the cursor), the verdict and the comparison with
 * the index. Same information as before, in one card.
 */
export function ReturnsCard({ returns, inspected, onInspect, onSelectRange, benchmark, benchmarkFirstPriceDate, benchmarkBackfill, currency, controls }: ReturnsCardProps) {
  const { benchmarkWait, timingInsight } = localizedReturnInsights(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatMonthLabel, formatSignedPct } = localizedFormats(formattingLocale);


  const { formatDateWithYear } = localizedFormats(formattingLocale);

  const { t: tr, features, productCountry } = useLocalization();
  const inflationCountry = tr(financialCountry(productCountry)?.name ?? productCountry);
  const [choosing, setChoosing] = React.useState(false);
  const retry = useUpdatePortfolioMutation();
  const values = inspected ?? returns;
  const wait = benchmarkWait({ backfill: benchmarkBackfill, firstPriceDate: benchmarkFirstPriceDate, baseKey: values.baseKey });
  const insight = timingInsight(values.twr, values.moneyWeighted);
  const dates = values.days === 0 ? tr("Valore iniziale al {0}", { 0: formatDateWithYear(values.baseKey) })
    : `${formatDateWithYear(values.fromKey)} – ${formatDateWithYear(values.toKey)}`;
  const { real } = values;
  const comparison = values.benchmarkStatus === "ok" ? values.benchmark : null;
  const benchmarkSuggestion = matchBenchmarkSuggestion(benchmark);
  return <>
    <PanelSection icon={TrendingUpIcon} title={tr("Rendimento del portafoglio · TWR cumulato")}
      description={tr("Base 0% a inizio periodo. Il grafico mostra il rendimento degli investimenti, indipendente dai versamenti.")}
      action={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
        <Button variant="outline" className="h-11 max-w-full min-w-0 rounded-full sm:h-9 sm:max-w-80" onClick={() => setChoosing(true)} title={benchmark?.name}>
          <span className="truncate">{benchmark ? tr("Confronta con: {0}", { 0: benchmarkSuggestion?.label ?? benchmark.name }) : tr("Scegli un confronto")}</span>
        </Button>
        {controls}
      </div>}
      className="rounded-2xl bg-card p-4 sm:p-6">
    <div className="flex flex-col gap-5">
      {returns.series.length >= 2 ? <ReturnsChart series={returns.series} benchmarkName={returns.benchmark ? benchmarkSuggestion?.label ?? benchmark?.name ?? null : null} onInspect={onInspect} onSelectRange={onSelectRange} /> : null}
      <p className="text-xs text-muted-foreground" data-testid="performance-summary-period">
        {inspected ? `${tr("Anteprima dal grafico")} · ${dates}` : tr("Passa su una data per aggiornare i numeri qui sotto, su un numero per capire cosa misura. Clicca e trascina per selezionare un intervallo, oppure scegli le date dal calendario accanto ai periodi.")}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t pt-5 lg:grid-cols-4">
        <ReturnMetric
          label={tr("Portafoglio · TWR")}
          value={values.twr}
          annual={values.twrAnnual}
          periodLabel={dates}
          description={tr("La performance degli investimenti. È la linea del grafico.")}
          hint={tr("Il rendimento ponderato per il tempo (TWR) concatena i rendimenti giornalieri e neutralizza acquisti e vendite. Misura la performance degli strumenti, senza dare più peso ai giorni in cui avevi più soldi investiti. È il valore da confrontare con un indice.")}
        />
        <ReturnMetric
          label={tr("I tuoi versamenti · MWR")}
          value={values.moneyWeighted}
          annual={values.moneyWeightedAnnual}
          periodLabel={dates}
          description={tr("Tiene conto di quanto e quando hai investito.")}
          hint={tr("Il rendimento ponderato per il denaro (MWR), calcolato con XIRR e riportato alla durata del periodo, considera importi e date dei tuoi movimenti. Può differire dal TWR se hai investito di più prima di un rialzo o di un calo. Non è la linea del grafico. Se non esiste un tasso calcolabile, mostriamo un trattino.")}
        />
        {features.inflation && <ReturnMetric
          label={tr("Potere d’acquisto · Reale")}
          value={real?.value ?? null}
          periodLabel={dates}
          note={real ? tr("Inflazione ({2}) {0} fino a {1}", {2: inflationCountry, 0: formatSignedPct(real.inflation), 1: formatMonthLabel(real.throughMonth).toLowerCase()}) : tr("Dati sull’inflazione insufficienti per questo intervallo.")}
          description={tr("Il TWR dopo l’effetto dell’inflazione.")}
          hint={tr("Corregge il rendimento TWR per l’aumento dei prezzi nel paese del prodotto ({0}, indice Eurostat). Un valore positivo indica un aumento del potere d’acquisto. È una stima che usa l’ultimo dato mensile di inflazione disponibile: la data è indicata sotto il numero. Non è la linea del grafico.", {0: inflationCountry})}
        />}
        {comparison ? <ReturnMetric
          label={benchmarkSuggestion ? tr("Indice · {0}", { 0: benchmarkSuggestion.label }) : comparison.instrument.name}
          value={comparison.twr}
          annual={comparison.twrAnnual}
          periodLabel={dates}
          description={tr("L'indice di confronto nello stesso periodo. È la seconda linea del grafico.")}
          hint={tr("Il rendimento ponderato per il tempo (TWR) dell'ETF di confronto nello stesso periodo: si confronta con il TWR del portafoglio.")}
        /> : null}
      </div>
      <div className="flex flex-col gap-3">
        <BenchmarkSummary status={values.benchmarkStatus} comparison={values.benchmark} asOf={values.toKey}
          benchmarkName={benchmark?.name ?? null} benchmarkLabel={benchmarkSuggestion?.label ?? null} portfolioMoneyWeighted={values.moneyWeighted} currency={currency} wait={wait}
          onChoose={() => setChoosing(true)} onRetry={() => benchmark && retry.mutate({ benchmarkInstrumentId: benchmark.id })} retrying={retry.isPending} />
        <p className="text-sm text-muted-foreground">{insight ?? tr("TWR e MWR misurano aspetti diversi dello stesso periodo.")}</p>
      </div>
    </div>
    </PanelSection>
    <BenchmarkDialog open={choosing} onOpenChange={setChoosing} current={benchmark} currency={currency} />
  </>;
}
