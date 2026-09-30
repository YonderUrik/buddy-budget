/** Card "Questo mese": entrate, uscite e quanto messo da parte nel mese corrente, con link a Cash flow. */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MonthSummaryCardProps {
  entrate: number;
  uscite: number;
  currency: string;
  href?: string;
}

export function MonthSummaryCard({ entrate, uscite, currency, href = "/movimenti/analisi" }: MonthSummaryCardProps) {
  const saved = entrate - uscite;
  const format = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });

  return (
    <Link href={href} className="rounded-xl transition-opacity hover:opacity-80">
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Questo mese
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Entrate</p>
            <p className="font-heading text-xl font-medium tabular-nums text-pos">{format(entrate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Uscite</p>
            <p className="font-heading text-xl font-medium tabular-nums text-neg">{format(uscite)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Messo da parte</p>
            <p className={cn("font-heading text-xl font-medium tabular-nums", saved < 0 ? "text-neg" : "text-pos")}>
              {format(saved)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
