/**
 * Sezione «Quanto costa rispetto a quello che produce»: multipli calcolati con l'ultima chiusura e i bilanci, con la
 * forbice degli esercizi passati del titolo stesso. Nessun giudizio «caro» o «conveniente».
 */

import { ScaleIcon } from "lucide-react";
import { VALUATION_KEYS, type StockFundamentals } from "@/lib/investments/title-fundamentals";
import { PanelSection } from "../panel-section";
import { IndicatorGrid } from "./indicator-grid";

export interface TitleValuationSectionProps {
  stock: StockFundamentals;
  priceCurrency: string;
}

export function TitleValuationSection({ stock, priceCurrency }: TitleValuationSectionProps) {
  const hasValues = Object.keys(stock.valuation).length > 0;
  return (
    <PanelSection
      icon={ScaleIcon}
      title="Quanto costa rispetto a quello che produce"
      color="var(--swatch-indigo)"
      description="Multipli calcolati con l'ultima chiusura e i bilanci degli ultimi 12 mesi."
    >
      {hasValues ? (
        <>
          <IndicatorGrid keys={VALUATION_KEYS} values={stock.valuation} currency={stock.currency} priceCurrency={priceCurrency} withRange className="sm:grid-cols-3" />
          <p className="text-xs text-muted-foreground">
            La barra va dal minimo al massimo degli esercizi passati, con la tacca sulla media e il pallino sul valore di oggi.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {stock.priceComparable
            ? "Con gli utili o la cassa di oggi questi multipli non hanno senso (sono negativi o mancano)."
            : `I bilanci sono in ${stock.currency} e il prezzo in ${priceCurrency}: i multipli col prezzo non si calcolano.`}
        </p>
      )}
    </PanelSection>
  );
}
