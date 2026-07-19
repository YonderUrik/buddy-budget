"use client";

/** Popover per scegliere colore e icona di un conto. Click sull'avatar apre il picker. */

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { ACCOUNT_COLORS, ACCOUNT_ICONS } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { ICON_MAP } from "./account-avatar";
import { COLOR_DOT } from "@/components/domain/shared/color-swatches";

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
          <Popover.Popup className="z-[60] w-64 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Colore
            </p>
            <div className="mb-4 flex gap-1.5">
              {ACCOUNT_COLORS.map((color) => (
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

            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Icona
            </p>
            <div className="grid grid-cols-7 gap-1">
              {ACCOUNT_ICONS.map((icon) => {
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
