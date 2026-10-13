/** Sezioni affiancate «Quanto rende il capitale» (ROE, ROA, ROIC, copertura interessi) e «Debiti e solidità». */

import { LandmarkIcon, PercentIcon } from "lucide-react";
import { PROFITABILITY_KEYS, SOLIDITY_KEYS, type StockFundamentals } from "@/lib/investments/title-fundamentals";
import { PanelSection } from "../panel-section";
import { IndicatorGrid } from "./indicator-grid";

export interface TitleQualitySectionProps {
  stock: StockFundamentals;
  priceCurrency: string;
}

export function TitleQualitySection({ stock, priceCurrency }: TitleQualitySectionProps) {
  const hasProfitability = Object.keys(stock.profitability).length > 0;
  const hasSolidity = Object.keys(stock.solidity).length > 0;
  if (!hasProfitability && !hasSolidity) return null;
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {hasProfitability ? (
        <PanelSection icon={PercentIcon} title="Quanto rende il capitale" color="var(--swatch-emerald)">
          <IndicatorGrid keys={PROFITABILITY_KEYS} values={stock.profitability} currency={stock.currency} priceCurrency={priceCurrency} />
        </PanelSection>
      ) : null}
      {hasSolidity ? (
        <PanelSection icon={LandmarkIcon} title="Debiti e solidità" color="var(--swatch-amber)">
          <IndicatorGrid keys={SOLIDITY_KEYS} values={stock.solidity} currency={stock.currency} priceCurrency={priceCurrency} />
        </PanelSection>
      ) : null}
    </div>
  );
}
