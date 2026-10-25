"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Testata della panoramica Debiti, come in Panoramica: importo grande con i decimali attenuati e, sotto, una frase di contesto. */

import { MoneyHero } from "@/components/domain/net-worth";
import { localizedDebtFormats } from "./debts-format";

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
  const { formatMonthYear } = localizedDebtFormats(useLocalization().language);

  const { t: tr } = useLocalization();
  return (
    <section aria-label={tr("Debito totale")} data-page-block="hero" className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{tr("Ancora da restituire")}</p>
      <MoneyHero value={totalDebt} currency={currency} className="text-5xl" />
      <p className="text-sm text-muted-foreground">
        {openCount === 0
          ? tr("Nessun finanziamento aperto")
          : tr("{0} · liberi da debiti a {1}", {0: openCount === 1 ? tr("un finanziamento") : tr("{0} finanziamenti", {0: openCount}), 1: freeDate ? formatMonthYear(freeDate) : "—"})}
      </p>
    </section>
  );
}
