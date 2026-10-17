"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Period of the Analitiche data: last 12 months, last 24, or months picked on the shared month calendar. Spending,
 * savings and return (when the user does not write them) come from here; the choice is saved with the assumptions
 * and applies to the whole page.
 */

import { InfoHint, PeriodSelector } from "@/components/domain/shared";
import { CUSTOM_PERIOD_LIMITS, dataPeriodSchema, monthSpan, toMonthKey, type DataPeriod } from "@/lib/analitiche/period";
import { addMonths } from "@/lib/calc/expenses";
import { localizedPeriodText } from "./period-text";

type Choice = "12" | "24" | "personalizzato";

const CHOICES = [
  { value: "12", label: "12 mesi" },
  { value: "24", label: "24 mesi" },
] as const satisfies readonly { value: Choice; label: string }[];

/** Years offered in the custom period: the last ten (the longest period allowed). */
const YEARS_BACK = 10;

export interface DataPeriodPickerProps {
  period: DataPeriod;
  /** Start and end of the period actually used (YYYY-MM-DD). */
  fromKey: string;
  toKey: string;
  today: Date;
  /** The transactions of the period just chosen are loading. */
  updating: boolean;
  saving: boolean;
  onChange: (period: DataPeriod) => void;
}

function choiceOf(period: DataPeriod): Choice {
  return period.kind === "personalizzato" ? "personalizzato" : period.months === 24 ? "24" : "12";
}

export function DataPeriodPicker({ period, fromKey, toKey, today, updating, saving, onChange }: DataPeriodPickerProps) {
  const { t: tr, language } = useLocalization();
  const { rangeText } = localizedPeriodText(language);
  const lastFull = toMonthKey(addMonths(today, -1));
  const range = period.kind === "personalizzato" ? { from: period.from, to: period.to } : { from: toMonthKey(addMonths(today, -12)), to: lastFull };

  const validate = ({ from, to }: { from: string; to: string }) =>
    to > lastFull
      ? tr("Il mese in corso non è finito: fermati al mese scorso.")
      : monthSpan(from, to) < CUSTOM_PERIOD_LIMITS.minMonths
        ? tr("Scegli almeno {0} mesi.", { 0: CUSTOM_PERIOD_LIMITS.minMonths })
        : !dataPeriodSchema.safeParse({ kind: "personalizzato", from, to }).success
          ? tr("Scegli al massimo 10 anni.")
          : null;

  const select = (next: Choice) => {
    if (next !== "personalizzato" && next !== choiceOf(period)) onChange({ kind: "ultimi", months: next === "24" ? 24 : 12 });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-sm text-muted-foreground">{tr("I tuoi dati di")}</span>
      <PeriodSelector options={CHOICES} value={choiceOf(period)} onChange={select} ariaLabel={tr("Periodo dei tuoi dati")}
        custom={{
          value: "personalizzato", granularity: "month", range, max: lastFull, min: `${today.getFullYear() - YEARS_BACK}-01`,
          surface: "analitiche", showCaption: false, validate,
          onApply: ({ from, to }) => { if (!saving) onChange({ kind: "personalizzato", from, to }); },
        }} />
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground" aria-live="polite">
        {updating ? tr("Aggiorno le cifre…") : rangeText(fromKey, toKey)}
        <InfoHint label={tr("Cosa cambia il periodo")}>{tr("Risparmio, spesa e rendimento vengono dai tuoi movimenti e investimenti di questi mesi. Il mese in corso non conta perché non è finito. Una cifra scritta a mano resta la tua.")}</InfoHint>
      </span>
    </div>
  );
}
