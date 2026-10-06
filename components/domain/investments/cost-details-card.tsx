import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { CostImpact } from "@/lib/investments/cost-impact";

export interface CostDetailsCardProps { impact: CostImpact; currency: string }

/** Separate recorded charges from the additional sale-tax estimate used by the chart simulation. */
export function CostDetailsCard({ impact, currency }: CostDetailsCardProps) {
  const money = (amount: number) => formatCurrency(amount, currency);
  return (
    <Card>
      <CardHeader><CardTitle>Costi e imposte</CardTitle><p className="text-sm text-muted-foreground">Dall’inizio · operazioni registrate</p></CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt>Costi e commissioni</dt><dd className="tabular-nums">{money(impact.fees)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Imposte già registrate</dt><dd className="tabular-nums">{money(impact.taxes - impact.estimatedTaxes)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Imposte aggiuntive stimate</dt><dd className="tabular-nums">{money(impact.estimatedTaxes)}</dd></div>
          <div className="flex justify-between gap-4 border-t pt-3 font-medium"><dt>Totale costi e imposte</dt><dd className="tabular-nums">{money(impact.fees + impact.taxes)}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">Stesse stime della scheda Tasse, con aliquote, regime e compensazione delle minusvalenze. Bollo escluso.</p>
        <Link href="/investimenti/tasse" className="inline-block text-sm underline">Vedi dettaglio fiscale</Link>
      </CardContent>
    </Card>
  );
}
