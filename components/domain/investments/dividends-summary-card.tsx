"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

import { HandCoinsIcon } from "lucide-react";
import type { IncomeHistory } from "@/lib/investments/income";

import { track } from "@/lib/analytics";
import { PanelSection } from "./panel-section";

export interface DividendsSummaryCardProps { income: IncomeHistory; currency: string }

/** Compact portfolio income summary linked to the full dividend history. */
export function DividendsSummaryCard({ income, currency }: DividendsSummaryCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  return (
    <PanelSection
      icon={HandCoinsIcon}
      title={tr("Dividendi")}
      color="var(--swatch-amber)"
      href="/investimenti/proventi"
      linkLabel={tr("Tutti")}
      onLinkClick={() => track("investment_dividends_details_opened", { source: "portfolio" })}
    >
      <dl className="grid grid-cols-2 gap-4">
        <div><dt className="text-sm text-muted-foreground">{tr("Ultimi 12 mesi")}</dt><dd className="font-heading text-2xl font-medium tabular-nums">{formatCurrency(income.trailing, currency)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">{tr("Totale incassato")}</dt><dd className="font-heading text-2xl font-medium tabular-nums">{formatCurrency(income.total, currency)}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">{income.count ? tr("Dividendi e cedole registrati, al netto di imposte e costi.") : tr("Nessun dividendo o cedola registrato.")}</p>
    </PanelSection>
  );
}
