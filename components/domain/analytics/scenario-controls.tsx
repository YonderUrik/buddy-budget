"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * I quattro cursori «e se…» di Analitiche: provano risparmio, spesa, rendimento e tasso di prelievo senza salvare nulla.
 * Sotto ogni cursore, quanto cambia il traguardo rispetto alle ipotesi salvate.
 */

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { ExpectedReturnInfo } from "@/lib/analitiche/historical-return";
import type { DataPeriod } from "@/lib/analitiche/period";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { hasScenario, scenarioSlider, yearsToFireWith, type ScenarioField, type ScenarioOverrides } from "@/lib/analitiche/scenario";
import { localizedAnalyticsFormats, formatYears } from "./analytics-format";
import { CashflowSourceNote } from "./cashflow-source-note";
import { ReturnSourceNote } from "./return-source-note";
import { HIGH_RETURN_WARNING } from "./return-source";
import { InfoHint } from "@/components/domain/shared";
import type { GlossaryId } from "./glossary";
import { Term } from "./term";

export interface ScenarioControlsProps {
  /** Ipotesi e piano salvati: da qui parte ogni cursore. */
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  /** Origine del rendimento in uso, spiegata sotto il suo cursore. */
  returnInfo: ExpectedReturnInfo;
  currency: string;
  overrides: ScenarioOverrides;
  onChange: (field: ScenarioField, value: number | undefined) => void;
  /** Un cursore è stato lasciato (per le statistiche, non a ogni movimento). */
  onCommit: (field: ScenarioField) => void;
  onReset: () => void;
  onSave: () => void;
  onOpenAllAssumptions: () => void;
  /** Torna al rendimento calcolato dallo storico. */
  onUseHistoryReturn: () => void;
  /** Periodo dei dati e come si legge («negli ultimi 12 mesi»). */
  period: DataPeriod;
  periodPhrase: string;
  /** Spesa e risparmio ricavati dai movimenti (anche se l'utente ne ha scritti altri), mesi della media e del periodo. */
  dataFigures: { spending: number | null; savings: number | null };
  coveredMonths: number;
  periodMonths: number;
  /** Torna alla cifra dei movimenti per spesa o risparmio. */
  onUseData: (field: "annualSavings" | "annualSpending") => void;
  saving: boolean;
}

interface Row {
  field: ScenarioField;
  label: string;
  term?: GlossaryId;
  baseline: number | null;
  format: (v: number) => string;
  /** Cosa scrivere se il valore di partenza manca. */
  missingHint: string;
}

/** Differenza di anni rispetto a oggi in parole, o null se trascurabile. */
function deltaText(base: number | null, next: number | null): string | null {
  if (base === null || next === null) return next === null && base !== null ? "il traguardo supera gli 80 anni" : null;
  const diff = base - next;
  if (Math.abs(diff) < 0.05) return null;
  return `${formatYears(Math.abs(diff))} ${diff > 0 ? "prima" : "dopo"}`;
}

export function ScenarioControls(props: ScenarioControlsProps) {
  const { money, pct } = localizedAnalyticsFormats(useLocalization().language);

  const { t: tr } = useLocalization();
  const { assumptions, plan, returnInfo, currency, overrides, onChange, onCommit, onReset, onSave, onOpenAllAssumptions, onUseHistoryReturn, saving } = props;
  const rows: Row[] = [
    { field: "annualSavings", label: tr("Risparmio annuo"), baseline: plan.savings, format: (v) => money(v, currency), missingHint: tr("servono almeno 3 mesi di movimenti nel periodo scelto") },
    { field: "annualSpending", label: tr("Spesa annua"), baseline: plan.spending, format: (v) => money(v, currency), missingHint: tr("servono almeno 3 mesi di movimenti nel periodo scelto") },
    { field: "expectedReturn", label: tr("Rendimento reale"), term: "rendimento-reale", baseline: assumptions.expectedReturn, format: (v) => pct(v), missingHint: "" },
    { field: "withdrawalRate", label: tr("Tasso di prelievo"), term: "tasso-prelievo", baseline: assumptions.withdrawalRate, format: (v) => pct(v), missingHint: "" },
  ];
  const active = hasScenario(overrides);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => {
          const spec = scenarioSlider(row.field, row.baseline);
          const value = overrides[row.field] ?? row.baseline;
          const labelId = `scenario-${row.field}`;
          const delta = overrides[row.field] !== undefined ? deltaText(plan.yearsToFire, yearsToFireWith(plan, assumptions, { [row.field]: overrides[row.field] })) : null;
          return (
            <div key={row.field} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span id={labelId} className="text-sm text-muted-foreground">
                  {row.term ? <Term id={row.term}>{tr(row.label)}</Term> : row.label}
                </span>
                <span className="font-heading text-base font-medium tabular-nums text-foreground">{value !== null ? row.format(value) : "—"}</span>
              </div>
              {spec && value !== null ? (
                <Slider
                  aria-labelledby={labelId}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={Math.min(Math.max(value, spec.min), spec.max)}
                  onValueChange={(next) => {
                    const v = Array.isArray(next) ? next[0] : next;
                    onChange(row.field, Math.abs(v - (row.baseline ?? v)) < spec.step / 2 ? undefined : v);
                  }}
                  onValueCommitted={() => onCommit(row.field)}
                />
              ) : (
                <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  {tr("Non nota")}<InfoHint label={tr("Perché manca")}>{tr("Per calcolarla")}{row.missingHint}{tr(". Puoi scriverla in «Tutte le ipotesi».")}</InfoHint>
                </p>
              )}
              {overrides[row.field] !== undefined ? (
                <p className={`min-h-4 text-xs ${delta ? "font-semibold text-pos" : "text-muted-foreground"}`}>{delta ?? tr("stesso traguardo")}</p>
              ) : value === null || !spec ? null : row.field === "expectedReturn" ? (
                <ReturnSourceNote info={returnInfo} value={value} currency={currency} period={props.period} saving={saving} onUseHistory={onUseHistoryReturn} />
              ) : row.field === "annualSavings" || row.field === "annualSpending" ? (
                <CashflowSourceNote
                  source={row.field === "annualSavings" ? plan.savingsSource : plan.spendingSource}
                  dataValue={row.field === "annualSavings" ? props.dataFigures.savings : props.dataFigures.spending}
                  periodPhrase={props.periodPhrase}
                  coveredMonths={props.coveredMonths}
                  periodMonths={props.periodMonths}
                  currency={currency}
                  saving={saving}
                  onUseData={() => props.onUseData(row.field as "annualSavings" | "annualSpending")}
                />
              ) : (
                <p className="min-h-4 text-xs text-muted-foreground">{tr("ipotesi di partenza")}</p>
              )}
              {overrides[row.field] !== undefined && row.field === "expectedReturn" && (overrides.expectedReturn ?? 0) > HIGH_RETURN_WARNING ? (
                <p className="text-xs text-risk-3" role="note">{tr("Stima ottimistica")}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>{tr("Altre ipotesi: volatilità")}{" "}{pct(assumptions.volatility, 0)}{tr(", inflazione")}{" "}{pct(assumptions.inflation, 0)}{tr(", imposte")}{" "}{assumptions.includeLatentTax ? tr("contate") : tr("non contate")}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenAllAssumptions}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />{tr("Tutte le ipotesi")}</Button>
        {active ? (
          <span className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden="true" />{tr("Ripristina")}</Button>
            <Button type="button" size="sm" onClick={onSave} disabled={saving}>
              {saving ? tr("Salvo…") : tr("Salva queste ipotesi")}
            </Button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
