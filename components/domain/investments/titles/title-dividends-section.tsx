/**
 * Sezione «Dividendi» della pagina titolo: dividendo per quota anno per anno (storico salvato dall'app), rendimento
 * di oggi e sul prezzo medio dell'utente, crescita media e prossimo stacco annunciato.
 */

import { CoinsIcon } from "lucide-react";
import type { DividendFacts } from "@/lib/investments/title-fundamentals";
import { formatDateWithYear } from "@/lib/format";
import { formatSignedPct } from "../gain-text";
import { PanelSection } from "../panel-section";
import { formatPct } from "../percent";
import { formatPerShare } from "./indicator-meta";
import { IndicatorItem } from "./indicator-item";
import { MiniBars } from "./mini-bars";

const SOURCE = "Storico degli stacchi salvato dall'app da Yahoo Finance (non ufficiale).";

export interface TitleDividendsSectionProps {
  dividends: DividendFacts;
  currency: string;
}

export function TitleDividendsSection({ dividends, currency }: TitleDividendsSectionProps) {
  const current = dividends.perYear[dividends.perYear.length - 1];
  return (
    <PanelSection icon={CoinsIcon} title="Dividendi" color="var(--swatch-violet)" description="Dividendo per quota con data di stacco nell'anno; l'anno in corso è parziale.">
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <MiniBars
            colorClass="bg-[var(--swatch-violet)]"
            ariaLabel="Dividendo per quota anno per anno"
            bars={dividends.perYear.map((y) => ({
              label: String(y.year),
              value: y.amount,
              muted: y.partial,
              title: `${y.year}${y.partial ? " (finora)" : ""}: ${formatPerShare(y.amount, currency)}`,
            }))}
          />
          {current?.partial ? (
            <p className="text-xs text-muted-foreground">
              {current.year} finora: {formatPerShare(current.amount, currency)} per quota.
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
          {dividends.yieldToday !== null ? (
            <IndicatorItem
              label="Rendimento oggi"
              value={formatPct(dividends.yieldToday, 2)}
              hint="Dividendi degli ultimi 12 mesi ÷ prezzo."
              help={{ id: "dividend_yield", title: "Rendimento da dividendo", formula: `Dividendi per quota staccati negli ultimi 12 mesi (${formatPerShare(dividends.trailing, currency)}) ÷ ultima chiusura.`, source: SOURCE }}
            />
          ) : null}
          {dividends.yieldOnCost !== null ? (
            <IndicatorItem
              label="Sul tuo prezzo medio"
              value={formatPct(dividends.yieldOnCost, 2)}
              hint="Gli stessi dividendi ÷ il tuo prezzo medio."
              help={{ id: "yield_on_cost", title: "Rendimento sul prezzo medio", formula: "Dividendi per quota degli ultimi 12 mesi ÷ il tuo prezzo medio di carico.", source: SOURCE }}
            />
          ) : null}
          {dividends.growth !== null ? (
            <IndicatorItem
              label="Crescita media"
              value={`${formatSignedPct(dividends.growth)} l'anno`}
              hint={`Dividendo per quota, ultimi ${dividends.growthYears} anni interi.`}
              help={{ id: "dividend_growth", title: "Crescita media del dividendo", formula: "Crescita annua composta del dividendo per quota tra il primo e l'ultimo anno intero dello storico.", source: SOURCE }}
            />
          ) : null}
          {dividends.nextExDate ? (
            <IndicatorItem label="Prossimo stacco" value={formatDateWithYear(dividends.nextExDate)} hint="Data annunciata secondo Yahoo, da confermare." />
          ) : null}
        </dl>
      </div>
    </PanelSection>
  );
}
