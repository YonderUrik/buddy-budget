"use client";

/**
 * "Dividi" di un movimento: quanta parte è davvero tua. Scorciatoie grandi (tutta, metà, un terzo, un quarto), un importo
 * a mano e un cursore; sotto il risultato in chiaro. Si salva solo la parte esclusa dal conteggio (come prima).
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { clampOwnShare, excludedFromOwnShare, matchPreset, ownShareForPreset, SPLIT_PRESETS } from "@/lib/liquidity/split";
import { cn } from "@/lib/utils";

export interface SplitPanelProps {
  title: string;
  /** Importo pieno del movimento, positivo. */
  total: number;
  /** Parte oggi esclusa dal conteggio, positiva. */
  excluded: number;
  currency: string;
  isIncome: boolean;
  saving?: boolean;
  /** Salva la nuova parte esclusa (positiva, 0 = nessuna divisione). */
  onSave: (excluded: number) => void;
  onCancel: () => void;
}

export function SplitPanel({ title, total, excluded, currency, isIncome, saving = false, onSave, onCancel }: SplitPanelProps) {
  const [own, setOwn] = React.useState(() => clampOwnShare(total - excluded, total));
  const [typed, setTyped] = React.useState(() => own.toFixed(2));
  const activePreset = matchPreset(total, own);
  const ownLabel = isIncome ? "Conta come tua entrata" : "Conta come tua spesa";
  const outLabel = "Esclusa dal conteggio";

  function set(next: number) {
    const clamped = clampOwnShare(next, total);
    setOwn(clamped);
    setTyped(clamped.toFixed(2));
  }

  return (
    <div className="mx-1 my-2 rounded-2xl bg-foreground/[0.04] p-4 sm:p-5">
      <p className="text-sm font-semibold text-text-2">Dividi · {title}</p>
      <p className="font-heading text-3xl font-medium tabular-nums">{formatCurrency(total, currency)}</p>
      <p className="mt-1 text-sm text-text-2">{isIncome ? "Quanto di questa entrata è davvero tuo?" : "Quanto di questa spesa è davvero tuo?"}</p>
      <div role="group" aria-label="Scorciatoie" className="mt-3 flex flex-wrap gap-2">
        {SPLIT_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            aria-pressed={activePreset?.key === preset.key}
            onClick={() => set(ownShareForPreset(total, preset.parts))}
            className={cn(
              "min-h-11 rounded-xl border-[1.5px] px-4 text-sm font-semibold transition-colors",
              activePreset?.key === preset.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
            )}
          >
            {preset.label}
          </button>
        ))}
        <label className="flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-border bg-card px-3 text-sm font-semibold">
          Importo
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={total}
            step={0.01}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => set(Number(typed))}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            aria-label={ownLabel}
            className="w-24 bg-transparent text-right tabular-nums outline-none"
          />
        </label>
      </div>
      <Slider
        className="my-4"
        value={[own]}
        min={0}
        max={total}
        step={0.01}
        aria-label={ownLabel}
        onValueChange={(value) => set(Array.isArray(value) ? value[0] : value)}
      />
      <div className="flex justify-between gap-3">
        <div>
          <p className="text-sm text-text-2">{ownLabel}</p>
          <p className="font-heading text-2xl font-semibold tabular-nums text-pos">{formatCurrency(own, currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-2">{outLabel}</p>
          <p className="font-heading text-2xl font-semibold tabular-nums">{formatCurrency(excludedFromOwnShare(total, own), currency)}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="h-11 flex-1" disabled={saving} onClick={() => onSave(excludedFromOwnShare(total, own))}>
          {saving ? "Salvataggio…" : "Salva"}
        </Button>
        <Button variant="outline" className="h-11" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
