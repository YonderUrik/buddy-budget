"use client";

/** Popover per scegliere colore e icona di una categoria. Click sull'avatar apre il picker. */

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { COLOR_DOT } from "@/components/domain/shared/color-swatches";
import { CATEGORY_ICONS } from "@/lib/validation/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
import { ICON_MAP } from "./category-avatar";

export interface CategoryIconColorPickerProps {
  value: { color: CategoryColor; icon: CategoryIcon };
  onChange: (value: { color: CategoryColor; icon: CategoryIcon }) => void;
  children: React.ReactNode;
}

export function CategoryIconColorPicker({ value, onChange, children }: CategoryIconColorPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-[60]">
          <Popover.Popup className="z-[60] w-64 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Colore</p>
            <div className="mb-4 flex gap-1.5">
              {SWATCH_BASE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ ...value, color })}
                  className={cn(
                    "size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    COLOR_DOT[color],
                    value.color === color &&
                      "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                  )}
                  aria-label={color}
                  aria-pressed={value.color === color}
                />
              ))}
            </div>

            <p className="mb-2 text-xs font-medium text-muted-foreground">Icona</p>
            <div className="grid grid-cols-7 gap-1">
              {CATEGORY_ICONS.map((icon) => {
                const Icon = ICON_MAP[icon];
                return (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => onChange({ ...value, icon })}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
