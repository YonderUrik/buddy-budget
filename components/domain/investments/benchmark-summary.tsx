"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/** Riga del confronto col benchmark: invito a sceglierlo, attesa dei prezzi o "oggi avresti X invece di Y". */

import { ProgressBar, type ProgressBarState } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import type { BenchmarkComparison, BenchmarkStatus } from "@/lib/calc/returns";

import { localizedReturnInsights, type BenchmarkWait } from "@/lib/investments/returns-insights";
import { cn } from "@/lib/utils";


const VERDICT_TEXT = {
  better: "Il tuo portafoglio ha fatto meglio",
  worse: "L'indice avrebbe fatto meglio",
  even: "Praticamente pari",
} as const;

export interface BenchmarkSummaryProps {
  status: BenchmarkStatus;
  /** Data finale del confronto, anche storica durante l’ispezione del grafico. */
  asOf?: string;
  comparison: BenchmarkComparison | null;
  /** Nome del benchmark scelto (anche mentre i prezzi si scaricano). */
  benchmarkName: string | null;
  currency: string;
  /** Perché il confronto non c'è ancora (usato solo quando manca). */
  wait: BenchmarkWait;
  onChoose: () => void;
  /** Rilancia il recupero dei prezzi del benchmark. */
  onRetry: () => void;
  retrying: boolean;
}

/** Testo dell'attesa del confronto: cosa sta succedendo e, se serve, cosa può fare l'utente. */


function waitProgress(wait: BenchmarkWait): ProgressBarState {
  if (wait.kind === "checking") return { kind: "indeterminate" };
  if (wait.kind !== "downloading") return { kind: "none" };
  return wait.total ? { kind: "determinate", value: wait.saved, max: wait.total } : { kind: "indeterminate" };
}

export function BenchmarkSummary({ status, comparison, benchmarkName, currency, wait, onChoose, onRetry, retrying, asOf }: BenchmarkSummaryProps) {
  const { benchmarkVerdict } = localizedReturnInsights(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatSignedCurrency, formatSignedPct } = localizedFormats(formattingLocale);


  const { formatCurrency, formatDateWithYear } = localizedFormats(formattingLocale);
  function waitMessage(wait: BenchmarkWait, name: string): string {
  switch (wait.kind) {
    case "checking":
      return tr("Controllo i prezzi di {0}…", { 0: name });
    case "downloading":
      return wait.total
        ? tr("Scarico i prezzi di {0}: {1} giorni su {2}. Il confronto compare appena finito.", { 0: name, 1: wait.saved, 2: wait.total })
        : tr("Chiedo alle fonti lo storico dei prezzi di {0}. Il confronto compare appena finito.", { 0: name });
    case "failed":
      return tr("Non sono riuscito a scaricare i prezzi di {0}: le fonti non hanno risposto. Puoi riprovare o scegliere un altro indice.", { 0: name });
    case "no_history":
      return tr("{0} ha prezzi solo dal {1}, dopo l'inizio del periodo. Scegli un periodo più corto o un altro indice.", { 0: name, 1: formatDateWithYear(wait.firstPriceDate) });
    case "incomplete":
      return tr("Mancano alcuni prezzi o cambi di {0} nel periodo. Riprova a scaricarli.", { 0: name });
  }
}

  const { t: tr } = useLocalization();
  if (status === "none") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
        <p className="text-sm text-muted-foreground">{tr("Avresti fatto meglio con un indice? Confronta gli stessi versamenti con un ETF.")}</p>
        <Button variant="outline" size="sm" onClick={onChoose}>{tr("Scegli un confronto")}</Button>
      </div>
    );
  }
  if (status === "missing_prices" || !comparison) {
    const name = benchmarkName ?? "questo strumento";
    const canRetry = wait.kind === "failed" || wait.kind === "incomplete" || wait.kind === "no_history";
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground" aria-live="polite">
            {waitMessage(wait, name)}
          </p>
          <div className="-my-1 flex gap-1">
            {canRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
                {retrying ? tr("Riprovo…") : tr("Riprova")}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onChoose}>{tr("Cambia")}</Button>
          </div>
        </div>
        <ProgressBar state={waitProgress(wait)} label={tr("Prezzi di {0}", {0: name})} />
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
          {tr(VERDICT_TEXT[verdict])}
          {verdict !== "even" ? (
            <span className={cn("tabular-nums", difference < 0 ? "text-neg" : "text-pos")}> {"("}{formatSignedCurrency(difference, currency)}{")"}</span>
          ) : null}
        </p>
        <Button variant="ghost" size="sm" className="-my-1" onClick={onChoose}>{tr("Cambia")}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{tr("Con gli stessi versamenti in")}{" "}<span className="text-foreground">{comparison.instrument.name}</span>{" "}{asOf ? tr("al {0}", {0: formatDateWithYear(asOf)}) : tr("oggi")}{" "}{tr("avresti")}{" "}
        <span className="font-medium tabular-nums text-foreground">{format(comparison.simulatedValue)}</span>{" "}{tr("invece di")}{" "}
        <span className="font-medium tabular-nums text-foreground">{format(comparison.portfolioValue)}</span>{tr(". Nel periodo l'ETF di confronto ha reso")}{" "}<span className="tabular-nums">{formatSignedPct(comparison.twr)}</span>
        {comparison.twrAnnual !== null ? <span className="tabular-nums"> {"("}{formatSignedPct(comparison.twrAnnual)}{" "}{tr("l'anno)")}</span> : null}{"."}</p>
      {comparison.depleted ? (
        <p className="text-xs text-muted-foreground">{tr("Le vendite hanno superato il valore dell'indice simulato, che si è azzerato.")}</p>
      ) : null}
    </div>
  );
}
