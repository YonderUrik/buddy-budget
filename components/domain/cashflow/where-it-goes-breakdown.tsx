/** Blocco "Dove va ogni euro" (mese corrente): una riga per ciascuna voce di `computeWhereItGoes` (gruppi di spesa, non classificato, avanzo) con pallino colore del gruppo, importo e quota % sulle entrate del mese — nessuna assunzione sul numero di voci. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GROUP_DISPLAY, isExpenseGroup } from "@/lib/categories/groups";
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
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  isExpenseGroup(entry.key) ? GROUP_DISPLAY[entry.key].dotClassName : "bg-transparent"
                )}
              />
              <p className="text-sm font-medium text-foreground">{entry.label}</p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  entry.key === "avanzo" && entry.amount < 0 ? "text-neg" : "text-foreground"
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
