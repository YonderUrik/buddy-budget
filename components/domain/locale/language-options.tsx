"use client";

import { Check } from "lucide-react";

import { LANGUAGE_LOCALES, LANGUAGE_NAMES, LANGUAGES, type Language } from "@/lib/localization/config";
import { cn } from "@/lib/utils";
import { Flag } from "./flag";
import { LANGUAGE_FLAGS } from "./flags";

/** Sample amount shown under each language, so the user sees how numbers will look. */
const SAMPLE_AMOUNT = 1234.56;

export interface LanguageOptionsProps {
  value: Language;
  onSelect: (language: Language) => void;
  /** Languages that can be chosen; the others are shown greyed out with `unavailableHint`. */
  available?: readonly Language[];
  /** Line shown under a language that cannot be chosen (already translated by the caller). */
  unavailableHint?: (language: Language) => string;
  /** Currency of the sample amount. */
  currency?: string;
  /** Accessible name of the list. */
  label: string;
}

/** One row per language: flag, name in its own language and a preview of today's date and an amount in that language. */
export function LanguageOptions({ value, onSelect, available = LANGUAGES, unavailableHint, currency = "EUR", label }: LanguageOptionsProps) {
  const today = new Date();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
      {LANGUAGES.map((language) => {
        const selected = language === value;
        const enabled = available.includes(language);
        const locale = LANGUAGE_LOCALES[language];
        const sample = enabled
          ? `${new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(today)} · ${new Intl.NumberFormat(locale, { style: "currency", currency }).format(SAMPLE_AMOUNT)}`
          : unavailableHint?.(language);
        return (
          <button
            key={language}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!enabled}
            lang={language}
            onClick={() => !selected && onSelect(language)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "bg-primary/10" : "enabled:hover:bg-muted",
            )}
          >
            <Flag code={LANGUAGE_FLAGS[language]} className="h-4 w-6" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-foreground">{LANGUAGE_NAMES[language]}</span>
              {sample ? <span className="truncate text-xs text-muted-foreground">{sample}</span> : null}
            </span>
            {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
