"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** "Dove mettere il prossimo versamento": importo modificabile e acquisti suggeriti, ciascuno con "Registra". */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Instrument } from "@/lib/db/schema/investments";

import { suggestContribution, type AllocationAnalysis } from "@/lib/investments/allocation";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export interface ContributionSuggestionsProps {
  analysis: AllocationAnalysis;
  /** Importo iniziale (proposto all'apertura). */
  defaultAmount: number;
  instrumentsById: Map<string, Instrument>;
  currency: string;
  onRegister: (instrumentId: string, amount: number) => void;
}

export function ContributionSuggestions({ analysis, defaultAmount, instrumentsById, currency, onRegister }: ContributionSuggestionsProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const id = React.useId();
  const [text, setText] = React.useState(String(Math.round(defaultAmount)));
  const amount = Number(text.replace(",", ".")) || 0;
  const suggestions = React.useMemo(() => suggestContribution(analysis, amount), [analysis, amount]);
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3" aria-label={tr("Prossimo versamento")}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{tr("Se versi")}</label>
        <Input id={id} inputMode="decimal" className="h-8 w-28 text-right tabular-nums" value={text} onChange={(e) => setText(e.target.value)} />
        <span className="text-sm text-muted-foreground">{currency}{tr(", compra:")}</span>
      </div>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("Inserisci un importo per vedere dove metterlo.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <li key={s.instrumentId} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  <span className="font-medium tabular-nums">{formatCurrency(s.amount, currency, { maximumFractionDigits: 0 })}</span>{" "}{tr("di")}{" "}
                  {instrumentsById.get(s.instrumentId)?.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{tr("arriva al")}{" "}{pct(s.weightAfter)}{" "}{tr("(obiettivo")}{" "}{pct(s.targetWeight)})
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onRegister(s.instrumentId, s.amount)}>{tr("Registra")}</Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{tr("Solo acquisti: compra per primo ciò che è più sotto obiettivo, senza vendere niente.")}</p>
    </section>
  );
}
