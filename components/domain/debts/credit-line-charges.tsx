/** Addebiti degli interessi dei periodi conclusi: reali (registrati dall'utente) o stimati, con le commissioni del periodo. */

import type { CreditLineCharge } from "@/lib/calc/credit-line";
import { formatCurrency, formatShortDate } from "@/lib/format";

export interface CreditLineChargesProps {
  charges: CreditLineCharge[];
  currency: string;
}

/** Quanti addebiti mostrare (i più recenti). */
export const CHARGES_VISIBLE = 12;

export function CreditLineCharges({ charges, currency }: CreditLineChargesProps) {
  if (charges.length === 0) return <p className="text-sm text-muted-foreground">Il primo addebito arriverà alla fine del periodo in corso.</p>;
  const recent = [...charges].reverse().slice(0, CHARGES_VISIBLE);
  return (
    <ul className="divide-y">
      {recent.map((charge) => (
        <li key={charge.periodEnd} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              {formatShortDate(charge.periodStart)} – {formatShortDate(charge.periodEnd)}
            </p>
            <p className="text-xs text-muted-foreground">
              {charge.actual ? "Addebito reale" : "Stima"}
              {charge.fees > 0 ? ` · spese ${formatCurrency(charge.fees, currency)}` : ""}
            </p>
          </div>
          <p className="font-heading text-base font-medium tabular-nums text-foreground">{formatCurrency(charge.charged, currency)}</p>
        </li>
      ))}
    </ul>
  );
}
