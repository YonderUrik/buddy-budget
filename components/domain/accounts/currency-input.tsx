"use client";

/** Input valuta sempre formattato: simbolo statico + NumericFormat per la parte numerica. */

import * as React from "react";
import { NumericFormat } from "react-number-format";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/format";

export interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  currency: string;
  className?: string;
  "aria-label"?: string;
}

export function CurrencyInput({
  value,
  onChange,
  onBlur,
  currency,
  className,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="flex items-center gap-1">
      <span className="shrink-0 select-none text-xs text-muted-foreground">
        {symbol}
      </span>
      <NumericFormat
        value={value ?? ""}
        onValueChange={({ floatValue }) => onChange(floatValue ?? null)}
        onBlur={onBlur}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        allowNegative
        className={cn(
          "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
          className
        )}
        aria-label={ariaLabel}
      />
    </div>
  );
}
