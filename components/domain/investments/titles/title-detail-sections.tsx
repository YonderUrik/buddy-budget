/**
 * Parte bassa della pagina titolo, scelta per tipo: per un'azione multipli, valori per azione, conti, redditività,
 * solidità e dividendi (o i soli numeri chiave di Yahoo se mancano i bilanci); per un ETF o fondo composizione,
 * anni, paniere, costi e proventi; per gli altri gli anni. In fondo la fonte e l'avviso che non sono consigli.
 */

import type { TitleAnalysis } from "@/lib/investments/title-view";
import { TitleAnnualReturns } from "./title-annual-returns";
import { TitleCompanySection } from "./title-company-section";
import { TitleCompositionSection } from "./title-composition-section";
import { TitleDividendsSection } from "./title-dividends-section";
import { TitleFundSections } from "./title-fund-sections";
import { TitleFundamentalsCard } from "./title-fundamentals-card";
import { TitlePerShareSection } from "./title-per-share-section";
import { TitleQualitySection } from "./title-quality-section";
import { TitleValuationSection } from "./title-valuation-section";

export interface TitleDetailSectionsProps {
  data: TitleAnalysis;
}

/** Nota sulle fonti in fondo alla pagina. */
function sourceNote(data: TitleAnalysis): string | null {
  const { type } = data.instrument;
  if (type === "azione" && data.stock) {
    return "Bilanci, numeri chiave e date di stacco da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; multipli, valori per azione e confronti con il passato calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita.";
  }
  if (type === "etf" || type === "fondo") {
    return "Composizione, TER e multipli del paniere da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; rendimenti, costi e sovrapposizioni calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita.";
  }
  return null;
}

export function TitleDetailSections({ data }: TitleDetailSectionsProps) {
  const { instrument, stock, fundamentals, dividends, composition, annualReturns } = data;
  const currency = instrument.currency;
  const note = sourceNote(data);
  const isFund = instrument.type === "etf" || instrument.type === "fondo";
  return (
    <div className="flex flex-col gap-10">
      {instrument.type === "azione" && stock ? (
        <>
          <TitleValuationSection stock={stock} priceCurrency={currency} />
          <TitlePerShareSection stock={stock} lastClose={data.stats?.lastClose ?? null} priceCurrency={currency} />
          <TitleCompanySection stock={stock} priceCurrency={currency} />
          <TitleQualitySection stock={stock} priceCurrency={currency} />
        </>
      ) : instrument.type === "azione" ? (
        <TitleFundamentalsCard fundamentals={fundamentals} status={data.fundamentalsStatus} currency={currency} />
      ) : null}
      {composition ? <TitleCompositionSection holdings={composition.holdings} sectors={composition.sectors} shared={composition.shared} /> : null}
      {instrument.type !== "azione" ? <TitleAnnualReturns returns={annualReturns} /> : null}
      {isFund && fundamentals ? <TitleFundSections fundamentals={fundamentals} positionValue={data.position?.value ?? null} currency={currency} /> : null}
      {isFund && !fundamentals && data.fundamentalsStatus !== "unsupported" ? (
        <TitleFundamentalsCard fundamentals={null} status={data.fundamentalsStatus} currency={currency} />
      ) : null}
      {dividends ? <TitleDividendsSection dividends={dividends} currency={currency} /> : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
