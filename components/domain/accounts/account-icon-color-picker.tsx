"use client";

/** Popover per scegliere colore e icona di un conto. Click sull'avatar apre il picker. */

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { ACCOUNT_ICONS } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
import { ICON_MAP } from "./account-avatar";
import { COLOR_DOT } from "@/components/domain/shared/color-swatches";

/** Nomi italiani dei colori base, letti dagli screen reader al posto dello slug. */
const COLOR_NAMES: Record<string, string> = {
  slate: "grigio", blue: "blu", green: "verde", yellow: "giallo", purple: "viola", orange: "arancione", red: "rosso", teal: "verde acqua",
  pink: "rosa", indigo: "indaco", cyan: "azzurro", lime: "lime", amber: "ambra", rose: "rosa scuro", violet: "violetto", emerald: "smeraldo",
};

export interface AccountIconColorPickerProps {
  value: { color: AccountColor; icon: AccountIcon };
  onChange: (value: { color: AccountColor; icon: AccountIcon }) => void;
  children: React.ReactNode;
}

export function AccountIconColorPicker({
  value,
  onChange,
  children,
}: AccountIconColorPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-[60]">
          <Popover.Popup className="z-[60] w-72 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Colore
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {SWATCH_BASE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ ...value, color })}
                  className={cn(
                    "size-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    COLOR_DOT[color],
                    value.color === color &&
                      "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                  )}
                  aria-label={`Colore ${COLOR_NAMES[color] ?? color}`}
                  aria-pressed={value.color === color}
                />
              ))}
            </div>

            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Icona
            </p>
            <div className="grid grid-cols-6 gap-1">
              {ACCOUNT_ICONS.map((icon) => {
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
                    aria-label={`Icona ${icon}`}
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
