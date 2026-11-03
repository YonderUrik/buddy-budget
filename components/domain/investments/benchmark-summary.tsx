"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/** Riga del confronto col benchmark: invito a sceglierlo, attesa dei prezzi o "oggi avresti X invece di Y". */

import { ProgressBar, type ProgressBarState } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import type { BenchmarkComparison, BenchmarkStatus } from "@/lib/calc/returns";

import { localizedReturnInsights, type BenchmarkWait } from "@/lib/investments/returns-insights";
import { cn } from "@/lib/utils";
import { useDesignProposal } from "@/lib/investments/design-proposal";



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
  /** Short name of the index (e.g. «MSCI World») when the benchmark is a common one; otherwise the ETF name is used. */
  benchmarkLabel?: string | null;
  /** Money-weighted return of the portfolio over the same period, shown beside its value. */
  portfolioMoneyWeighted?: number | null;
}

/** Testo dell'attesa del confronto: cosa sta succedendo e, se serve, cosa può fare l'utente. */


function waitProgress(wait: BenchmarkWait): ProgressBarState {
  if (wait.kind === "checking") return { kind: "indeterminate" };
  if (wait.kind !== "downloading") return { kind: "none" };
  return wait.total ? { kind: "determinate", value: wait.saved, max: wait.total } : { kind: "indeterminate" };
}

export function BenchmarkSummary({ status, comparison, benchmarkName, currency, wait, onChoose, onRetry, retrying, asOf, benchmarkLabel = null, portfolioMoneyWeighted = null }: BenchmarkSummaryProps) {
  const proposal = useDesignProposal();
  const { benchmarkVerdict } = localizedReturnInsights(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct } = localizedFormats(formattingLocale);


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
  const label = benchmarkLabel ?? comparison.instrument.name;
  const headline = verdict === "even" ? tr("Pari con {0}", { 0: label })
    : verdict === "better" ? tr("Hai battuto {0} di {1}", { 0: label, 1: format(Math.abs(difference)) })
    : tr("{0} ha fatto meglio di {1}", { 0: label, 1: format(Math.abs(difference)) });
  const when = asOf ? tr("al {0}", { 0: formatDateWithYear(asOf) }) : tr("oggi");
  const sides = [
    { key: "portfolio", name: tr("Il tuo portafoglio"), value: comparison.portfolioValue, mwr: portfolioMoneyWeighted, color: "var(--primary)", wins: verdict === "better" },
    { key: "index", name: label, value: comparison.simulatedValue, mwr: comparison.moneyWeighted, color: "var(--swatch-amber)", wins: verdict === "worse" },
  ];
  const top = Math.max(comparison.portfolioValue, comparison.simulatedValue, 1);
  const winnerChip = <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-medium text-on-sun">{tr("Meglio")}</span>;
  const change = <Button variant="ghost" size="sm" className="-my-1 shrink-0" onClick={onChoose}>{tr("Cambia")}</Button>;

  if (proposal === "b") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-muted/50 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-display text-2xl leading-tight", verdict === "worse" ? "text-neg" : verdict === "better" ? "text-pos" : "text-foreground")}>{headline}</p>
          {change}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sides.map((side) => (
            <div key={side.key} className={cn("flex min-w-0 flex-col gap-1 rounded-xl bg-background p-3", side.wins && "ring-2 ring-sun")}>
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: side.color }} /><span className="truncate">{side.key === "portfolio" ? tr("Tu") : label}</span></span>
                {side.wins ? winnerChip : null}
              </span>
              <span className="font-heading text-xl font-medium tabular-nums sm:text-2xl">{format(side.value)}</span>
              {side.mwr !== null ? <span className="text-xs tabular-nums text-muted-foreground">{tr("{0} sui versamenti", { 0: formatSignedPct(side.mwr) })}</span> : null}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{tr("Stessi versamenti, stessi giorni, {0}. Il confronto usa {1}.", { 0: when, 1: comparison.instrument.name })}</p>
        {comparison.depleted ? <p className="text-xs text-muted-foreground">{tr("Le vendite hanno superato il valore dell'indice simulato, che si è azzerato.")}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-muted/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-medium text-foreground">
          {verdict === "even" ? headline : verdict === "better" ? tr("Hai fatto meglio dell'indice") : tr("L'indice ha fatto meglio")}
          {verdict !== "even" ? <span className={cn("ml-2 tabular-nums", difference < 0 ? "text-neg" : "text-pos")}>{difference < 0 ? "−" : "+"}{format(Math.abs(difference))}</span> : null}
        </p>
        {change}
      </div>
      <div className="flex flex-col gap-3">
        {sides.map((side) => (
          <div key={side.key} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2"><span className="truncate">{side.name}</span>{side.wins ? winnerChip : null}</span>
              <span className="shrink-0 font-medium tabular-nums">{format(side.value)}</span>
            </span>
            <span className="h-3 overflow-hidden rounded-full bg-background">
              <span className="block h-full rounded-full" style={{ width: `${Math.max((side.value / top) * 100, 2)}%`, backgroundColor: side.color }} />
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{tr("Stessi versamenti, stessi giorni, {0}. Il confronto usa {1}.", { 0: when, 1: comparison.instrument.name })}</p>
      {comparison.depleted ? <p className="text-xs text-muted-foreground">{tr("Le vendite hanno superato il valore dell'indice simulato, che si è azzerato.")}</p> : null}
    </div>
  );
}
