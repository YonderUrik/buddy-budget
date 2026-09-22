"use client";

/** Scelta della valuta principale come gruppo di radio (tessere grandi), navigabile con le frecce. */

import * as React from "react";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/validation/currency";

export interface CurrencyPickerProps {
  value: SupportedCurrency;
  onChange: (value: SupportedCurrency) => void;
  disabled?: boolean;
}

export function CurrencyPicker({ value, onChange, disabled = false }: CurrencyPickerProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + SUPPORTED_CURRENCIES.length) % SUPPORTED_CURRENCIES.length;
    onChange(SUPPORTED_CURRENCIES[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Valuta principale" className="grid grid-cols-2 gap-3">
      {SUPPORTED_CURRENCIES.map((c, index) => {
        const isSelected = value === c.value;
        return (
          <button
            key={c.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(c.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              isSelected
                ? "border-primary bg-accent text-foreground ring-1 ring-primary"
                : "border-border bg-card text-foreground hover:bg-muted/60"
            )}
          >
            <span className={cn("font-heading text-2xl font-medium", isSelected && "text-primary")}>{c.symbol}</span>
            <span className="text-sm font-medium">{c.label}</span>
            <span className="text-xs text-text-3">{c.value}</span>
          </button>
        );
      })}
    </div>
  );
}
