"use client";

/**
 * Card "Quanto sta rendendo": rendimento del portafoglio (TWR), dei tuoi soldi (money-weighted), al netto
 * dell'inflazione e confronto con un indice a parità di versamenti, sullo stesso periodo della card principale.
 */

import * as React from "react";
import { TrendingUpIcon } from "lucide-react";
import { PanelSection } from "./panel-section";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import type { PortfolioReturns } from "@/lib/calc/returns";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatMonthLabel } from "@/lib/investments/operations-history";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { benchmarkWait, timingInsight } from "@/lib/investments/returns-insights";
import { useUpdatePortfolioMutation } from "@/lib/queries/investments";
import { BenchmarkDialog } from "./benchmark-dialog";
import { BenchmarkSummary } from "./benchmark-summary";
import { formatSignedPct } from "./gain-text";
import { ReturnMetric } from "./return-metric";
import { ReturnsChart } from "./returns-chart";

/** "fino a settembre 2026", "fino ad agosto 2026": "ad" davanti ai mesi che iniziano per vocale. */
function untilMonth(month: string): string {
  const label = formatMonthLabel(month).toLowerCase();
  return `fino ${/^[aeiou]/.test(label) ? "ad" : "a"} ${label}`;
}

const PERIOD_LABELS: Record<NetWorthPeriod, string> = {
  "1mese": "Nell'ultimo mese",
  "3mesi": "Negli ultimi 3 mesi",
  "1anno": "Nell'ultimo anno",
  max: "Dalla prima operazione",
};

export interface ReturnsCardProps {
  returns: PortfolioReturns;
  period: NetWorthPeriod;
  benchmark: Instrument | null;
  /** Primo prezzo caricato del benchmark, per spiegare un confronto che non parte. */
  benchmarkFirstPriceDate: string | null;
  /** Stato del recupero dello storico del benchmark: undefined finché non è stato letto. */
  benchmarkBackfill: BackfillStateView | null | undefined;
  currency: string;
}

export function ReturnsCard({ returns, period, benchmark, benchmarkFirstPriceDate, benchmarkBackfill, currency }: ReturnsCardProps) {
  const [choosing, setChoosing] = React.useState(false);
  const retry = useUpdatePortfolioMutation();
  const wait = benchmarkWait({ backfill: benchmarkBackfill, firstPriceDate: benchmarkFirstPriceDate, baseKey: returns.baseKey });
  const insight = timingInsight(returns.twr, returns.moneyWeighted);
  const { real } = returns;

  return (
    <>
    <PanelSection icon={TrendingUpIcon} title="Quanto sta rendendo" description={PERIOD_LABELS[period]}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <ReturnMetric
            label="Il portafoglio"
            value={returns.twr}
            annual={returns.twrAnnual}
            hint="Quanto hanno reso gli strumenti che hai scelto, a prescindere da quando e quanto hai versato. È il numero da confrontare con un indice o un fondo."
          />
          <ReturnMetric
            label="I tuoi soldi"
            value={returns.moneyWeighted}
            annual={returns.moneyWeightedAnnual}
            hint="Il rendimento che hai ottenuto davvero: tiene conto di quando hai messo i soldi. Se hai versato molto poco prima di un calo è più basso di quello del portafoglio."
          />
          {real ? (
            <ReturnMetric
              label="Tolta l'inflazione"
              value={real.value}
              note={`Inflazione ${formatSignedPct(real.inflation)} ${untilMonth(real.throughMonth)}`}
              hint="Il rendimento del portafoglio al netto dell'aumento dei prezzi in Italia (indice Eurostat). Se è positivo, con quei soldi oggi compri più cose di prima."
            />
          ) : null}
        </div>
        {insight ? <p className="text-sm text-muted-foreground">{insight}</p> : null}
        <BenchmarkSummary
          status={returns.benchmarkStatus}
          comparison={returns.benchmark}
          benchmarkName={benchmark?.name ?? null}
          currency={currency}
          wait={wait}
          onChoose={() => setChoosing(true)}
          onRetry={() => benchmark && retry.mutate({ benchmarkInstrumentId: benchmark.id })}
          retrying={retry.isPending}
        />
        {returns.series.length >= 2 ? <ReturnsChart series={returns.series} benchmarkName={returns.benchmark ? benchmark?.name ?? null : null} /> : null}
      </div>
    </PanelSection>
    <BenchmarkDialog open={choosing} onOpenChange={setChoosing} current={benchmark} currency={currency} />
    </>
  );
}
