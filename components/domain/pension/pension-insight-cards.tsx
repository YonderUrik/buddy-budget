/** Tre anteprime della Panoramica, ognuna porta alla sua scheda: fondo contro TFR, prelievo oggi, proiezione. */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPercent, money } from "./pension-format";

export interface PensionInsightCardsProps {
  /** Rendimento annuo del fondo (null se non calcolabile). */
  fundAnnualReturn: number | null;
  /** Rivalutazione annua del TFR in azienda. */
  companyTfrRate: number;
  /** Forbice del netto "alla pensione" se prelevassi oggi. */
  netRange: { low: number; high: number };
  /** Valore finale dello scenario base e anni considerati. */
  projection: { years: number; base: number };
  currency: string;
}

interface InsightProps {
  href: string;
  eyebrow: string;
  headline: ReactNode;
  caption: string;
}

function Insight({ href, eyebrow, headline, caption }: InsightProps) {
  return (
    <Link href={href} className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className="h-full transition-colors group-hover:bg-muted/40">
        <CardContent className="flex h-full flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          <div className="font-heading text-2xl font-medium tabular-nums text-foreground">{headline}</div>
          <p className="text-sm text-muted-foreground">{caption}</p>
          <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary">
            Vedi i dettagli <ArrowRight size={12} className="transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function PensionInsightCards({ fundAnnualReturn, companyTfrRate, netRange, projection, currency }: PensionInsightCardsProps) {
  const beats = fundAnnualReturn !== null && fundAnnualReturn >= companyTfrRate;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Insight
        href="/pensione/scenari"
        eyebrow="Fondo o TFR in azienda"
        headline={
          <span className={beats ? "text-pos" : "text-neg"}>
            {fundAnnualReturn !== null ? formatPercent(fundAnnualReturn) : "—"} <span className="text-base text-muted-foreground">contro {formatPercent(companyTfrRate)}</span>
          </span>
        }
        caption={beats ? "Il fondo rende più della rivalutazione del TFR lasciato in azienda." : "Il TFR in azienda si rivaluta più di quanto ha reso il fondo finora."}
      />
      <Insight
        href="/pensione/scenari"
        eyebrow="Se prelevassi oggi"
        headline={<>{money(netRange.low, currency)}<span className="text-muted-foreground"> – </span>{money(netRange.high, currency)}</>}
        caption="Netto stimato alla pensione, tasse comprese."
      />
      <Insight
        href="/pensione/proiezione"
        eyebrow={`Tra ${projection.years} anni`}
        headline={money(projection.base, currency)}
        caption="Scenario base, in euro di oggi: già al netto dell'inflazione."
      />
    </div>
  );
}
