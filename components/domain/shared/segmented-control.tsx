"use client";

/** Controllo segmentato (scelta singola tra poche opzioni, es. tab o toggle di tipo). Generico sul tipo del valore. */

import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Etichetta accessibile del gruppo. */
  ariaLabel: string;
  /** Occupa tutta la larghezza disponibile con segmenti di pari larghezza (utile su mobile). */
  stretch?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  stretch = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn(
        "items-center gap-1 rounded-lg bg-muted p-1",
        stretch ? "flex w-full" : "inline-flex w-fit",
        className
      )}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "min-h-9 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-8",
            stretch && "flex-1 px-2",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
