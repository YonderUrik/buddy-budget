/** "I tuoi debiti": una riga per finanziamento e linea di credito, con avanzamento; porta al dettaglio. */

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreditLineView, DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { formatMonthYear } from "./debts-format";
import { repaidShare } from "./debt-facts";

export interface DebtsListCardProps {
  debts: DebtView[];
  creditLines: CreditLineView[];
  currency: string;
  /** Debito totale (finanziamenti più utilizzato delle linee), mostrato in testa. */
  totalDebt: number;
}

const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

function Row({ href, name, detail, amount, share }: { href: string; name: string; detail: string; amount: string; share: number }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-lg py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(1, share) * 100}%` }} />
          </span>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </span>
        <span className="font-heading text-base font-medium tabular-nums text-foreground">{amount}</span>
        <ChevronRightIcon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function DebtsListCard({ debts, creditLines, currency, totalDebt }: DebtsListCardProps) {
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">I tuoi debiti</CardTitle>
        <p className="font-heading text-3xl font-medium tabular-nums text-foreground">{money(totalDebt)}</p>
        <p className="text-sm text-muted-foreground">ancora da restituire, tra finanziamenti e linee di credito</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {debts.map((debt) => (
            <Row
              key={debt.id}
              href={`/debiti/finanziamenti?id=${debt.id}`}
              name={debt.name}
              detail={debt.plan.totals.finished ? "Estinto" : `finisce a ${formatMonthYear(debt.plan.totals.endDate)}${debt.apr !== null ? ` · ${percent(debt.apr)} TAEG` : ""}`}
              amount={money(debt.plan.totals.residual)}
              share={repaidShare(debt)}
            />
          ))}
          {creditLines.map((line) => (
            <Row
              key={line.id}
              href={`/debiti/lombard?id=${line.id}`}
              name={line.name}
              detail={`linea di credito · ${Math.round(line.plan.usageRatio * 100)}% del fido · ${percent(line.plan.currentRate)}`}
              amount={money(line.plan.used)}
              share={line.plan.usageRatio}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
