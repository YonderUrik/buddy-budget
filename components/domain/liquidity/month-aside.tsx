/** Colonna "Il mese" di Movimenti: entrate, spese, avanzo, da sistemare e gruppi di spesa. Solo presentazione. */

import { AlertTriangleIcon, CalendarDaysIcon, PieChartIcon } from "lucide-react";
import Link from "next/link";
import { EXPENSE_GROUPS, EXPENSE_GROUP_KEYS } from "@/lib/categories/groups";
import { formatCurrency } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionTitle } from "./section-title";
import { SoftRow } from "./soft-row";

export interface MonthAsideProps {
  income: number;
  spent: number;
  /** Spesa tipica a questo punto del mese (null senza storico). */
  typicalSoFar: number | null;
  /** Movimenti in attesa di una categoria. */
  toFix: number;
  /** Spesa del mese per gruppo (chiavi di `EXPENSE_GROUP_KEYS`). */
  groups: Record<(typeof EXPENSE_GROUP_KEYS)[number], number>;
  currency: string;
  analysisHref: string;
  fixHref: string;
}

export function MonthAside({ income, spent, typicalSoFar, toFix, groups, currency, analysisHref, fixHref }: MonthAsideProps) {
  const money = (n: number) => formatCurrency(n, currency);
  const left = income - spent;
  const groupMax = Math.max(...EXPENSE_GROUP_KEYS.map((key) => groups[key]), 1);
  return (
    <aside className="flex flex-col gap-8" aria-label="Il mese">
      <section>
        <SectionTitle icon={CalendarDaysIcon} title="Il mese" color="var(--swatch-teal)" href={analysisHref} linkLabel="Analisi" />
        <div className="flex flex-col gap-1.5">
          <SoftRow title="Entrate" end={<span className="font-heading font-semibold tabular-nums text-pos">+{money(income)}</span>} />
          <SoftRow title="Spese" end={<span className="font-heading font-semibold tabular-nums text-neg">−{money(spent)}</span>} />
          <SoftRow
            title="Avanzo finora"
            hint={typicalSoFar !== null ? `Di solito a questo punto: ${money(typicalSoFar)} di spese` : undefined}
            end={<span className={cn("font-heading font-semibold tabular-nums", left >= 0 ? "text-pos" : "text-neg")}>{left >= 0 ? "+" : "−"}{money(Math.abs(left))}</span>}
          />
        </div>
      </section>
      {toFix > 0 && (
        <section>
          <SectionTitle icon={AlertTriangleIcon} title="Da sistemare" color="var(--neg)" />
          <SoftRow
            title={`${toFix} ${toFix === 1 ? "movimento" : "movimenti"}`}
            hint="Senza categoria: sistemali a gruppi, con le proposte"
            end={<Link href={fixHref} className={cn(buttonVariants(), "h-11 shrink-0")}>Categorizza</Link>}
          />
        </section>
      )}
      <section>
        <SectionTitle icon={PieChartIcon} title="Gruppi di spesa" color="var(--group-saltuaria)" />
        <ul className="flex flex-col gap-3.5">
          {EXPENSE_GROUP_KEYS.map((key) => (
            <li key={key}>
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{EXPENSE_GROUPS[key].label}</span>
                <span className="font-mono tabular-nums">{money(groups[key])}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div className="h-full rounded-full" style={{ width: `${(groups[key] / groupMax) * 100}%`, backgroundColor: EXPENSE_GROUPS[key].colorVar }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
