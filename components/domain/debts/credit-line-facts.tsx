/** Le cifre di una linea di credito: tasso in vigore, interessi maturati e previsti, costo a saldo attuale, medie. */

import type { CreditLineView } from "@/lib/debts/view";
import { formatCurrency, formatDateWithYear } from "@/lib/format";

export interface CreditLineFactsProps {
  line: CreditLineView;
  currency: string;
}

const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

export function CreditLineFacts({ line, currency }: CreditLineFactsProps) {
  const p = line.plan;
  const money = (value: number) => formatCurrency(value, currency);
  const facts = [
    {
      label: line.indexLabel ? `Tasso (${line.indexLabel} + spread)` : "Tasso in vigore",
      value: percent(p.currentRate),
      hint: p.currentRate === p.indexRate ? undefined : `indice ${percent(p.indexRate)} + spread ${percent(line.spread)}`,
    },
    { label: "Maturato dall'ultimo addebito", value: money(p.accruedSinceLastCharge), hint: `prossimo addebito ${formatDateWithYear(p.nextChargeDate)}` },
    { label: "Stima del periodo", value: money(p.projectedPeriodInterest), hint: "a saldo e tasso di oggi" },
    { label: "Costo al mese", value: money(p.monthlyCostAtCurrent), hint: `${formatCurrency(p.yearlyCostAtCurrent, currency, { maximumFractionDigits: 0 })} l'anno` },
    { label: "Interessi finora", value: money(p.interestToDate), hint: p.feesPaid > 0 ? `più ${money(p.feesPaid)} di spese` : undefined },
    { label: "Utilizzo medio", value: formatCurrency(p.averageUsed, currency, { maximumFractionDigits: 0 }), hint: `massimo ${formatCurrency(p.peakUsed, currency, { maximumFractionDigits: 0 })}` },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-lg bg-muted/50 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{fact.label}</dt>
          <dd className="font-heading text-base font-medium tabular-nums text-foreground">{fact.value}</dd>
          {fact.hint ? <p className="text-[11px] text-muted-foreground">{fact.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}
