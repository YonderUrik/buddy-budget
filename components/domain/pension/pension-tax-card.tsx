"use client";

/** Scheda "quando scende l'aliquota": la linea del tempo con il chip trascinabile per simulare, e cosa cambierebbe nel netto. */

import { Button } from "@/components/ui/button";
import { PercentIcon } from "lucide-react";
import type { WithdrawalScenario } from "@/lib/calc/pension";
import { formatPercent, money } from "./pension-format";
import { PensionSection } from "./pension-section";
import { PensionTaxTimeline } from "./pension-tax-timeline";

export interface PensionTaxCardProps {
  adhesionDate: string;
  /** Anni di partecipazione mostrati (simulati o reali) e anni reali di oggi. */
  years: number;
  realYears: number;
  isSimulated: boolean;
  /** Stima "alla pensione" con gli anni mostrati e con quelli reali, per il riepilogo sotto la linea. */
  scenario?: WithdrawalScenario;
  baseline?: WithdrawalScenario;
  currency: string;
  onYearsChange?: (years: number) => void;
  onCommit?: () => void;
  onReset?: () => void;
}

export function PensionTaxCard({ adhesionDate, years, realYears, isSimulated, scenario, baseline, currency, onYearsChange, onCommit, onReset }: PensionTaxCardProps) {
  const adhesionYear = Number(adhesionDate.slice(0, 4));
  const delta = scenario && baseline ? scenario.netLow - baseline.netLow : null;
  return (
    <PensionSection
      icon={PercentIcon}
      title="Quando l'aliquota scende"
      color="var(--swatch-purple)"
      description="Sui contributi dal 2007 l'imposta in uscita è il 15%, ridotta di 0,30 punti per ogni anno oltre il quindicesimo di partecipazione, fino al 9%. Conta dalla prima adesione."
    >
      <div className="flex flex-col gap-4">
        <PensionTaxTimeline adhesionDate={adhesionDate} years={years} realYears={realYears} onYearsChange={onYearsChange} onCommit={onCommit} onReset={onReset} />
        {onYearsChange ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm" aria-live="polite">
            <p className="min-w-0 flex-1 text-foreground">
              {isSimulated ? (
                <>
                  <strong className="font-semibold">Simulazione</strong>: dopo {years} anni di adesione (nel {adhesionYear + years}) l&apos;aliquota sarebbe {formatPercent(scenario?.rate ?? 0)}
                  {scenario && delta !== null ? (
                    <>
                      , e alla pensione ti resterebbero almeno <strong className="font-semibold tabular-nums">{money(scenario.netLow, currency)}</strong> ({delta >= 0 ? "+" : "−"}{money(Math.abs(delta), currency)} rispetto a oggi).
                    </>
                  ) : (
                    "."
                  )}
                </>
              ) : (
                <span className="text-text-2">Trascina l&apos;aliquota lungo la linea (o usa le frecce) per vedere cosa cambierebbe nelle stime. Resta solo su questa pagina: non viene salvato nulla.</span>
              )}
            </p>
            {isSimulated ? (
              <Button type="button" variant="outline" size="sm" onClick={onReset}>
                Torna a oggi
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </PensionSection>
  );
}
