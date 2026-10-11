"use client";

/**
 * I quattro cursori «e se…» di Analitiche: provano risparmio, spesa, rendimento e tasso di prelievo senza salvare nulla.
 * Sotto ogni cursore, quanto cambia il traguardo rispetto alle ipotesi salvate.
 */

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { hasScenario, scenarioSlider, yearsToFireWith, type ScenarioField, type ScenarioOverrides } from "@/lib/analitiche/scenario";
import { formatYears, money, pct } from "./analytics-format";
import type { GlossaryId } from "./glossary";
import { Term } from "./term";

export interface ScenarioControlsProps {
  /** Ipotesi e piano salvati: da qui parte ogni cursore. */
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  currency: string;
  overrides: ScenarioOverrides;
  onChange: (field: ScenarioField, value: number | undefined) => void;
  /** Un cursore è stato lasciato (per le statistiche, non a ogni movimento). */
  onCommit: (field: ScenarioField) => void;
  onReset: () => void;
  onSave: () => void;
  onOpenAllAssumptions: () => void;
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

export function ScenarioControls({ assumptions, plan, currency, overrides, onChange, onCommit, onReset, onSave, onOpenAllAssumptions, saving }: ScenarioControlsProps) {
  const rows: Row[] = [
    { field: "annualSavings", label: "Risparmio annuo", baseline: plan.savings, format: (v) => money(v, currency), missingHint: "servono 3 mesi di movimenti" },
    { field: "annualSpending", label: "Spesa annua", baseline: plan.spending, format: (v) => money(v, currency), missingHint: "servono 3 mesi di movimenti" },
    { field: "expectedReturn", label: "Rendimento reale", term: "rendimento-reale", baseline: assumptions.expectedReturn, format: (v) => pct(v), missingHint: "" },
    { field: "withdrawalRate", label: "Tasso di prelievo", term: "tasso-prelievo", baseline: assumptions.withdrawalRate, format: (v) => pct(v), missingHint: "" },
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
                  {row.term ? <Term id={row.term}>{row.label}</Term> : row.label}
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
                <p className="text-xs text-muted-foreground">Cifra non nota: {row.missingHint}, oppure scrivila in «Tutte le ipotesi».</p>
              )}
              <p className={`min-h-4 text-xs ${delta ? "font-semibold text-pos" : "text-muted-foreground"}`}>
                {delta ?? (overrides[row.field] !== undefined ? "stesso traguardo" : value !== null && spec ? "ipotesi di partenza" : "")}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>
          Altre ipotesi: volatilità {pct(assumptions.volatility, 0)}, inflazione {pct(assumptions.inflation, 0)}, imposte {assumptions.includeLatentTax ? "contate" : "non contate"}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenAllAssumptions}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Tutte le ipotesi
        </Button>
        {active ? (
          <span className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Ripristina
            </Button>
            <Button type="button" size="sm" onClick={onSave} disabled={saving}>
              {saving ? "Salvo…" : "Salva queste ipotesi"}
            </Button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
