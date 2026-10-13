"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * Sezioni di un ETF o fondo: «Quanto costa il paniere» (multipli medi dei titoli contenuti, da Yahoo) e «Quanto ti
 * costa tenerlo» (effetto del TER nel tempo e, se lo possiedi, in euro all'anno sulla tua posizione).
 */

import { ScaleIcon, WalletIcon } from "lucide-react";
import { TER_EXAMPLE_AMOUNT, TER_EXAMPLE_RETURN, TER_EXAMPLE_YEARS, terCost } from "@/lib/investments/title-fundamentals";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";

import { PanelSection } from "../panel-section";

import { formatIndicator } from "./indicator-meta";
import { IndicatorItem } from "./indicator-item";

const YAHOO_SOURCE = "Fonte: Yahoo Finance, aggiornata una volta al giorno (non ufficiale).";

export interface TitleFundSectionsProps {
  fundamentals: TitleFundamentals;
  /** Valore della posizione nella valuta del fondo, o null se non lo possiedi. */
  positionValue: number | null;
  currency: string;
}

export function TitleFundSections({ fundamentals: f, positionValue, currency }: TitleFundSectionsProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPct } = localizedFormats(formattingLocale);


  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const basket = [
    f.holdingsPE !== null ? { id: "holdings_pe", label: tr("P/E medio"), value: formatIndicator(f.holdingsPE, "multiple"), hint: tr("Prezzo ÷ utili delle aziende nel fondo.") } : null,
    f.holdingsPB !== null ? { id: "holdings_pb", label: tr("P/B medio"), value: formatIndicator(f.holdingsPB, "multiple"), hint: tr("Prezzo ÷ patrimonio contabile.") } : null,
    f.holdingsPS !== null ? { id: "holdings_ps", label: tr("P/S medio"), value: formatIndicator(f.holdingsPS, "multiple"), hint: tr("Prezzo ÷ ricavi.") } : null,
    f.fundYield !== null && f.fundYield > 0 ? { id: "fund_yield", label: tr("Rendimento da dividendo"), value: formatPct(f.fundYield, 2), hint: tr("Proventi dei titoli contenuti ÷ prezzo, anche se il fondo li reinveste.") } : null,
  ].filter((x) => x !== null);
  const ter = f.expenseRatio;
  return (
    <>
      {basket.length > 0 ? (
        <PanelSection icon={ScaleIcon} title={tr("Quanto costa il paniere")} color="var(--swatch-indigo)" description={tr("Media pesata dei titoli contenuti nel fondo.")}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {basket.map((b) => (
              <IndicatorItem key={b.id} label={tr(b.label)} value={b.value} hint={tr(b.hint)} help={{ id: b.id, title: b.label, formula: `${b.hint} Media pesata calcolata da Yahoo sui titoli del fondo.`, source: YAHOO_SOURCE }} />
            ))}
          </dl>
        </PanelSection>
      ) : null}
      {ter !== null && ter > 0 ? (
        <PanelSection
          icon={WalletIcon}
          title={tr("Quanto ti costa tenerlo")}
          color="var(--swatch-violet)"
          description={tr("Effetto del TER ({0}) su {1} con un rendimento ipotetico del {2} l'anno.", {0: formatPct(ter, 2), 1: formatCurrency(TER_EXAMPLE_AMOUNT, currency), 2: formatPct(TER_EXAMPLE_RETURN, 0)})}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {positionValue !== null ? (
              <IndicatorItem label={tr("Sulla tua posizione")} value={`≈ ${formatCurrency(positionValue * ter, currency)} l'anno`} hint={tr("Valore di oggi × TER, già scalato dal prezzo.")} />
            ) : null}
            {TER_EXAMPLE_YEARS.map((years) => (
              <IndicatorItem
                key={years}
                label={tr("Dopo {0} anni", {0: years})}
                value={`−${formatCurrency(terCost(ter, years), currency)}`}
                hint={tr("Differenza rispetto allo stesso fondo senza costi.")}
                help={{
                  id: `ter_${years}`,
                  title: `Costo del TER in ${years} anni`,
                  formula: `${formatCurrency(TER_EXAMPLE_AMOUNT, currency)} × (1,05^${years} − (1,05 × (1 − TER))^${years}): quanto manca al capitale finale rispetto a un fondo senza costi.`,
                  source: YAHOO_SOURCE.replace("Fonte", "TER"),
                }}
              />
            ))}
          </dl>
        </PanelSection>
      ) : null}
    </>
  );
}
