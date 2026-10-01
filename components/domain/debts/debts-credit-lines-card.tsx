/** Linee di credito nella panoramica: utilizzato sul fido, costo del mese e avviso quando scatta la soglia. */

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreditLineView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DebtsCreditLinesCardProps {
  lines: CreditLineView[];
  currency: string;
  /** Dove porta una linea (la scheda Lombard). */
  href?: string;
}

export function DebtsCreditLinesCard({ lines, currency, href = "/debiti/lombard" }: DebtsCreditLinesCardProps) {
  if (lines.length === 0) return null;
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linee di credito</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {lines.map((line) => {
            const alerting = line.alertTriggered || line.plan.overLimit;
            return (
              <li key={line.id}>
                <Link href={href} className="flex flex-col gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                      {line.name}
                      {alerting ? <TriangleAlert size={14} className="shrink-0 text-neg" aria-label="Soglia di allerta raggiunta" /> : null}
                    </span>
                    <span className="font-heading text-lg font-medium tabular-nums text-foreground">{money(line.plan.used)}</span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className={cn("block h-full rounded-full", alerting ? "bg-neg" : "bg-primary")} style={{ width: `${Math.min(1, line.plan.usageRatio) * 100}%` }} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(line.plan.usageRatio * 100)}% di {money(line.creditLimit)} · costa circa {money(line.plan.monthlyCostAtCurrent)} al mese
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
