"use client";

/**
 * Group of a category as a grid of choices (a radio group): the four spending groups with their colour,
 * then Entrata and Trasferimenti. Two columns on the phone, three from `sm`, so no label wraps onto a second line.
 */

import { CheckIcon } from "lucide-react";
import { CATEGORY_TYPES, CATEGORY_TYPE_LABELS, EXPENSE_GROUPS, isExpenseGroup, type CategoryType } from "@/lib/categories/groups";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

export interface CategoryGroupPickerProps {
  value: CategoryType;
  onChange: (type: CategoryType) => void;
  /** Accessible name of the radio group. */
  ariaLabel: string;
}

/** Short labels where the full one would not fit a cell (the board keeps the long one). */
const SHORT_LABELS: Partial<Record<CategoryType, string>> = { trasferimento: "Trasferimenti" };

function dotClassName(type: CategoryType): string {
  if (isExpenseGroup(type)) return EXPENSE_GROUPS[type].dotClassName;
  return type === "entrata" ? "bg-pos" : "bg-text-3";
}

export function CategoryGroupPicker({ value, onChange, ariaLabel }: CategoryGroupPickerProps) {
  const { t: tr } = useLocalization();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CATEGORY_TYPES.map((type) => {
        const selected = type === value;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            title={tr(CATEGORY_TYPE_LABELS[type])}
            onClick={() => !selected && onChange(type)}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-full px-4 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              selected ? "bg-foreground font-semibold text-background" : "bg-foreground/[0.05] text-foreground hover:bg-foreground/[0.09]"
            )}
          >
            <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", dotClassName(type))} />
            <span className="min-w-0 flex-1 truncate">{tr(SHORT_LABELS[type] ?? CATEGORY_TYPE_LABELS[type])}</span>
            {selected && <CheckIcon className="size-4 shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
