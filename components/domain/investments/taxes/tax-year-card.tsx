"use client";

/**
 * Card "Anno": plus e minusvalenze, guadagni degli ETF, zaino usato, imposte stimate e trattenute registrate,
 * proventi e bollo di un anno. Nell'amministrato confronta la stima con quanto hai registrato come trattenuto.
 */

import * as React from "react";
import { InfoHint, SegmentedControl } from "@/components/domain/shared";
import type { TaxYear } from "@/lib/calc/taxes";
import type { TaxRegime } from "@/lib/db/schema/investments";
import { formatCurrency } from "@/lib/format";
import { ReceiptTextIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

/** Anni selezionabili (dal più recente). */
export const TAX_YEARS_SHOWN = 5;
/** Sotto questa differenza stima e trattenute si considerano allineate. */
const WITHHELD_TOLERANCE = 1;

export interface TaxYearCardProps {
  years: TaxYear[];
  regime: TaxRegime;
  currency: string;
  currentYear: number;
}

function Row({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        {hint ? <InfoHint label={`Cos'è: ${label}`}>{hint}</InfoHint> : null}
      </dt>
      <dd className={tone === "pos" ? "tabular-nums text-pos" : tone === "neg" ? "tabular-nums text-neg" : "tabular-nums text-foreground"}>{value}</dd>
    </div>
  );
}

export function TaxYearCard({ years, regime, currency, currentYear }: TaxYearCardProps) {
  const recent = [...years].reverse().slice(0, TAX_YEARS_SHOWN);
  const [selected, setSelected] = React.useState(String(recent[0]?.year ?? currentYear));
  const year = years.find((y) => String(y.year) === selected) ?? recent[0];
  if (!year) return null;
  const format = (amount: number) => formatCurrency(amount, currency);
  const hasCrypto = year.cryptoGains > 0 || year.cryptoLosses > 0;
  const gap = year.estimatedTax - year.taxOnCrypto - year.withheld;

  return (
    <PanelSection icon={ReceiptTextIcon} title={year.year === currentYear ? "Quest'anno" : `Anno ${year.year}`} color="var(--neg)"
      action={
        recent.length > 1 ? (
          <SegmentedControl options={recent.map((y) => ({ value: String(y.year), label: String(y.year) }))} value={String(year.year)} onChange={setSelected} ariaLabel="Anno" />
        ) : null
      }>
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-base text-foreground">
          Imposte stimate su quanto hai venduto: <span className="font-semibold tabular-nums">{format(year.estimatedTax)}</span>
          {regime === "dichiarativo" && year.estimatedTax > 0 ? <span className="text-muted-foreground">, da versare in dichiarazione.</span> : "."}
        </p>
        {regime === "amministrato" && (year.withheld > 0 || year.estimatedTax > 0) ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {Math.abs(gap) <= WITHHELD_TOLERANCE
              ? `Hai registrato ${format(year.withheld)} di imposte trattenute sulle vendite: in linea con la stima.`
              : `Hai registrato ${format(year.withheld)} di imposte trattenute sulle vendite, ${format(Math.abs(gap))} ${gap > 0 ? "in meno" : "in più"} della stima (crypto escluse): controlla le imposte delle vendite o l'aliquota degli strumenti.`}
          </p>
        ) : null}
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <div className="divide-y divide-border">
            <Row label="Plusvalenze" value={format(year.gains)} tone={year.gains > 0 ? "pos" : undefined} hint="Guadagni da vendite e rimborsi di azioni, obbligazioni ed ETC: si possono compensare con lo zaino." />
            <Row label="Minusvalenze" value={format(year.losses)} tone={year.losses > 0 ? "neg" : undefined} hint="Perdite da vendite e rimborsi, anche di ETF e fondi: entrano nello zaino." />
            <Row
              label="Guadagni da ETF e fondi"
              value={format(year.fundGains)}
              hint="Sono redditi di capitale: tassati per intero, non si compensano con lo zaino."
            />
            <Row label="Zaino usato" value={format(year.lossesUsed)} hint="Minusvalenze (portate all'aliquota del 26%) usate per ridurre le plusvalenze." />
            {year.lossesExpired > 0 ? <Row label="Zaino scaduto" value={format(year.lossesExpired)} tone="neg" /> : null}
          </div>
          <div className="divide-y divide-border">
            {hasCrypto ? (
              <Row
                label="Crypto (netto)"
                value={format(year.cryptoGains - year.cryptoLosses)}
                hint={`Sempre in dichiarazione, compensabili solo tra crypto. Aliquota ${year.year >= 2026 ? "33%" : "26%"} ${year.year <= 2024 ? "con franchigia di 2.000 €" : ""}.`}
              />
            ) : null}
            <Row label="Imposte su plusvalenze" value={format(year.taxOnGains)} />
            <Row label="Imposte su ETF e fondi" value={format(year.taxOnFunds)} />
            {hasCrypto ? <Row label="Imposte su crypto" value={format(year.taxOnCrypto)} /> : null}
            <Row label="Dividendi e cedole lordi" value={format(year.incomeGross)} />
            <Row label="Ritenute sui proventi" value={format(year.incomeWithheld)} hint="Quelle registrate sui dividendi e le cedole: le trattiene sempre chi paga." />
            <Row
              label={year.year === currentYear ? "Bollo stimato" : "Bollo"}
              value={format(year.bollo)}
              hint="0,2% del valore a fine anno, in proporzione ai giorni in cui hai investito. Per l'anno in corso: se il valore restasse quello di oggi."
            />
          </div>
        </dl>
        {year.nonHarmonizedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Hai venduto in guadagno ETF non armonizzati: in realtà sono tassati all&apos;aliquota IRPEF in dichiarazione, qui sono stimati al 26%.
          </p>
        ) : null}
      </div>
    </PanelSection>
  );
}
