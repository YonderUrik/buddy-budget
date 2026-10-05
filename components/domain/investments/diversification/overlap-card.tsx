/**
 * Card "Sovrapposizioni": ETF che sono in pratica lo stesso investimento, azioni che possiedi anche dentro un ETF e
 * quanto le posizioni si muovono insieme, tutto in linguaggio semplice (le soglie sono in `plain-labels.ts`).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Instrument } from "@/lib/db/schema/investments";
import type { InvestmentsAnalysis } from "@/lib/investments/analysis-view";
import { correlationInsight } from "@/lib/investments/risk-insights";
import { CorrelationPairs } from "./correlation-pairs";
import { OverlapPairRow } from "./overlap-pair-row";
import { StockInFundsRow } from "./stock-in-funds-row";

function decimal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export interface OverlapCardProps {
  analysis: Pick<InvestmentsAnalysis, "overlaps" | "stocksInFunds" | "correlations">;
  instrumentsById: Map<string, Instrument>;
  currency: string;
}

export function OverlapCard({ analysis, instrumentsById, currency }: OverlapCardProps) {
  const nameOf = (id: string) => instrumentsById.get(id)?.name ?? "—";
  const insight = analysis.correlations ? correlationInsight(analysis.correlations) : null;
  const hasOverlaps = analysis.overlaps.length > 0 || analysis.stocksInFunds.length > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sovrapposizioni</CardTitle>
        <p className="text-sm text-muted-foreground">Quando due posizioni sono, in pratica, la stessa scommessa</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <section className="flex flex-col gap-3" aria-label="Investimenti doppi">
          <div>
            <h3 className="text-sm font-medium text-foreground">Investimenti doppi</h3>
            <p className="text-sm text-muted-foreground">Fondi che contengono in buona parte le stesse aziende.</p>
          </div>
          {hasOverlaps ? (
            <ul className="flex flex-col gap-2">
              {analysis.overlaps.map((o) => (
                <OverlapPairRow key={`${o.aId}-${o.bId}`} overlap={o} nameOf={nameOf} />
              ))}
              {analysis.stocksInFunds.map((s) => (
                <StockInFundsRow key={s.stockId} item={s} nameOf={nameOf} currency={currency} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna sovrapposizione rilevante tra le tue posizioni.</p>
          )}
        </section>

        {analysis.correlations ? (
          <section className="flex flex-col gap-3" aria-label="Quanto si muovono insieme">
            <div>
              <h3 className="text-sm font-medium text-foreground">Quanto si muovono insieme</h3>
              <p className="text-sm text-muted-foreground">
                {insight
                  ? `In media ${decimal(insight.average)}: più è vicino a 0, più le posizioni si compensano quando il mercato scende.`
                  : "Servono almeno 20 giorni di prezzi in comune per confrontare due posizioni."}
              </p>
            </div>
            {insight ? <CorrelationPairs matrix={analysis.correlations} instrumentsById={instrumentsById} /> : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
