/** Prossime scadenze dei finanziamenti aperti, la più vicina per prima; una rata già scaduta e non segnata è evidenziata. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DebtDueItem } from "@/lib/debts/view";
import { formatCurrency, formatDateWithYear } from "@/lib/format";

export interface DebtsNextDueCardProps {
  items: DebtDueItem[];
  currency: string;
}

const OVERDUE_LABEL = "Scaduta";

export function DebtsNextDueCard({ items, currency }: DebtsNextDueCardProps) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prossime rate</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => (
            <li key={`${item.debtId}-${item.date}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                <p className={item.overdue ? "text-xs text-neg" : "text-xs text-muted-foreground"}>
                  {item.overdue ? `${OVERDUE_LABEL} il ` : ""}
                  {formatDateWithYear(item.date)}
                </p>
              </div>
              <p className="font-heading text-base font-medium tabular-nums text-foreground">{formatCurrency(item.amount, currency)}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
