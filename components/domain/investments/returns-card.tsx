"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

import * as React from "react";
import { TrendingUpIcon } from "lucide-react";
import { PanelSection } from "./panel-section";
import type { PortfolioReturns } from "@/lib/calc/returns";
import type { Instrument } from "@/lib/db/schema/investments";

import type { PortfolioChartRange } from "@/lib/investments/chart-period";

import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { localizedReturnInsights } from "@/lib/investments/returns-insights";
import { useUpdatePortfolioMutation } from "@/lib/queries/investments";
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
}

/** Tipi di rendimento espliciti; i numeri seguono la data ispezionata senza spostare il grafico. */
export function ReturnsCard({ returns, inspected, onInspect, onSelectRange, benchmark, benchmarkFirstPriceDate, benchmarkBackfill, currency }: ReturnsCardProps) {
  const { benchmarkWait, timingInsight } = localizedReturnInsights(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatMonthLabel, formatSignedPct } = localizedFormats(formattingLocale);


  const { formatDateWithYear } = localizedFormats(formattingLocale);

  const { t: tr, features } = useLocalization();
  const [choosing, setChoosing] = React.useState(false);
  const retry = useUpdatePortfolioMutation();
  const values = inspected ?? returns;
  const wait = benchmarkWait({ backfill: benchmarkBackfill, firstPriceDate: benchmarkFirstPriceDate, baseKey: values.baseKey });
  const insight = timingInsight(values.twr, values.moneyWeighted);
  const dates = values.days === 0 ? tr("Valore iniziale al {0}", { 0: formatDateWithYear(values.baseKey) })
    : `${formatDateWithYear(values.fromKey)} – ${formatDateWithYear(values.toKey)}`;
  const { real } = values;
  return <>
    <PanelSection icon={TrendingUpIcon} title={tr("Rendimenti del periodo")}>
      <p className="text-sm text-muted-foreground" data-testid="performance-summary-period">
        {inspected ? tr("Anteprima dal grafico") : tr("Periodo del grafico")} {"·"}{dates}
      </p>
      <p className="text-xs text-muted-foreground">{tr("Importi e rendimenti in")}{" "}{currency}{tr(". Passa su un numero per capire cosa misura.")}</p>
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
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
          note={real ? tr("Inflazione {0} fino a {1}", {0: formatSignedPct(real.inflation), 1: formatMonthLabel(real.throughMonth).toLowerCase()}) : tr("Dati sull’inflazione insufficienti per questo intervallo.")}
          description={tr("Il TWR dopo l’effetto dell’inflazione.")}
          hint={tr("Corregge il rendimento TWR per l’aumento dei prezzi in Italia (indice Eurostat). Un valore positivo indica un aumento del potere d’acquisto. È una stima che usa l’ultimo dato mensile di inflazione disponibile: la data è indicata sotto il numero. Non è la linea del grafico.")}
        />}
      </div>
      <p className="min-h-5 text-sm text-muted-foreground">{insight ?? tr("TWR e MWR misurano aspetti diversi dello stesso periodo.")}</p>
      <BenchmarkSummary status={values.benchmarkStatus} comparison={values.benchmark} asOf={values.toKey}
        benchmarkName={benchmark?.name ?? null} currency={currency} wait={wait}
        onChoose={() => setChoosing(true)} onRetry={() => benchmark && retry.mutate({ benchmarkInstrumentId: benchmark.id })} retrying={retry.isPending} />
      {returns.series.length >= 2 ? <ReturnsChart series={returns.series} benchmarkName={returns.benchmark ? benchmark?.name ?? null : null} onInspect={onInspect} onSelectRange={onSelectRange} /> : null}
    </div>
    </PanelSection>
    <BenchmarkDialog open={choosing} onOpenChange={setChoosing} current={benchmark} currency={currency} />
  </>;
}
