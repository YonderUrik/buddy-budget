"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Dialog "Estinzione anticipata": con importo, data e penale mostra subito le due alternative (riduci rata / riduci
 * durata); si registra scegliendone una. Con "Ogni mese" è solo una simulazione di un extra ricorrente.
 */

import * as React from "react";
import { BanknoteIcon, CheckIcon, GitCompareArrowsIcon, PiggyBankIcon } from "lucide-react";
import { DialogActions, DialogSection, DialogSections, PanelDialogHeader } from "@/components/domain/investments/light";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl, FormDialogContent } from "@/components/domain/shared";
import { todayIso } from "@/lib/debts/dates";
import { previewEarlyRepayment, type EarlyRepaymentMode, type PenaltyUnit } from "@/lib/debts/early-repayment-form";
import type { DebtView } from "@/lib/debts/view";
import { useCreateDebtEventMutation } from "@/lib/queries/debts";
import { DebtFormField } from "./debt-form-field";
import { EarlyRepaymentCompare, EarlyRepaymentMonthly } from "./early-repayment-compare";

const MODE_OPTIONS = [
  { value: "once", label: "Una volta" },
  { value: "monthly", label: "Ogni mese (simula)" },
] as const;

const UNIT_LABELS: Record<PenaltyUnit, string> = { eur: "€", percent: "% della somma" };

const DESCRIPTION = "Vedi cosa cambia prima di decidere. Se l'hai già fatto, scegli l'alternativa che la banca ti ha applicato e registrala.";

export interface EarlyRepaymentDialogProps {
  debt: DebtView;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EarlyRepaymentForm({ debt, currency, onDone }: { debt: DebtView; currency: string; onDone: () => void }) {
  const { t: tr } = useLocalization();
  const mutation = useCreateDebtEventMutation();
  const today = todayIso();
  const [mode, setMode] = React.useState<EarlyRepaymentMode>("once");
  const [date, setDate] = React.useState(today);
  const [amount, setAmount] = React.useState("");
  const [penalty, setPenalty] = React.useState("");
  const [penaltyUnit, setPenaltyUnit] = React.useState<PenaltyUnit>("eur");
  const [effect, setEffect] = React.useState<"reduce_installment" | "reduce_duration" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  const preview = React.useMemo(
    () => previewEarlyRepayment(debt, today, { mode, date, amount, penalty, penaltyUnit }),
    [debt, today, mode, date, amount, penalty, penaltyUnit]
  );

  /** Una somma una tantum e un extra mensile sono cose diverse: cambiando modo si riparte da campi vuoti. */
  function changeMode(next: EarlyRepaymentMode) {
    setMode(next);
    setAmount("");
    setEffect(null);
  }

  function register() {
    if (preview.kind !== "once" || !effect) return;
    setError(null);
    mutation.mutate(
      { debtId: debt.id, input: { type: "early_repayment", date: preview.date, amount: preview.amount, penalty: preview.penalty, effect } },
      { onSuccess: onDone, onError: (e) => setError(e.message) }
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogSections>
        <DialogSection title={tr("Quanto e quando")} icon={BanknoteIcon}>
          <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={changeMode} ariaLabel={tr("Quante volte")} stretch />
          <div className="grid grid-cols-2 gap-3">
            <DebtFormField label={mode === "once" ? tr("Importo che estingui") : tr("Extra ogni mese")} htmlFor={`${id}-amount`}>
              <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </DebtFormField>
            {mode === "once" ? (
              <DebtFormField label={tr("Data")} htmlFor={`${id}-date`}>
                <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </DebtFormField>
            ) : null}
          </div>
          {mode === "once" ? (
            <DebtFormField label={tr("Penale di estinzione (facoltativa)")} htmlFor={`${id}-penalty`} hint={tr("La trovi nel contratto: spesso fino all'1% della somma")}>
              <div className="flex gap-2">
                <Input id={`${id}-penalty`} inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} />
                <Select value={penaltyUnit} onValueChange={(v) => setPenaltyUnit(v as PenaltyUnit)}>
                  <SelectTrigger className="w-40" aria-label={tr("Unità della penale")}>
                    <SelectValue>{tr(UNIT_LABELS[penaltyUnit])}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(UNIT_LABELS) as PenaltyUnit[]).map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {tr(UNIT_LABELS[unit])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DebtFormField>
          ) : null}
        </DialogSection>

        {preview.kind !== "empty" || error ? (
          <DialogSection title={tr("Cosa cambia")} icon={GitCompareArrowsIcon}>
            {preview.kind === "error" ? <p className="text-sm text-neg" role="alert">{tr(preview.message)}</p> : null}
            {preview.kind === "once" ? <EarlyRepaymentCompare preview={preview} currency={currency} selected={effect} onSelect={setEffect} /> : null}
            {preview.kind === "monthly" ? <EarlyRepaymentMonthly preview={preview} currency={currency} /> : null}
            {error ? <p className="text-sm text-neg" role="alert">{tr(error)}</p> : null}
          </DialogSection>
        ) : null}
      </DialogSections>

      {mode === "once" ? (
        <DialogActions>
          <span />
          <Button type="button" onClick={register} disabled={mutation.isPending || preview.kind !== "once" || !effect}>
            {effect && !mutation.isPending ? <CheckIcon aria-hidden="true" /> : null}
            {mutation.isPending ? tr("Salvo…") : effect ? tr("Registra come fatto") : tr("Scegli un'alternativa per registrarla")}
          </Button>
        </DialogActions>
      ) : null}
    </div>
  );
}

export function EarlyRepaymentDialog({ debt, currency, open, onOpenChange }: EarlyRepaymentDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent>
        <PanelDialogHeader icon={PiggyBankIcon} title={tr("Estinzione anticipata")} description={DESCRIPTION} />
        {open ? <EarlyRepaymentForm debt={debt} currency={currency} onDone={() => onOpenChange(false)} /> : null}
      </FormDialogContent>
    </Dialog>
  );
}
