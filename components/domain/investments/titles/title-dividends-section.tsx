"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * Sezione «Dividendi» della pagina titolo: dividendo per quota anno per anno (storico salvato dall'app), rendimento
 * di oggi e sul prezzo medio dell'utente, crescita media e prossimo stacco annunciato.
 */

import { CoinsIcon } from "lucide-react";
import type { DividendFacts } from "@/lib/investments/title-fundamentals";


import { PanelSection } from "../panel-section";

import { formatPerShare } from "./indicator-meta";
import { IndicatorItem } from "./indicator-item";
import { MiniBars } from "./mini-bars";

const SOURCE = "Storico degli stacchi salvato dall'app da Yahoo Finance (non ufficiale).";

export interface TitleDividendsSectionProps {
  dividends: DividendFacts;
  currency: string;
}

export function TitleDividendsSection({ dividends, currency }: TitleDividendsSectionProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct, formatPct } = localizedFormats(formattingLocale);


  const { formatDateWithYear } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const current = dividends.perYear[dividends.perYear.length - 1];
  return (
    <PanelSection icon={CoinsIcon} title={tr("Dividendi")} color="var(--swatch-violet)" description={tr("Dividendo per quota con data di stacco nell'anno; l'anno in corso è parziale.")}>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <MiniBars
            colorClass="bg-[var(--swatch-violet)]"
            ariaLabel={tr("Dividendo per quota anno per anno")}
            bars={dividends.perYear.map((y) => ({
              label: String(y.year),
              value: y.amount,
              muted: y.partial,
              title: y.partial ? tr("{0} (finora): {1}", {0: y.year, 1: formatPerShare(y.amount, currency, formattingLocale)}) : `${y.year}: ${formatPerShare(y.amount, currency, formattingLocale)}`,
            }))}
          />
          {current?.partial ? (
            <p className="text-xs text-muted-foreground">
              {current.year}{" "}{tr("finora:")}{" "}{formatPerShare(current.amount, currency, formattingLocale)}{" "}{tr("per quota.")}</p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
          {dividends.yieldToday !== null ? (
            <IndicatorItem
              label={tr("Rendimento oggi")}
              value={formatPct(dividends.yieldToday, 2)}
              hint={tr("Dividendi degli ultimi 12 mesi ÷ prezzo.")}
              help={{ id: "dividend_yield", title: "Rendimento da dividendo", formula: tr("Dividendi per quota staccati negli ultimi 12 mesi ({0}) ÷ ultima chiusura.", {0: formatPerShare(dividends.trailing, currency, formattingLocale)}), source: SOURCE }}
            />
          ) : null}
          {dividends.yieldOnCost !== null ? (
            <IndicatorItem
              label={tr("Sul tuo prezzo medio")}
              value={formatPct(dividends.yieldOnCost, 2)}
              hint={tr("Gli stessi dividendi ÷ il tuo prezzo medio.")}
              help={{ id: "yield_on_cost", title: "Rendimento sul prezzo medio", formula: "Dividendi per quota degli ultimi 12 mesi ÷ il tuo prezzo medio di carico.", source: SOURCE }}
            />
          ) : null}
          {dividends.growth !== null ? (
            <IndicatorItem
              label={tr("Crescita media")}
              value={tr("{0} l'anno", {0: formatSignedPct(dividends.growth)})}
              hint={tr("Dividendo per quota, ultimi {0} anni interi.", {0: dividends.growthYears})}
              help={{ id: "dividend_growth", title: "Crescita media del dividendo", formula: "Crescita annua composta del dividendo per quota tra il primo e l'ultimo anno intero dello storico.", source: SOURCE }}
            />
          ) : null}
          {dividends.nextExDate ? (
            <IndicatorItem label={tr("Prossimo stacco")} value={formatDateWithYear(dividends.nextExDate)} hint={tr("Data annunciata secondo Yahoo, da confermare.")} />
          ) : null}
        </dl>
      </div>
    </PanelSection>
  );
}
