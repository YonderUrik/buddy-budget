/**
 * Riga «in breve» sotto il prezzo del titolo: sei numeri scelti per tipo (azione, ETF/fondo, altro), presi da ciò che
 * la pagina ha già calcolato o letto. Pura, per poterla testare: mancano i numeri che non ci sono.
 */

import type { InstrumentType } from "@/lib/db/schema/investments";
import type { DividendFacts, StockFundamentals } from "@/lib/investments/title-fundamentals";
import type { TitleStats } from "@/lib/investments/title-stats";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";
import { formatSignedPct } from "../gain-text";
import { formatPct } from "../percent";
import { formatIndicator, formatPerShare } from "./indicator-meta";
import { formatCompactAmount } from "./title-format";

export interface KeyFact {
  label: string;
  value: string;
  note?: string;
}

export interface KeyFactsInput {
  type: InstrumentType;
  currency: string;
  stats: TitleStats | null;
  fundamentals: TitleFundamentals | null;
  stock: StockFundamentals | null;
  dividends: DividendFacts | null;
}

/** Numeri della riga «in breve», al massimo sei. */
export function keyFacts({ type, currency, stats, fundamentals: f, stock, dividends }: KeyFactsInput): KeyFact[] {
  const facts: (KeyFact | null)[] = [];
  if (type === "azione") {
    const pe = stock?.valuation.pe?.value ?? f?.trailingPE ?? null;
    const revenuePs = stock ? stock.perShare.revenue[stock.perShare.revenue.length - 1] : null;
    const yieldToday = dividends?.yieldToday ?? f?.dividendYield ?? null;
    facts.push(
      f?.marketCap != null ? { label: "Capitalizzazione", value: `${formatCompactAmount(f.marketCap)} ${currency}` } : null,
      pe !== null ? { label: "P/E", value: formatIndicator(pe, "multiple"), note: "utili ultimi 12 mesi" } : null,
      revenuePs !== null && stock
        ? { label: "Ricavi per azione", value: formatPerShare(revenuePs, stock.currency), note: "ultimi 12 mesi" }
        : f?.revenuePerShare != null
          ? { label: "Ricavi per azione", value: formatPerShare(f.revenuePerShare, f.financialCurrency ?? currency), note: "ultimi 12 mesi" }
          : null,
      yieldToday !== null && yieldToday > 0
        ? { label: "Dividendo", value: formatPct(yieldToday, 1), note: dividends && dividends.trailing > 0 ? `${formatPerShare(dividends.trailing, currency)} in 12 mesi` : undefined }
        : null
    );
  } else if (type === "etf" || type === "fondo") {
    const yieldValue = f?.fundYield ?? dividends?.yieldToday ?? null;
    facts.push(
      f?.expenseRatio != null ? { label: "Costo annuo (TER)", value: formatPct(f.expenseRatio, 2), note: `${formatCompactAmount(f.expenseRatio * 10_000)} ${currency} ogni 10.000` } : null,
      f?.totalAssets != null ? { label: "Patrimonio", value: `${formatCompactAmount(f.totalAssets)} ${currency}` } : null,
      f?.fundCategory ? { label: "Categoria", value: f.fundCategory } : null,
      yieldValue !== null && yieldValue > 0 ? { label: "Rendimento da dividendo", value: formatPct(yieldValue, 1) } : null
    );
  } else if (stats) {
    facts.push(
      stats.returns["1A"] !== undefined ? { label: "1 anno", value: formatSignedPct(stats.returns["1A"]) } : null,
      stats.returns.YTD !== undefined ? { label: "Da inizio anno", value: formatSignedPct(stats.returns.YTD) } : null
    );
  }
  if (stats?.volatility != null) facts.push({ label: "Volatilità", value: formatPct(stats.volatility, 0), note: "ultimo anno" });
  if (stats?.fromHigh != null) facts.push({ label: "Dal massimo", value: stats.fromHigh < -0.005 ? formatSignedPct(stats.fromHigh) : "sui massimi", note: "52 settimane" });
  return facts.filter((f): f is KeyFact => f !== null).slice(0, 6);
}
