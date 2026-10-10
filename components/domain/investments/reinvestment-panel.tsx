"use client";

/**
 * Controllo compatto «Costi e imposte»: un pulsante accanto al selettore del periodo che apre un popover con i due
 * interruttori della simulazione «e se costi e imposte fossero rimasti investiti?». Chiuso occupa una riga sola; quando la
 * simulazione è attiva il pulsante lo dice (stato esposto anche a chi usa lo screen reader) e il riepilogo resta sotto
 * l'importo del Portafoglio.
 */

import { SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { reinvestmentEffects, type CostImpact } from "@/lib/investments/cost-impact";
import { cn } from "@/lib/utils";

export interface ReinvestmentControlProps {
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
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {paidText}
          {effect > 0 ? <> Rimasti investiti, oggi varresti <span className="tabular-nums text-foreground">{money(effect)}</span> in più.</> : null}
        </span>
      </span>
    </label>
  );
}

/** Pulsante «Costi e imposte» con popover dei due interruttori «Rimetti i costi» e «Rimetti le imposte». */
export function ReinvestmentControl({ impact, currency, includeFees, includeTaxes, onIncludeFeesChange, onIncludeTaxesChange }: ReinvestmentControlProps) {
  const money = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const effects = reinvestmentEffects(impact);
  const disabled = !impact.available;
  const activeCount = Number(!includeFees) + Number(!includeTaxes);
  const simulating = activeCount > 0;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 gap-1.5 rounded-full px-3 text-muted-foreground", simulating && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15")}
            aria-label={simulating ? `Costi e imposte: simulazione attiva su ${activeCount} di 2` : "Costi e imposte: simulazione spenta"}
          />
        }
      >
        <SlidersHorizontalIcon className="size-3.5" aria-hidden="true" />
        <span>Costi e imposte</span>
        {simulating ? <span className="tabular-nums" aria-hidden="true">· {activeCount}</span> : null}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[22rem] max-w-[calc(100vw-2rem)] gap-3 rounded-2xl p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">E se costi e imposte fossero rimasti investiti?</h3>
          <p className="text-sm text-muted-foreground">Ogni importo pagato torna nel portafoglio il giorno in cui l&apos;hai versato e rende come il resto. Non cambia le tue operazioni.</p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
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
      </PopoverContent>
    </Popover>
  );
}
