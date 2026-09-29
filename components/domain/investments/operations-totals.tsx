/** Totali di un insieme di operazioni: acquistato, venduto, proventi e guadagno (con la sua percentuale). */

import type { OperationTotals } from "@/lib/investments/operations-history";
import { formatCurrency } from "@/lib/format";
import { formatSignedPct, GainText } from "./gain-text";

export interface OperationsTotalsProps {
  totals: OperationTotals;
  currency: string;
}

export function OperationsTotals({ totals, currency }: OperationsTotalsProps) {
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const items = [
    { label: "Acquistato", value: format(totals.bought) },
    { label: "Venduto", value: format(totals.sold) },
    { label: "Dividendi e cedole", value: format(totals.income) },
  ];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="font-heading text-lg font-medium tabular-nums text-foreground">{item.value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-muted-foreground">Guadagno</dt>
          <dd className="font-heading text-lg font-medium">
            <GainText gain={totals.gain} currency={currency} />
          </dd>
          {totals.gainPct !== null ? (
            <dd className="text-xs tabular-nums text-muted-foreground">{formatSignedPct(totals.gainPct)} sul costo</dd>
          ) : null}
        </div>
      </dl>
      {totals.unpricedCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {totals.unpricedCount === 1
            ? "1 acquisto senza prezzo di oggi è escluso dal guadagno."
            : `${totals.unpricedCount} acquisti senza prezzo di oggi sono esclusi dal guadagno.`}
        </p>
      ) : null}
    </div>
  );
}
