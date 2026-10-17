"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Sezione «Per ogni azione»: ricavi, utile, cassa libera, patrimonio e dividendo per azione, esercizio per esercizio. */

import { ReceiptTextIcon } from "lucide-react";
import { PER_SHARE_KEYS, type StockFundamentals } from "@/lib/investments/title-fundamentals";
import { PanelSection } from "../panel-section";
import { PER_SHARE_LABELS, formatPerShare } from "./indicator-meta";
import { TitleSparkline } from "./title-sparkline";

export interface TitlePerShareSectionProps {
  stock: StockFundamentals;
  /** Ultima chiusura, nella valuta di quotazione: per dire con cosa confrontare i valori. */
  lastClose: number | null;
  priceCurrency: string;
}

export function TitlePerShareSection({ stock, lastClose, priceCurrency }: TitlePerShareSectionProps) {
  const { t: tr, locale } = useLocalization();
  const rows = PER_SHARE_KEYS.filter((key) => stock.perShare[key].some((v) => v !== null));
  if (rows.length === 0) return null;
  const last = stock.columns.length - 1;
  return (
    <PanelSection
      icon={ReceiptTextIcon}
      title={tr("Per ogni azione")}
      color="var(--swatch-teal)"
      description={
        lastClose !== null && stock.priceComparable
          ? tr("Ricavi, utili e cassa divisi per il numero di azioni: si confrontano con il prezzo di {0}.", {0: formatPerShare(lastClose, priceCurrency, locale)})
          : tr("Ricavi, utili e cassa divisi per il numero di azioni.")
      }
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[30rem] text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-normal">{tr("Per azione")}</th>
              {stock.columns.map((c) => (
                <th key={c.end} className="px-2 py-1.5 text-right font-normal">
                  {tr(c.label)}
                </th>
              ))}
              <th className="hidden py-1.5 pl-2 text-right font-normal sm:table-cell">{tr("Andamento")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => {
              const values = stock.perShare[key];
              return (
                <tr key={key} className="border-t">
                  <td className="py-2 pr-2 text-foreground">{tr(PER_SHARE_LABELS[key])}</td>
                  {values.map((v, i) => (
                    <td key={stock.columns[i].end} className={i === last ? "px-2 py-2 text-right font-medium text-foreground" : "px-2 py-2 text-right text-muted-foreground"}>
                      {v === null ? "—" : formatPerShare(v, stock.currency, locale)}
                    </td>
                  ))}
                  <td className="hidden py-2 pl-2 sm:table-cell">
                    <TitleSparkline values={values.filter((v): v is number => v !== null)} width={80} className="ml-auto" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{tr("Calcolati dall'app: voce di bilancio ÷ numero medio di azioni dell'esercizio.")}</p>
    </PanelSection>
  );
}
