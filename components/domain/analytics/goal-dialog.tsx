"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Il tuo traguardo»: chiede una sola cifra, quanto ti serve all'anno, e mostra subito il patrimonio che basta per
 * prelevarla ogni anno e l'anno in cui ci arrivi. È il passo «Fissa il tuo traguardo» dei Primi passi.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSUMPTION_LIMITS, type AnalyticsAssumptions, type UpdateAssumptionsInput } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import { resolvePlan, type AnalyticsPlan } from "@/lib/analitiche/plan";
import { localizedAnalyticsFormats } from "./analytics-format";
import { parseNumber } from "./assumptions-fields";

/** Da dove viene la spesa salvata: lasciata ai movimenti (si aggiorna da sola) o scritta dall'utente. */
export type GoalSource = "dati" | "scritta";

export interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  base: AnalyticsBase;
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  saving: boolean;
  error: string | null;
  today: Date;
  onSave: (input: UpdateAssumptionsInput) => Promise<void>;
  /** Traguardo salvato, per le statistiche. */
  onSaved?: (source: GoalSource) => void;
}

const FIELD_ID = "goal-spending";

export function GoalDialog({ open, onOpenChange, ...rest }: GoalDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr("Il tuo traguardo")}</DialogTitle>
          <DialogDescription>{tr("Il traguardo è il patrimonio che ti permette di vivere dei tuoi soldi: ogni anno ne prelevi una piccola parte e ti basta per le spese. Ti serve una sola cifra.")}</DialogDescription>
        </DialogHeader>
        {/* Il modulo si rimonta a ogni apertura, così riparte dalle ipotesi salvate. */}
        {open ? <GoalForm {...rest} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ base, assumptions, plan, saving, error, today, onSave, onSaved, onClose }: Omit<GoalDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const { money } = localizedAnalyticsFormats(useLocalization().language);

  const { t: tr, locale } = useLocalization();
  const dataSpending = plan.spendingSource === "dati" ? plan.spending : null;
  const [text, setText] = React.useState(plan.spending !== null ? new Intl.NumberFormat(locale).format(Math.round(plan.spending)) : "");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const value = parseNumber(text, locale);
  const valid = value !== null && value > 0 && value <= ASSUMPTION_LIMITS.amount.max;
  // Se la cifra è quella dei movimenti, resta legata ai movimenti e si aggiorna da sola.
  const followsData = dataSpending !== null && value !== null && Math.round(value) === Math.round(dataSpending);
  const preview = React.useMemo(() => (valid ? resolvePlan(base, { ...assumptions, annualSpending: value }) : null), [base, assumptions, valid, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setLocalError(tr("Scrivi quanto ti serve in un anno, per esempio 24.000."));
      return;
    }
    setLocalError(null);
    try {
      await onSave({ annualSpending: followsData ? null : value });
      onSaved?.(followsData ? "dati" : "scritta");
      onClose();
    } catch {
      // L'errore arriva già da `error`.
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={FIELD_ID}>{tr("Quanto ti serve in un anno")}</Label>
        <Input id={FIELD_ID} inputMode="numeric" autoComplete="off" placeholder={tr("Per esempio 24.000")} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {dataSpending !== null
            ? tr("Dai tuoi movimenti spendi circa {0} l'anno: puoi tenerla o scrivere la cifra con cui vorresti vivere.", {0: money(dataSpending, base.currency)})
            : tr("Tutte le spese di un anno: casa, spesa, svago. Se non la sai, parti da 12 volte quello che spendi in un mese.")}
        </p>
      </div>
      <GoalPreview preview={preview} withdrawalRate={assumptions.withdrawalRate} currency={base.currency} today={today} />
      {localError || error ? (
        <p className="text-sm text-neg" role="alert">
          {localError ?? error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{tr("Annulla")}</Button>
        <Button type="submit" disabled={saving}>
          {saving ? tr("Salvo…") : tr("Salva il traguardo")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Il traguardo che esce dalla cifra scritta e quando ci arrivi. */
function GoalPreview({ preview, withdrawalRate, currency, today }: { preview: AnalyticsPlan | null; withdrawalRate: number; currency: string; today: Date }) {
  const { formatYears, money, pct } = localizedAnalyticsFormats(useLocalization().language);

  const { t: tr } = useLocalization();
  if (!preview || preview.target === null) {
    return <p className="text-sm text-muted-foreground">{tr("Scrivi la cifra: qui compare il patrimonio che ti serve.")}</p>;
  }
  const years = preview.yearsToFire;
  const when =
    preview.savingsSource === "manca"
      ? tr("Per dirti quando ci arrivi servono almeno 3 mesi di movimenti.")
      : years === 0
        ? tr("Il tuo patrimonio lo ha già raggiunto.")
        : years === null
          ? tr("Ai ritmi di oggi ci vorrebbero più di 80 anni.")
          : tr("Ai ritmi di oggi ci arrivi intorno al {0}, tra {1}.", { 0: today.getFullYear() + Math.ceil(years), 1: formatYears(years) });
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className="text-sm text-muted-foreground">{tr("Il tuo traguardo")}</p>
      <p className="font-heading text-3xl font-medium tracking-tight text-foreground tabular-nums">{money(preview.target, currency)}</p>
      <p className="text-sm text-text-2">{tr("Prelevandone il")}{" "}{pct(withdrawalRate)}{" "}{tr("ogni anno ricavi quello che ti serve.")}{" "}{when}
      </p>
      <p className="text-xs text-muted-foreground">{tr("Rendimento, prelievo e il resto si cambiano dopo, da «Tutte le ipotesi».")}</p>
    </div>
  );
}
