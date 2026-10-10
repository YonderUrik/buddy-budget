"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Palette, Sun } from "lucide-react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

/** Scelta del tema: i valori sono quelli di `next-themes`. */
export type ThemeChoice = "light" | "dark" | "system";

const THEME_CHOICES = [
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const satisfies readonly { value: ThemeChoice; label: string; icon: React.ElementType }[];

/** Store vuoto: distingue il render server (false) da quello client (true), il tema si conosce solo sul client. */
const subscribeNoop = () => () => {};

export interface ThemeSubmenuProps {
  /** Chiamata dopo ogni cambio di tema (es. per le statistiche d'uso). */
  onChange?: (choice: ThemeChoice) => void;
}

/**
 * Voce «Tema» da mettere dentro un `DropdownMenuContent`: apre un sottomenu con Chiaro / Scuro / Sistema
 * (radio, la scelta attuale è esposta ai lettori di schermo) e mostra la scelta corrente a destra della voce.
 * «Sistema» segue l'impostazione del dispositivo; la persistenza è di `next-themes`.
 */
export function ThemeSubmenu({ onChange }: ThemeSubmenuProps) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);
  const current: ThemeChoice = mounted ? ((theme as ThemeChoice | undefined) ?? "system") : "system";
  const currentLabel = THEME_CHOICES.find((c) => c.value === current)?.label;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <Palette className="mr-2 size-4" aria-hidden="true" />
        <span>Tema</span>
        {mounted ? <span className="ml-auto pr-1 text-xs text-muted-foreground">{currentLabel}</span> : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-36">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            const choice = value as ThemeChoice;
            setTheme(choice);
            onChange?.(choice);
          }}
        >
          {THEME_CHOICES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="cursor-pointer">
              <Icon className="mr-2 size-4" aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
