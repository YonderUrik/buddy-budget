import { ReceiptTextIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { CostImpact } from "@/lib/investments/cost-impact";
import { PanelSection } from "./panel-section";

export interface CostDetailsCardProps { impact: CostImpact; currency: string }

/** Separate recorded charges from the additional sale-tax estimate used by the chart simulation. */
export function CostDetailsCard({ impact, currency }: CostDetailsCardProps) {
  const money = (amount: number) => formatCurrency(amount, currency);
  return (
    <PanelSection
      icon={ReceiptTextIcon}
      title="Costi e imposte"
      color="var(--neg)"
      href="/investimenti/tasse"
      linkLabel="Dettaglio fiscale"
      description="Dall’inizio · operazioni registrate"
    >
      <dl className="text-sm">
        <div className="flex justify-between gap-4 border-b py-2.5"><dt>Costi e commissioni</dt><dd className="tabular-nums">{money(impact.fees)}</dd></div>
        <div className="flex justify-between gap-4 border-b py-2.5"><dt>Imposte già registrate</dt><dd className="tabular-nums">{money(impact.taxes - impact.estimatedTaxes)}</dd></div>
        <div className="flex justify-between gap-4 border-b py-2.5"><dt>Imposte aggiuntive stimate</dt><dd className="tabular-nums">{money(impact.estimatedTaxes)}</dd></div>
        <div className="flex justify-between gap-4 py-2.5 font-medium"><dt>Totale costi e imposte</dt><dd className="font-heading text-base tabular-nums">{money(impact.fees + impact.taxes)}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">Stesse stime della scheda Tasse, con aliquote, regime e compensazione delle minusvalenze. Bollo escluso.</p>
    </PanelSection>
  );
}
