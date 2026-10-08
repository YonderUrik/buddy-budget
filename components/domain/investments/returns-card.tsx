"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortfolioReturns } from "@/lib/calc/returns";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatDateWithYear } from "@/lib/format";
import type { PortfolioChartRange } from "@/lib/investments/chart-period";
import { formatMonthLabel } from "@/lib/investments/operations-history";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { benchmarkWait, timingInsight } from "@/lib/investments/returns-insights";
import { useUpdatePortfolioMutation } from "@/lib/queries/investments";
import { BenchmarkDialog } from "./benchmark-dialog";
import { BenchmarkSummary } from "./benchmark-summary";
import { formatSignedPct } from "./gain-text";
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
  const [choosing, setChoosing] = React.useState(false);
  const retry = useUpdatePortfolioMutation();
  const values = inspected ?? returns;
  const wait = benchmarkWait({ backfill: benchmarkBackfill, firstPriceDate: benchmarkFirstPriceDate, baseKey: values.baseKey });
  const insight = timingInsight(values.twr, values.moneyWeighted);
  const dates = values.days === 0 ? `Valore iniziale al ${formatDateWithYear(values.baseKey)}`
    : `${formatDateWithYear(values.fromKey)} – ${formatDateWithYear(values.toKey)}`;
  const { real } = values;
  return <Card>
    <CardHeader>
      <CardTitle className="text-base font-semibold">Rendimenti del periodo</CardTitle>
      <p className="text-sm text-muted-foreground" data-testid="performance-summary-period">
        {inspected ? "Anteprima dal grafico" : "Periodo del grafico"} · {dates}
      </p>
      <p className="text-xs text-muted-foreground">Importi e rendimenti in {currency}. Passa su un numero per capire cosa misura.</p>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReturnMetric
          label="Portafoglio · TWR"
          value={values.twr}
          annual={values.twrAnnual}
          periodLabel={dates}
          description="La performance degli investimenti. È la linea del grafico."
          hint="Il rendimento ponderato per il tempo (TWR) concatena i rendimenti giornalieri e neutralizza acquisti e vendite. Misura la performance degli strumenti, senza dare più peso ai giorni in cui avevi più soldi investiti. È il valore da confrontare con un indice."
        />
        <ReturnMetric
          label="I tuoi versamenti · MWR"
          value={values.moneyWeighted}
          annual={values.moneyWeightedAnnual}
          periodLabel={dates}
          description="Tiene conto di quanto e quando hai investito."
          hint="Il rendimento ponderato per il denaro (MWR), calcolato con XIRR e riportato alla durata del periodo, considera importi e date dei tuoi movimenti. Può differire dal TWR se hai investito di più prima di un rialzo o di un calo. Non è la linea del grafico. Se non esiste un tasso calcolabile, mostriamo un trattino."
        />
        <ReturnMetric
          label="Potere d’acquisto · Reale"
          value={real?.value ?? null}
          periodLabel={dates}
          note={real ? `Inflazione ${formatSignedPct(real.inflation)} fino a ${formatMonthLabel(real.throughMonth).toLowerCase()}` : "Dati sull’inflazione insufficienti per questo intervallo."}
          description="Il TWR dopo l’effetto dell’inflazione."
          hint="Corregge il rendimento TWR per l’aumento dei prezzi in Italia (indice Eurostat). Un valore positivo indica un aumento del potere d’acquisto. È una stima che usa l’ultimo dato mensile di inflazione disponibile: la data è indicata sotto il numero. Non è la linea del grafico."
        />
      </div>
      <p className="min-h-5 text-sm text-muted-foreground">{insight ?? "TWR e MWR misurano aspetti diversi dello stesso periodo."}</p>
      <BenchmarkSummary status={values.benchmarkStatus} comparison={values.benchmark} asOf={values.toKey}
        benchmarkName={benchmark?.name ?? null} currency={currency} wait={wait}
        onChoose={() => setChoosing(true)} onRetry={() => benchmark && retry.mutate({ benchmarkInstrumentId: benchmark.id })} retrying={retry.isPending} />
      {returns.series.length >= 2 ? <ReturnsChart series={returns.series} benchmarkName={returns.benchmark ? benchmark?.name ?? null : null} onInspect={onInspect} onSelectRange={onSelectRange} /> : null}
    </CardContent>
    <BenchmarkDialog open={choosing} onOpenChange={setChoosing} current={benchmark} currency={currency} />
  </Card>;
}
