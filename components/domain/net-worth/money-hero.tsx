"use client";

/**
 * Importo in evidenza con i decimali attenuati ("30.673" grande, ",12 €" tenue). Quando il valore cambia (periodo,
 * filtro, cursore) le cifre scorrono. Con gli importi nascosti mostra la maschera.
 */

import { AnimatedNumber } from "@/components/motion";
import { AMOUNT_MASK, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MoneyHeroProps {
  value: number;
  currency: string;
  locale?: string;
  className?: string;
}

/** Divide l'importo formattato in parte intera (con separatori) e coda (decimali e valuta). */
export function splitMoney(value: number, currency: string, locale = "it-IT"): { main: string; tail: string } {
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(value);
  const decimalIndex = parts.findIndex((part) => part.type === "decimal");
  if (decimalIndex < 0) return { main: parts.map((p) => p.value).join(""), tail: "" };
  const head = parts.slice(0, decimalIndex);
  const tail = parts.slice(decimalIndex);
  return { main: head.map((p) => p.value).join(""), tail: tail.map((p) => p.value).join("") };
}

export function MoneyHero({ value, currency, locale = "it-IT", className }: MoneyHeroProps) {
  if (formatCurrency(0, currency) === AMOUNT_MASK) return <p className={cn("font-heading font-medium", className)}>{AMOUNT_MASK}</p>;
  return (
    <p className={cn("font-heading font-medium tabular-nums text-foreground", className)}>
      <AnimatedNumber value={value} format={{ style: "currency", currency }} locales={locale} mutedTail />
    </p>
  );
}
