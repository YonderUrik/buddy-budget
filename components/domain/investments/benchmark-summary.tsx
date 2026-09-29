/** Riga del confronto col benchmark: invito a sceglierlo, attesa dei prezzi o "oggi avresti X invece di Y". */

import { Button } from "@/components/ui/button";
import type { BenchmarkComparison, BenchmarkStatus } from "@/lib/calc/returns";
import { formatCurrency } from "@/lib/format";
import { benchmarkVerdict } from "@/lib/investments/returns-insights";
import { cn } from "@/lib/utils";
import { formatSignedCurrency, formatSignedPct } from "./gain-text";

const VERDICT_TEXT = {
  better: "Il tuo portafoglio ha fatto meglio",
  worse: "L'indice avrebbe fatto meglio",
  even: "Praticamente pari",
} as const;

export interface BenchmarkSummaryProps {
  status: BenchmarkStatus;
  comparison: BenchmarkComparison | null;
  /** Nome del benchmark scelto (anche mentre i prezzi si scaricano). */
  benchmarkName: string | null;
  currency: string;
  onChoose: () => void;
}

export function BenchmarkSummary({ status, comparison, benchmarkName, currency, onChoose }: BenchmarkSummaryProps) {
  if (status === "none") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
        <p className="text-sm text-muted-foreground">Avresti fatto meglio con un indice? Confronta gli stessi versamenti con un ETF.</p>
        <Button variant="outline" size="sm" onClick={onChoose}>
          Scegli un confronto
        </Button>
      </div>
    );
  }
  if (status === "missing_prices" || !comparison) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
        <p className="text-sm text-muted-foreground">
          Scarico i prezzi di {benchmarkName ?? "questo strumento"} per il periodo: il confronto compare tra poco.
        </p>
        <Button variant="ghost" size="sm" onClick={onChoose}>
          Cambia
        </Button>
      </div>
    );
  }

  const verdict = benchmarkVerdict(comparison);
  const difference = comparison.portfolioValue - comparison.simulatedValue;
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {VERDICT_TEXT[verdict]}
          {verdict !== "even" ? (
            <span className={cn("tabular-nums", difference < 0 ? "text-neg" : "text-pos")}> ({formatSignedCurrency(difference, currency)})</span>
          ) : null}
        </p>
        <Button variant="ghost" size="sm" className="-my-1" onClick={onChoose}>
          Cambia
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Con gli stessi versamenti in <span className="text-foreground">{comparison.instrument.name}</span> oggi avresti{" "}
        <span className="font-medium tabular-nums text-foreground">{format(comparison.simulatedValue)}</span> invece di{" "}
        <span className="font-medium tabular-nums text-foreground">{format(comparison.portfolioValue)}</span>. Nel periodo l&apos;indice ha
        fatto <span className="tabular-nums">{formatSignedPct(comparison.twr)}</span>
        {comparison.twrAnnual !== null ? <span className="tabular-nums"> ({formatSignedPct(comparison.twrAnnual)} l&apos;anno)</span> : null}.
      </p>
      {comparison.depleted ? (
        <p className="text-xs text-muted-foreground">Le vendite hanno superato il valore dell&apos;indice simulato, che si è azzerato.</p>
      ) : null}
    </div>
  );
}
