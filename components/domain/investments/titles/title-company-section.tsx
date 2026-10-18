"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/** Sezione «I conti dell'azienda»: ricavi, utile netto e cassa libera per esercizio, poi margini e crescita dei ricavi. */

import { ChartColumnIcon } from "lucide-react";
import { MARGIN_KEYS, type StockFundamentals } from "@/lib/investments/title-fundamentals";
import { cn } from "@/lib/utils";

import { PanelSection } from "../panel-section";
import { IndicatorGrid } from "./indicator-grid";
import { IndicatorItem } from "./indicator-item";
import { MiniBars } from "./mini-bars";


const SERIES = [
  { key: "revenue", label: "Ricavi", color: "bg-[var(--swatch-blue)]" },
  { key: "netIncome", label: "Utile netto", color: "bg-[var(--swatch-emerald)]" },
  { key: "freeCashFlow", label: "Cassa libera", color: "bg-[var(--swatch-amber)]" },
] as const;

export interface TitleCompanySectionProps {
  stock: StockFundamentals;
  priceCurrency: string;
}

export function TitleCompanySection({ stock, priceCurrency }: TitleCompanySectionProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct, formatCompactAmount } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const last = stock.columns.length - 1;
  const { growth } = stock;
  return (
    <PanelSection icon={ChartColumnIcon} title={tr("I conti dell'azienda")} color="var(--swatch-blue)" description={tr("Esercizi annuali e ultimi 12 mesi, in valuta di bilancio.")}>
      <div className="grid gap-6 sm:grid-cols-3">
        {SERIES.map((series) => {
          const values = stock.company[series.key];
          const latest = values[last];
          return (
            <div key={series.key} className="flex flex-col gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{tr(series.label)}</p>
                <p className={cn("font-heading text-xl font-medium tabular-nums", latest !== null && latest < 0 ? "text-neg" : "text-foreground")}>
                  {latest === null ? "—" : `${formatCompactAmount(latest)} ${stock.currency}`}
                  <span className="ml-1.5 font-sans text-xs font-normal text-muted-foreground">{stock.columns[last].trailing ? tr("ultimi 12 mesi") : stock.columns[last].label}</span>
                </p>
              </div>
              <MiniBars
                colorClass={series.color}
                ariaLabel={tr("{0} per esercizio", {0: series.label})}
                bars={stock.columns.map((c, i) => ({
                  label: c.trailing ? "12 m" : c.label,
                  value: values[i],
                  muted: c.trailing,
                  title: values[i] === null ? `${c.label}: n.d.` : `${c.label}: ${formatCompactAmount(values[i]!)} ${stock.currency}`,
                }))}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-4">
        <IndicatorGrid keys={MARGIN_KEYS} values={stock.margins} currency={stock.currency} priceCurrency={priceCurrency} className="col-span-full grid-cols-2 sm:col-span-3 sm:grid-cols-3" />
        {growth.lastYear !== null ? (
          <dl>
            <IndicatorItem
              label={tr("Crescita dei ricavi")}
              value={<span className={growth.lastYear < 0 ? "text-neg" : "text-pos"}>{formatSignedPct(growth.lastYear)}</span>}
              aside={growth.average !== null ? tr("media {0} anni {1}", {0: growth.averageYears, 1: formatSignedPct(growth.average)}) : undefined}
              hint={tr("Ultimo esercizio rispetto al precedente.")}
            />
          </dl>
        ) : null}
      </div>
    </PanelSection>
  );
}
