/** Blocco "Dove va ogni euro" (mese corrente): una riga per ciascuna voce restituita da `computeWhereItGoes` (fisse/variabili/non classificato/risparmio), importo e quota % sul totale entrate del mese — nessuna assunzione sul numero di voci. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WhereItGoesEntry } from "@/lib/calc/cashflow";

export interface WhereItGoesBreakdownProps {
  entries: WhereItGoesEntry[];
  currency: string;
}

export function WhereItGoesBreakdown({ entries, currency }: WhereItGoesBreakdownProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dove va ogni euro
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{entry.label}</p>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  entry.key === "risparmio" && entry.amount < 0 ? "text-neg" : "text-foreground"
                )}
              >
                {formatCurrency(entry.amount, currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.quotaPct === null ? "—" : `${Math.round(entry.quotaPct)}%`}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
