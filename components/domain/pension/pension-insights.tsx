/** Tre anteprime della Panoramica, ognuna porta alla sua scheda: fondo contro TFR, prelievo oggi, proiezione. */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, CompassIcon } from "lucide-react";
import { formatPercent, money } from "./pension-format";
import { PensionSection } from "./pension-section";

export interface PensionInsightsProps {
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
    <Link href={href} className="group flex min-h-11 flex-col gap-1.5 border-t border-border pt-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <p className="text-sm text-text-2">{eyebrow}</p>
      <div className="font-heading text-2xl font-medium tabular-nums text-foreground">{headline}</div>
      <p className="text-sm text-text-2">{caption}</p>
      <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
        Vedi i dettagli <ArrowRightIcon className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function PensionInsights({ fundAnnualReturn, companyTfrRate, netRange, projection, currency }: PensionInsightsProps) {
  const beats = fundAnnualReturn !== null && fundAnnualReturn >= companyTfrRate;
  return (
    <PensionSection icon={CompassIcon} title="Dove stai andando" color="var(--swatch-teal)">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
        <Insight
          href="/pensione/scenari"
          eyebrow="Fondo o TFR in azienda"
          headline={
            <span className={beats ? "text-pos" : "text-neg"}>
              {fundAnnualReturn !== null ? formatPercent(fundAnnualReturn) : "—"} <span className="text-base text-text-2">contro {formatPercent(companyTfrRate)}</span>
            </span>
          }
          caption={beats ? "Il fondo rende più della rivalutazione del TFR lasciato in azienda." : "Il TFR in azienda si rivaluta più di quanto ha reso il fondo finora."}
        />
        <Insight
          href="/pensione/scenari"
          eyebrow="Se prelevassi oggi"
          headline={
            <>
              {money(netRange.low, currency)}
              <span className="text-text-2"> – </span>
              {money(netRange.high, currency)}
            </>
          }
          caption="Netto stimato alla pensione, tasse comprese."
        />
        <Insight
          href="/pensione/proiezione"
          eyebrow={`Tra ${projection.years} anni`}
          headline={money(projection.base, currency)}
          caption="Scenario base, in euro di oggi: già al netto dell'inflazione."
        />
      </div>
    </PensionSection>
  );
}
