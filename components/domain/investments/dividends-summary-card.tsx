"use client";

import { HandCoinsIcon } from "lucide-react";
import type { IncomeHistory } from "@/lib/investments/income";
import { formatCurrency } from "@/lib/format";
import { track } from "@/lib/analytics";
import { PanelSection } from "./panel-section";

export interface DividendsSummaryCardProps { income: IncomeHistory; currency: string }

/** Compact portfolio income summary linked to the full dividend history. */
export function DividendsSummaryCard({ income, currency }: DividendsSummaryCardProps) {
  return (
    <PanelSection
      icon={HandCoinsIcon}
      title="Dividendi"
      color="var(--swatch-amber)"
      href="/investimenti/proventi"
      linkLabel="Tutti"
      onLinkClick={() => track("investment_dividends_details_opened", { source: "portfolio" })}
    >
      <dl className="grid grid-cols-2 gap-4">
        <div><dt className="text-sm text-muted-foreground">Ultimi 12 mesi</dt><dd className="font-heading text-2xl font-medium tabular-nums">{formatCurrency(income.trailing, currency)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Totale incassato</dt><dd className="font-heading text-2xl font-medium tabular-nums">{formatCurrency(income.total, currency)}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">{income.count ? "Dividendi e cedole registrati, al netto di imposte e costi." : "Nessun dividendo o cedola registrato."}</p>
    </PanelSection>
  );
}
