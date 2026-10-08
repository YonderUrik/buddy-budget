/** Anteprima di un'estinzione anticipata: le due alternative affiancate (o l'esito di un extra mensile), con i numeri che contano. */

import { CalendarCheckIcon, TrendingDownIcon } from "lucide-react";
import type { EarlyRepaymentOutcome } from "@/lib/calc/early-repayment";
import type { EarlyRepaymentPreview } from "@/lib/debts/early-repayment-form";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "./debts-format";

type PreviewOnce = Extract<EarlyRepaymentPreview, { kind: "once" }>;
type PreviewMonthly = Extract<EarlyRepaymentPreview, { kind: "monthly" }>;

const EFFECT_COPY = {
  reduce_installment: { title: "Riduci la rata", detail: "Stessa scadenza, rata più bassa", Icon: TrendingDownIcon },
  reduce_duration: { title: "Riduci la durata", detail: "Stessa rata, finisci prima", Icon: CalendarCheckIcon },
} as const;

function monthsLabel(months: number): string {
  if (months <= 0) return "stessa scadenza";
  return months === 1 ? "1 mese prima" : `${months} mesi prima`;
}

function Row({ label, value, strong, positive }: { label: string; value: string; strong?: boolean; positive?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right tabular-nums text-foreground", strong && "font-medium", positive && "text-pos")}>{value}</dd>
    </div>
  );
}

function OutcomeCard({ outcome, currency, selectable, selected, onSelect }: { outcome: EarlyRepaymentOutcome; currency: string; selectable: boolean; selected: boolean; onSelect: () => void }) {
  const copy = EFFECT_COPY[outcome.effect];
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <copy.Icon size={15} className="text-primary" aria-hidden="true" />
        {copy.title}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">{copy.detail}</p>
      <dl className="flex flex-col gap-1">
        <Row label="Prossima rata" value={outcome.closesDebt ? "—" : formatCurrency(outcome.nextInstallment, currency)} />
        <Row label="Finisci" value={`${formatMonthYear(outcome.endDate)} · ${monthsLabel(outcome.monthsSaved)}`} />
        <Row label="Interessi risparmiati" value={formatCurrency(outcome.interestSaved, currency)} strong positive />
        <Row label="Al netto della penale" value={formatCurrency(outcome.netBenefit, currency)} strong positive={outcome.netBenefit > 0} />
      </dl>
    </>
  );
  const classes = cn("rounded-lg border p-3 text-left", selected ? "border-primary bg-primary/5" : "border-border");
  if (!selectable) return <div className={classes}>{body}</div>;
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={cn(classes, "transition-colors hover:border-primary/60")}>
      {body}
    </button>
  );
}

export interface EarlyRepaymentCompareProps {
  preview: PreviewOnce;
  currency: string;
  /** Alternativa scelta per la registrazione; null = nessuna. */
  selected: "reduce_installment" | "reduce_duration" | null;
  onSelect: (effect: "reduce_installment" | "reduce_duration") => void;
}

/** Confronto "riduci la rata / riduci la durata" per un'estinzione una tantum. */
export function EarlyRepaymentCompare({ preview, currency, selected, onSelect }: EarlyRepaymentCompareProps) {
  const { comparison } = preview;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Senza estinzione: rata {formatCurrency(comparison.baselineInstallment, currency)}, fine {formatMonthYear(comparison.baselineEndDate)}, ancora{" "}
        {formatCurrency(comparison.baselineInterest, currency)} di interessi.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <OutcomeCard outcome={comparison.reduceInstallment} currency={currency} selectable selected={selected === "reduce_installment"} onSelect={() => onSelect("reduce_installment")} />
        <OutcomeCard outcome={comparison.reduceDuration} currency={currency} selectable selected={selected === "reduce_duration"} onSelect={() => onSelect("reduce_duration")} />
      </div>
    </div>
  );
}

export interface EarlyRepaymentMonthlyProps {
  preview: PreviewMonthly;
  currency: string;
}

/** Esito di un extra versato ogni mese (solo simulazione). */
export function EarlyRepaymentMonthly({ preview, currency }: EarlyRepaymentMonthlyProps) {
  const { result } = preview;
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">Con {formatCurrency(preview.amount, currency)} in più ogni mese</p>
      <dl className="flex flex-col gap-1">
        <Row label="Finisci" value={`${formatMonthYear(result.endDate)} · ${monthsLabel(result.monthsSaved)}`} />
        <Row label="Interessi risparmiati" value={formatCurrency(result.interestSaved, currency)} strong positive />
        <Row label="Versato in extra in totale" value={formatCurrency(result.extraPaid, currency)} />
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">È solo una simulazione: non si registra. Se vuoi farlo davvero, registra le singole estinzioni quando le fai.</p>
    </div>
  );
}
