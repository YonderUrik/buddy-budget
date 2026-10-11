/**
 * Sezioni di un ETF o fondo: «Quanto costa il paniere» (multipli medi dei titoli contenuti, da Yahoo) e «Quanto ti
 * costa tenerlo» (effetto del TER nel tempo e, se lo possiedi, in euro all'anno sulla tua posizione).
 */

import { ScaleIcon, WalletIcon } from "lucide-react";
import { TER_EXAMPLE_AMOUNT, TER_EXAMPLE_RETURN, TER_EXAMPLE_YEARS, terCost } from "@/lib/investments/title-fundamentals";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";
import { formatCurrency } from "@/lib/format";
import { PanelSection } from "../panel-section";
import { formatPct } from "../percent";
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
  const basket = [
    f.holdingsPE !== null ? { id: "holdings_pe", label: "P/E medio", value: formatIndicator(f.holdingsPE, "multiple"), hint: "Prezzo ÷ utili delle aziende nel fondo." } : null,
    f.holdingsPB !== null ? { id: "holdings_pb", label: "P/B medio", value: formatIndicator(f.holdingsPB, "multiple"), hint: "Prezzo ÷ patrimonio contabile." } : null,
    f.holdingsPS !== null ? { id: "holdings_ps", label: "P/S medio", value: formatIndicator(f.holdingsPS, "multiple"), hint: "Prezzo ÷ ricavi." } : null,
    f.fundYield !== null && f.fundYield > 0 ? { id: "fund_yield", label: "Rendimento da dividendo", value: formatPct(f.fundYield, 2), hint: "Proventi dei titoli contenuti ÷ prezzo, anche se il fondo li reinveste." } : null,
  ].filter((x) => x !== null);
  const ter = f.expenseRatio;
  return (
    <>
      {basket.length > 0 ? (
        <PanelSection icon={ScaleIcon} title="Quanto costa il paniere" color="var(--swatch-indigo)" description="Media pesata dei titoli contenuti nel fondo.">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {basket.map((b) => (
              <IndicatorItem key={b.id} label={b.label} value={b.value} hint={b.hint} help={{ id: b.id, title: b.label, formula: `${b.hint} Media pesata calcolata da Yahoo sui titoli del fondo.`, source: YAHOO_SOURCE }} />
            ))}
          </dl>
        </PanelSection>
      ) : null}
      {ter !== null && ter > 0 ? (
        <PanelSection
          icon={WalletIcon}
          title="Quanto ti costa tenerlo"
          color="var(--swatch-violet)"
          description={`Effetto del TER (${formatPct(ter, 2)}) su ${formatCurrency(TER_EXAMPLE_AMOUNT, currency)} con un rendimento ipotetico del ${formatPct(TER_EXAMPLE_RETURN, 0)} l'anno.`}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {positionValue !== null ? (
              <IndicatorItem label="Sulla tua posizione" value={`≈ ${formatCurrency(positionValue * ter, currency)} l'anno`} hint="Valore di oggi × TER, già scalato dal prezzo." />
            ) : null}
            {TER_EXAMPLE_YEARS.map((years) => (
              <IndicatorItem
                key={years}
                label={`Dopo ${years} anni`}
                value={`−${formatCurrency(terCost(ter, years), currency)}`}
                hint="Differenza rispetto allo stesso fondo senza costi."
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
