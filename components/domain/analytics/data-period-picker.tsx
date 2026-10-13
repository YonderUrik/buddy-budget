"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Scelta del periodo dei dati di Analitiche: ultimi 12 mesi, ultimi 24 o mesi scelti. Spesa, risparmio e rendimento
 * (quando non li scrive l'utente) vengono da qui; la scelta si salva con le ipotesi e vale per tutta la pagina.
 */

import * as React from "react";
import { InfoHint, SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOM_PERIOD_LIMITS, dataPeriodSchema, monthSpan, toMonthKey, type DataPeriod } from "@/lib/analitiche/period";
import { addMonths } from "@/lib/calc/expenses";
import { rangeText } from "./period-text";

type Choice = "12" | "24" | "personalizzato";

const CHOICES: { value: Choice; label: string }[] = [
  { value: "12", label: "12 mesi" },
  { value: "24", label: "24 mesi" },
  { value: "personalizzato", label: "Scegli i mesi" },
];

/** Anni proposti nel periodo personalizzato: gli ultimi dieci (il massimo del periodo). */
const YEARS_BACK = 10;


export interface DataPeriodPickerProps {
  period: DataPeriod;
  /** Inizio e fine del periodo davvero usato (AAAA-MM-GG). */
  fromKey: string;
  toKey: string;
  today: Date;
  /** Arrivano i movimenti del periodo appena scelto. */
  updating: boolean;
  saving: boolean;
  onChange: (period: DataPeriod) => void;
}

function choiceOf(period: DataPeriod): Choice {
  return period.kind === "personalizzato" ? "personalizzato" : period.months === 24 ? "24" : "12";
}

function MonthYear({ label, value, years, onChange }: { label: string; value: string; years: number[]; onChange: (value: string) => void }) {
  const { t: tr, locale } = useLocalization();
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, i, 1)));
  const [year, month] = value.split("-");
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-sm text-muted-foreground">{tr(label)}</span>
      <Select value={month} onValueChange={(m) => m && onChange(`${year}-${m}`)}>
        <SelectTrigger className="w-32" aria-label={tr("Mese ({0})", {0: label})}>
          <SelectValue>{(v: string | null) => (v ? MONTH_NAMES[Number(v) - 1] : "")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, i) => (
            <SelectItem key={name} value={String(i + 1).padStart(2, "0")}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={(y) => y && onChange(`${y}-${month}`)}>
        <SelectTrigger className="w-24" aria-label={tr("Anno ({0})", {0: label})}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DataPeriodPicker({ period, fromKey, toKey, today, updating, saving, onChange }: DataPeriodPickerProps) {
  const { t: tr } = useLocalization();
  const [choice, setChoice] = React.useState<Choice>(choiceOf(period));
  const lastFull = addMonths(today, -1);
  const [from, setFrom] = React.useState(period.kind === "personalizzato" ? period.from : toMonthKey(addMonths(lastFull, -11)));
  const [to, setTo] = React.useState(period.kind === "personalizzato" ? period.to : toMonthKey(lastFull));
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => today.getFullYear() - i);

  const custom = { kind: "personalizzato" as const, from, to };
  const span = monthSpan(from, to);
  const error =
    to > toMonthKey(lastFull)
      ? "Il mese in corso non è finito: fermati al mese scorso."
      : span < CUSTOM_PERIOD_LIMITS.minMonths
        ? tr("Scegli almeno {0} mesi.", { 0: CUSTOM_PERIOD_LIMITS.minMonths })
        : !dataPeriodSchema.safeParse(custom).success
          ? "Scegli al massimo 10 anni."
          : null;
  const unchanged = period.kind === "personalizzato" && period.from === from && period.to === to;

  const select = (next: Choice) => {
    setChoice(next);
    if (next !== "personalizzato") onChange({ kind: "ultimi", months: next === "24" ? 24 : 12 });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-muted-foreground">{tr("I tuoi dati di")}</span>
        <SegmentedControl options={CHOICES.map(option => ({ ...option, label: tr(option.label) }))} value={choice} onChange={select} ariaLabel={tr("Periodo dei tuoi dati")} />
        <span className="flex items-center gap-0.5 text-xs text-muted-foreground" aria-live="polite">
          {updating ? tr("Aggiorno le cifre…") : rangeText(fromKey, toKey)}
          <InfoHint label={tr("Cosa cambia il periodo")}>{tr("Risparmio, spesa e rendimento vengono dai tuoi movimenti e investimenti di questi mesi. Il mese in corso non conta perché non è finito. Una cifra scritta a mano resta la tua.")}</InfoHint>
        </span>
      </div>
      {choice === "personalizzato" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <MonthYear label={tr("Da")} value={from} years={years} onChange={setFrom} />
          <MonthYear label={tr("A")} value={to} years={years} onChange={setTo} />
          <Button type="button" size="sm" disabled={error !== null || unchanged || saving} onClick={() => onChange(custom)}>{tr("Usa questi mesi")}</Button>
          {error ? (
            <p className="w-full text-xs text-neg" role="alert">
              {tr(error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
