/**
 * Card "Sovrapposizioni": ETF che investono nelle stesse aziende, azioni che possiedi anche dentro un ETF e quanto le
 * posizioni si muovono insieme (correlazioni).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency } from "@/lib/format";
import type { InvestmentsAnalysis } from "@/lib/investments/analysis-view";
import type { FundOverlap, OverlapMethod } from "@/lib/investments/overlap";
import { correlationInsight } from "@/lib/investments/risk-insights";
import { CorrelationMatrix } from "./correlation-matrix";

const METHOD_NOTE: Record<OverlapMethod, string> = {
  stesso_indice: "replicano lo stesso indice",
  aree_indici: "stima dagli indici che replicano",
  primi_titoli: "almeno, contando solo i primi 10 titoli",
};

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function decimal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export interface OverlapCardProps {
  analysis: Pick<InvestmentsAnalysis, "overlaps" | "stocksInFunds" | "correlations">;
  instrumentsById: Map<string, Instrument>;
  currency: string;
}

export function OverlapCard({ analysis, instrumentsById, currency }: OverlapCardProps) {
  const name = (id: string) => instrumentsById.get(id)?.name ?? "—";
  const insight = analysis.correlations ? correlationInsight(analysis.correlations) : null;
  const hasOverlaps = analysis.overlaps.length > 0 || analysis.stocksInFunds.length > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sovrapposizioni</CardTitle>
        <p className="text-sm text-muted-foreground">Posizioni che, sotto sotto, sono la stessa scommessa</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section className="flex flex-col gap-2" aria-label="Stesse aziende">
          <p className="text-sm font-medium text-foreground">Stesse aziende in più posizioni</p>
          {hasOverlaps ? (
            <ul className="flex flex-col gap-2 text-sm">
              {analysis.overlaps.map((o: FundOverlap) => (
                <li key={`${o.aId}-${o.bId}`} className="flex flex-col">
                  <span className="text-foreground">
                    {name(o.aId)} e {name(o.bId)}: <span className="font-medium tabular-nums">{pct(o.share)}</span> in comune
                  </span>
                  <span className="text-xs text-muted-foreground">{METHOD_NOTE[o.method]}</span>
                </li>
              ))}
              {analysis.stocksInFunds.map((s) => (
                <li key={s.stockId} className="flex flex-col">
                  <span className="text-foreground">
                    {name(s.stockId)}: oltre alle azioni che hai, ce l&apos;hai anche dentro {s.funds.length === 1 ? "un ETF" : `${s.funds.length} ETF`}. In
                    tutto circa <span className="font-medium tabular-nums">{formatCurrency(s.totalValue, currency, { maximumFractionDigits: 0 })}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.funds.map((f) => `${(f.weightInFund * 100).toFixed(1).replace(".", ",")}% di ${name(f.fundId)}`).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna sovrapposizione rilevante tra le tue posizioni.</p>
          )}
        </section>

        {analysis.correlations ? (
          <section className="flex flex-col gap-2" aria-label="Correlazioni">
            <p className="text-sm font-medium text-foreground">Quanto si muovono insieme</p>
            {insight ? (
              <p className="text-sm text-muted-foreground">
                {insight.high
                  ? `${name(insight.aId)} e ${name(insight.bId)} si muovono quasi insieme (${decimal(insight.value)}): diversificano poco tra loro.`
                  : `La coppia più legata è ${name(insight.aId)} e ${name(insight.bId)} (${decimal(insight.value)}).`}{" "}
                In media {decimal(insight.average)}: più è vicino a 0, più le posizioni si compensano.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Servono almeno 20 giorni di prezzi in comune per confrontare due posizioni.</p>
            )}
            <CorrelationMatrix matrix={analysis.correlations} instrumentsById={instrumentsById} />
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
