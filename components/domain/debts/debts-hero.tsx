/** Testata della panoramica Debiti, come in Panoramica: importo grande con i decimali attenuati e, sotto, una frase di contesto. */

import { MoneyHero } from "@/components/domain/net-worth";
import { formatMonthYear } from "./debts-format";

export interface DebtsHeroProps {
  /** Debito residuo totale. */
  totalDebt: number;
  currency: string;
  /** Finanziamenti ancora aperti. */
  openCount: number;
  /** Data (ISO) in cui l'ultimo debito si chiude al ritmo di oggi; assente se non ce ne sono di aperti. */
  freeDate?: string;
}

export function DebtsHero({ totalDebt, currency, openCount, freeDate }: DebtsHeroProps) {
  return (
    <section aria-label="Debito totale" className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">Ancora da restituire</p>
      <MoneyHero value={totalDebt} currency={currency} className="text-5xl" />
      <p className="text-sm text-muted-foreground">
        {openCount === 0
          ? "Nessun finanziamento aperto"
          : `${openCount === 1 ? "un finanziamento" : `${openCount} finanziamenti`} · liberi da debiti a ${freeDate ? formatMonthYear(freeDate) : "—"}`}
      </p>
    </section>
  );
}
