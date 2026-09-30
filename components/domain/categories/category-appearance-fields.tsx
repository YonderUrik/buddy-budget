"use client";

/** Selettori inline di colore e icona di una categoria (usati nel pannello di dettaglio). */

import { cn } from "@/lib/utils";
import { COLOR_DOT } from "@/components/domain/shared/color-swatches";
import { CATEGORY_ICONS } from "@/lib/validation/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
import { ICON_MAP } from "./category-avatar";

export interface CategoryAppearanceFieldsProps {
  value: { color: CategoryColor; icon: CategoryIcon };
  onChange: (value: { color: CategoryColor; icon: CategoryIcon }) => void;
}

export function CategoryAppearanceFields({ value, onChange }: CategoryAppearanceFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-muted-foreground">Colore</legend>
        <div className="flex flex-wrap gap-2">
          {SWATCH_BASE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...value, color })}
              className={cn(
                "size-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                COLOR_DOT[color],
                value.color === color && "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
              )}
              aria-label={color}
              aria-pressed={value.color === color}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-muted-foreground">Icona</legend>
        <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto pr-1">
          {CATEGORY_ICONS.map((icon) => {
            const Icon = ICON_MAP[icon];
            return (
              <button
                key={icon}
                type="button"
                onClick={() => onChange({ ...value, icon })}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  value.icon === icon && "bg-accent text-accent-foreground"
                )}
                aria-label={icon}
                aria-pressed={value.icon === icon}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
