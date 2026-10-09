"use client";

/**
 * Due interruttori «E se non avessi pagato…»: simulano il portafoglio con costi e/o imposte rimasti investiti.
 * Sotto ogni interruttore c'è quanto hai pagato e quanto varresti oggi in più, così l'effetto è chiaro prima di attivarlo.
 */

import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { reinvestmentEffects, type CostImpact } from "@/lib/investments/cost-impact";
import { cn } from "@/lib/utils";

export interface ReinvestmentPanelProps {
  impact: CostImpact;
  currency: string;
  /** `true` = costi/imposte restano pagati (valore registrato); `false` = simulati come reinvestiti. */
  includeFees: boolean;
  includeTaxes: boolean;
  onIncludeFeesChange?: (value: boolean) => void;
  onIncludeTaxesChange?: (value: boolean) => void;
}

interface RowProps {
  label: string;
  paidText: string;
  effect: number;
  active: boolean;
  disabled: boolean;
  currency: string;
  onChange?: (reinvest: boolean) => void;
}

function Row({ label, paidText, effect, active, disabled, currency, onChange }: RowProps) {
  const money = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  return (
    <label className={cn("flex items-start gap-3", disabled ? "opacity-60" : "cursor-pointer")}>
      <Switch size="sm" className="mt-0.5" checked={active} onCheckedChange={(checked) => onChange?.(checked)} disabled={disabled} />
      <span className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {paidText}
          {effect > 0 ? <> Se fossero rimasti investiti, oggi varresti <span className="tabular-nums text-foreground">{money(effect)}</span> in più.</> : null}
        </span>
        {active && effect > 0 ? <span className="font-medium tabular-nums text-pos">Nel totale e nel grafico: +{money(effect)}</span> : null}
      </span>
    </label>
  );
}

/** Riga di spiegazione + interruttori per «Reinvesti costi» e «Reinvesti imposte». */
export function ReinvestmentPanel({ impact, currency, includeFees, includeTaxes, onIncludeFeesChange, onIncludeTaxesChange }: ReinvestmentPanelProps) {
  const money = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const effects = reinvestmentEffects(impact);
  const disabled = !impact.available;
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">E se costi e imposte fossero rimasti investiti?</h3>
        <p className="text-sm text-muted-foreground">
          Simulazione: ogni importo pagato torna nel portafoglio il giorno in cui l&apos;hai versato e rende come il resto. Non cambia le tue operazioni.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Row
          label="Rimetti i costi nel portafoglio"
          paidText={`Commissioni e costi pagati: ${money(impact.fees)}.`}
          effect={effects.fees}
          active={!includeFees}
          disabled={disabled}
          currency={currency}
          onChange={(reinvest) => onIncludeFeesChange?.(!reinvest)}
        />
        <Row
          label="Rimetti le imposte nel portafoglio"
          paidText={`Imposte registrate e stimate sulle vendite: ${money(impact.taxes)}.`}
          effect={effects.taxes}
          active={!includeTaxes}
          disabled={disabled}
          currency={currency}
          onChange={(reinvest) => onIncludeTaxesChange?.(!reinvest)}
        />
      </div>
      {disabled ? <p className="text-sm text-muted-foreground">Non disponibile finché ogni strumento non ha un prezzo.</p> : null}
    </div>
  );
}
