"use client";

/**
 * Numero che scorre: quando `value` cambia, ruotano solo le cifre cambiate, nella direzione del cambio. Basato su
 * NumberFlow (MIT); formatta con `Intl.NumberFormat`, quindi valute, percentuali e anni usano le stesse opzioni di
 * sempre. Con il movimento ridotto il numero cambia senza animazione; il lettore di schermo legge il valore intero.
 */

import { useLocalization } from "@/lib/localization/provider";
import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "@/lib/utils";

export interface AnimatedNumberProps {
  value: number;
  /** Opzioni di `Intl.NumberFormat` (es. `{ style: "currency", currency: "EUR" }`). */
  format?: Format;
  locales?: Intl.LocalesArgument;
  /** Decimali e simbolo finale più piccoli e tenui, come negli importi in evidenza. */
  mutedTail?: boolean;
  className?: string;
}

/** Classi che rimpiccioliscono e attenuano decimali e valuta (parti `fraction`, `decimal` e `right` di NumberFlow). */
const MUTED_TAIL_CLASS =
  "[&::part(fraction)]:text-[0.55em] [&::part(fraction)]:text-muted-foreground [&::part(decimal)]:text-[0.55em] [&::part(decimal)]:text-muted-foreground [&::part(right)]:text-[0.55em] [&::part(right)]:text-muted-foreground";

export function AnimatedNumber({
  value,
  format,
  locales,
  mutedTail = false,
  className,
}: AnimatedNumberProps) {
  const { locale } = useLocalization();
  return (
    <NumberFlow
      value={value}
      format={format}
      locales={locales ?? locale}
      animated
      respectMotionPreference
      className={cn("tabular-nums", mutedTail && MUTED_TAIL_CLASS, className)}
    />
  );
}
