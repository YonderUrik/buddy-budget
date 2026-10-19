"use client";
import { useLocalization } from "@/lib/localization/provider";
import { localizedFormats } from "@/lib/localization/format";


/**
 * Importo in evidenza con i decimali attenuati ("30.673" grande, ",12 €" tenue). Quando il valore cambia (periodo,
 * filtro, cursore) le cifre scorrono. Con gli importi nascosti mostra la maschera.
 */

import { AnimatedNumber } from "@/components/motion";
import { AMOUNT_MASK } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MoneyHeroProps {
  value: number;
  currency: string;
  locale?: string;
  className?: string;
}

export function MoneyHero({ value, currency, locale, className }: MoneyHeroProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  if (formatCurrency(0, currency) === AMOUNT_MASK) return <p className={cn("font-heading font-medium", className)}>{AMOUNT_MASK}</p>;
  return (
    <p className={cn("font-heading font-medium tabular-nums text-foreground", className)}>
      <AnimatedNumber value={value} format={{ style: "currency", currency }} locales={locale ?? formattingLocale} mutedTail />
    </p>
  );
}
