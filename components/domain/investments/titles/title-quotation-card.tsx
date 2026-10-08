"use client";

/**
 * Card "Prezzi automatici" per uno strumento importato con prezzi manuali: cerca le quotazioni dell'ISIN
 * (OpenFIGI, confermate su Yahoo nella valuta del rendiconto) e permette di collegarne una. Da lì i prezzi,
 * i rendimenti e la diversificazione si aggiornano da soli.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLinkQuotationMutation, useQuotationCandidatesQuery } from "@/lib/queries/titles";

export interface TitleQuotationCardProps {
  instrumentId: string;
  isin: string;
  currency: string;
}

export function TitleQuotationCard({ instrumentId, isin, currency }: TitleQuotationCardProps) {
  const [searching, setSearching] = React.useState(false);
  const candidates = useQuotationCandidatesQuery(instrumentId, searching);
  const link = useLinkQuotationMutation(instrumentId);
  const data = candidates.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prezzi automatici</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Questo titolo ha solo i prezzi del rendiconto ({isin}). Collegalo a una quotazione in {currency} per avere prezzi aggiornati ogni giorno, rendimenti,
          settori e sovrapposizioni.
        </p>
        {!searching ? (
          <Button className="self-start" onClick={() => setSearching(true)}>
            Cerca la quotazione
          </Button>
        ) : candidates.isLoading ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Cerco le quotazioni di {isin}…
          </p>
        ) : candidates.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {candidates.error.message}
          </p>
        ) : data?.status === "ok" ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {data.candidates.map((candidate) => (
              <li key={candidate.symbol} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-foreground">{candidate.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.exchange ?? "Borsa non indicata"} · {candidate.currency}
                  </p>
                </div>
                <Button size="sm" disabled={link.isPending} onClick={() => link.mutate(candidate.symbol)}>
                  Collega
                </Button>
              </li>
            ))}
          </ul>
        ) : data?.status === "unavailable" ? (
          <p className="text-sm text-muted-foreground">Le fonti non rispondono in questo momento. Riprova tra poco.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Non ho trovato una quotazione in {currency} per questo ISIN: restano i prezzi del rendiconto.</p>
        )}
        {link.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {link.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
