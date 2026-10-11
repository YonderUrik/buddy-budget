"use client";

/**
 * Card "Da sapere": zaino in scadenza quest'anno con i guadagni che lo userebbero, e posizioni in perdita la cui
 * vendita metterebbe minusvalenze nello zaino. Informativa: non è un consiglio di vendita.
 */

import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency } from "@/lib/format";
import type { TaxOpportunities } from "@/lib/investments/tax-insights";
import { LightbulbIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

/** Posizioni elencate per gruppo. */
export const OPPORTUNITY_ROWS_LIMIT = 4;

export interface TaxOpportunitiesCardProps {
  opportunities: TaxOpportunities;
  instrumentsById: Map<string, Instrument>;
  currency: string;
  currentYear: number;
}

export function TaxOpportunitiesCard({ opportunities, instrumentsById, currency, currentYear }: TaxOpportunitiesCardProps) {
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const name = (id: string) => instrumentsById.get(id)?.name ?? "Strumento";
  const { expiringThisYear, compensableGains, compensableTotal, losses, lossesTotal } = opportunities;
  if (expiringThisYear <= 0 && losses.length === 0) return null;

  return (
    <PanelSection icon={LightbulbIcon} title="Da sapere" color="var(--swatch-amber)">
      <div className="flex flex-col gap-4 text-sm">
        {expiringThisYear > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-foreground">
              <span className="font-semibold tabular-nums text-neg">{format(expiringThisYear)}</span> di minusvalenze scadono il 31 dicembre {currentYear}.
              {compensableGains.length > 0
                ? ` Le posizioni in guadagno che potrebbero usarle valgono ${format(compensableTotal)} di plusvalenze (base 26%):`
                : " Non hai posizioni in guadagno che possano usarle: gli ETF non compensano lo zaino."}
            </p>
            {compensableGains.length > 0 ? (
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {compensableGains.slice(0, OPPORTUNITY_ROWS_LIMIT).map((row) => (
                  <li key={row.instrumentId} className="flex justify-between gap-3">
                    <span className="truncate">{name(row.instrumentId)}</span>
                    <span className="tabular-nums text-pos">+{format(row.unrealized)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {losses.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-foreground">
              Hai posizioni in perdita per {format(lossesTotal)} (base 26%): vendendole, la minusvalenza entrerebbe nello zaino per 4 anni, anche
              quella di un ETF.
            </p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {losses.slice(0, OPPORTUNITY_ROWS_LIMIT).map((row) => (
                <li key={row.instrumentId} className="flex justify-between gap-3">
                  <span className="truncate">{name(row.instrumentId)}</span>
                  <span className="tabular-nums text-neg">−{format(Math.abs(row.unrealized))}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Informazioni per capire l&apos;effetto fiscale, non un consiglio di vendita.</p>
      </div>
    </PanelSection>
  );
}
