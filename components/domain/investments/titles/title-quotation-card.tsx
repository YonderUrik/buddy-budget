"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Card "Prezzi automatici" per uno strumento importato con prezzi manuali: cerca le quotazioni dell'ISIN
 * (OpenFIGI, confermate su Yahoo nella valuta del rendiconto) e permette di collegarne una. Da lì i prezzi,
 * i rendimenti e la diversificazione si aggiornano da soli.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LinkIcon } from "lucide-react";
import { PanelSection } from "../panel-section";
import { useLinkQuotationMutation, useQuotationCandidatesQuery } from "@/lib/queries/titles";

export interface TitleQuotationCardProps {
  instrumentId: string;
  isin: string;
  currency: string;
}

export function TitleQuotationCard({ instrumentId, isin, currency }: TitleQuotationCardProps) {
  const { t: tr } = useLocalization();
  const [searching, setSearching] = React.useState(false);
  const candidates = useQuotationCandidatesQuery(instrumentId, searching);
  const link = useLinkQuotationMutation(instrumentId);
  const data = candidates.data;

  return (
    <PanelSection icon={LinkIcon} title={tr("Prezzi automatici")} color="var(--swatch-teal)" className="gap-3">
        <p className="text-sm text-muted-foreground">{tr("Questo titolo ha solo i prezzi del rendiconto (")}{isin}{tr("). Collegalo a una quotazione in")}{" "}{currency}{" "}{tr("per avere prezzi aggiornati ogni giorno, rendimenti, settori e sovrapposizioni.")}</p>
        {!searching ? (
          <Button className="self-start" onClick={() => setSearching(true)}>{tr("Cerca la quotazione")}</Button>
        ) : candidates.isLoading ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">{tr("Cerco le quotazioni di")}{" "}{isin}{"…"}</p>
        ) : candidates.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {tr(candidates.error.message)}
          </p>
        ) : data?.status === "ok" ? (
          <ul className="flex flex-col">
            {data.candidates.map((candidate) => (
              <li key={candidate.symbol} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-foreground">{candidate.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.exchange ?? tr("Borsa non indicata")} {"·"}{candidate.currency}
                  </p>
                </div>
                <Button size="sm" disabled={link.isPending} onClick={() => link.mutate(candidate.symbol)}>{tr("Collega")}</Button>
              </li>
            ))}
          </ul>
        ) : data?.status === "unavailable" ? (
          <p className="text-sm text-muted-foreground">{tr("Le fonti non rispondono in questo momento. Riprova tra poco.")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("Non ho trovato una quotazione in")}{" "}{currency}{" "}{tr("per questo ISIN: restano i prezzi del rendiconto.")}</p>
        )}
        {link.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {tr(link.error.message)}
          </p>
        ) : null}
    </PanelSection>
  );
}
