"use client";

/** Select del tipo categoria (quattro gruppi di spesa + Entrata), condiviso da riga categoria e form di creazione. */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_TYPES, CATEGORY_TYPE_LABELS, type CategoryType } from "@/lib/categories/groups";

export interface CategoryTypeSelectProps {
  value: CategoryType;
  onChange: (next: CategoryType) => void;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
}

export function CategoryTypeSelect({ value, onChange, size = "default", className, ...rest }: CategoryTypeSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next as CategoryType)}>
      <SelectTrigger size={size} className={className} aria-label={rest["aria-label"] ?? "Tipo categoria"}>
        <SelectValue>{(current: CategoryType) => CATEGORY_TYPE_LABELS[current]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CATEGORY_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {CATEGORY_TYPE_LABELS[type]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
