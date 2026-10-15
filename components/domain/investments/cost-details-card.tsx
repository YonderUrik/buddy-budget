"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
import { ReceiptTextIcon } from "lucide-react";

import type { CostImpact } from "@/lib/investments/cost-impact";
import { PanelSection } from "./panel-section";

export interface CostDetailsCardProps { impact: CostImpact; currency: string }

/** Separate recorded charges from the additional sale-tax estimate used by the chart simulation. */
export function CostDetailsCard({ impact, currency }: CostDetailsCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr, features } = useLocalization();
  const money = (amount: number) => formatCurrency(amount, currency);
  return (
    <PanelSection
      icon={ReceiptTextIcon}
      title={tr("Costi e imposte")}
      color="var(--neg)"
      href={features.taxes ? "/investimenti/tasse" : undefined}
      linkLabel={features.taxes ? tr("Dettaglio fiscale") : undefined}
      description={tr("Dall’inizio · operazioni registrate")}
    >
      <dl className="text-sm">
        <div className="flex justify-between gap-4 border-b py-2.5"><dt>{tr("Costi e commissioni")}</dt><dd className="tabular-nums">{money(impact.fees)}</dd></div>
        <div className="flex justify-between gap-4 border-b py-2.5"><dt>{tr("Imposte già registrate")}</dt><dd className="tabular-nums">{money(impact.taxes - impact.estimatedTaxes)}</dd></div>
        {features.taxes && <div className="flex justify-between gap-4 border-b py-2.5"><dt>{tr("Imposte aggiuntive stimate")}</dt><dd className="tabular-nums">{money(impact.estimatedTaxes)}</dd></div>}
        <div className="flex justify-between gap-4 py-2.5 font-medium"><dt>{tr("Totale costi e imposte")}</dt><dd className="font-heading text-base tabular-nums">{money(impact.fees + impact.taxes)}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">{tr("I costi del fondo (TER) sono già riflessi nel prezzo: non vengono sottratti di nuovo né inclusi tra le commissioni registrate. Eventuali costi del broker non registrati non sono inclusi.")}</p>
      <p className="text-sm text-muted-foreground">{tr(features.taxes ? "Stesse stime della scheda Tasse, con aliquote, regime e compensazione delle minusvalenze. Bollo escluso." : "Per la Germania mostriamo solo costi e imposte registrati. Non aggiungiamo il bollo italiano né stime fiscali tedesche.")}</p>
    </PanelSection>
  );
}
