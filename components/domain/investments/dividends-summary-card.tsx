"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncomeHistory } from "@/lib/investments/income";
import { formatCurrency } from "@/lib/format";
import { track } from "@/lib/analytics";

export interface DividendsSummaryCardProps { income: IncomeHistory; currency: string }

/** Compact portfolio income summary linked to the full dividend history. */
export function DividendsSummaryCard({ income, currency }: DividendsSummaryCardProps) {
  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
      <CardTitle>Dividendi</CardTitle>
      <Link className="text-sm underline" href="/investimenti/proventi" onClick={() => track("investment_dividends_details_opened", { source: "portfolio" })}>Vedi tutti i dividendi →</Link>
    </CardHeader>
    <CardContent className="space-y-3">
      <dl className="grid grid-cols-2 gap-4">
        <div><dt className="text-sm text-muted-foreground">Ultimi 12 mesi</dt><dd className="text-xl font-medium tabular-nums">{formatCurrency(income.trailing, currency)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Totale incassato</dt><dd className="text-xl font-medium tabular-nums">{formatCurrency(income.total, currency)}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">{income.count ? "Dividendi e cedole registrati, al netto di imposte e costi." : "Nessun dividendo o cedola registrato."}</p>
    </CardContent>
  </Card>;
}
