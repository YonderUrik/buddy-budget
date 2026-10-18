"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Cosa vuoi tenere sotto controllo?»: tiles to toggle (several at once, none is fine). Used at the end of onboarding
 * and in the checklist's «Cambia» sheet. Presentational: value and change come from props.
 */

import { CheckIcon, CreditCard, TrendingUp, Umbrella, Wallet, type LucideIcon } from "lucide-react";
import { START_FOCUS_OPTIONS, type StartFocus, type StartFocusOption } from "@/lib/start";
import { cn } from "@/lib/utils";

/** Same icons as the sidebar sections each answer leads to. */
const FOCUS_ICONS: Record<StartFocus, LucideIcon> = { spese: Wallet, investimenti: TrendingUp, debiti: CreditCard, pensione: Umbrella };

export interface FocusPickerProps {
  value: readonly StartFocus[];
  onChange: (value: StartFocus[]) => void;
  /** Answers on offer (default: all; the caller drops the pension one where that section is hidden). */
  options?: readonly StartFocusOption[];
  disabled?: boolean;
  className?: string;
}

export function FocusPicker({ value, onChange, options = START_FOCUS_OPTIONS, disabled, className }: FocusPickerProps) {
  const { t: tr } = useLocalization();
  const toggle = (id: StartFocus) => onChange(value.includes(id) ? value.filter((f) => f !== id) : [...value, id]);
  return (
    <div role="group" aria-label={tr("Cosa vuoi tenere sotto controllo?")} className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {options.map((option) => {
        const Icon = FOCUS_ICONS[option.id];
        const selected = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(option.id)}
            className={cn(
              "flex min-h-11 items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
              selected ? "border-primary bg-accent ring-1 ring-primary" : "border-border bg-card hover:bg-muted/60"
            )}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", selected ? "text-primary" : "text-text-2")} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{tr(option.title)}</span>
              <span className="block text-sm text-text-2">{tr(option.description)}</span>
            </span>
            <span
              className={cn("grid size-6 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}
              aria-hidden="true"
            >
              <CheckIcon className="size-3.5" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

