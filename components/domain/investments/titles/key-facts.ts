/**
 * Riga «in breve» sotto il prezzo del titolo: sei numeri scelti per tipo (azione, ETF/fondo, altro), presi da ciò che
 * la pagina ha già calcolato o letto. Pura, per poterla testare: mancano i numeri che non ci sono.
 */

import type { InstrumentType } from "@/lib/db/schema/investments";
import type { DividendFacts, StockFundamentals } from "@/lib/investments/title-fundamentals";
import type { TitleStats } from "@/lib/investments/title-stats";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";
import { languageOfLocale } from "@/lib/localization/config";
import { localizedFormats } from "@/lib/localization/format";
import { translate } from "@/lib/localization/messages";
import { formatPct, formatSignedPct } from "../percent";
import { formatIndicator, formatPerShare } from "./indicator-meta";

export interface KeyFact {
  /** Italian source label: the component translates it, tests and keys stay stable. */
  label: string;
  /** Value and note are already in the user's language. */
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
  /** Number and date locale of the user (e.g. "it-IT", "en-GB"). */
  locale: string;
}

/** Numeri della riga «in breve», al massimo sei. */
export function keyFacts({ type, currency, stats, fundamentals: f, stock, dividends, locale }: KeyFactsInput): KeyFact[] {
  const { formatCompactAmount } = localizedFormats(locale);
  const t = (source: string, values?: Record<string, string>) => translate(languageOfLocale(locale), source, values);
  const facts: (KeyFact | null)[] = [];
  if (type === "azione") {
    const pe = stock?.valuation.pe?.value ?? f?.trailingPE ?? null;
    const revenuePs = stock ? stock.perShare.revenue[stock.perShare.revenue.length - 1] : null;
    const yieldToday = dividends?.yieldToday ?? f?.dividendYield ?? null;
    facts.push(
      f?.marketCap != null ? { label: "Capitalizzazione", value: `${formatCompactAmount(f.marketCap)} ${currency}` } : null,
      pe !== null ? { label: "P/E", value: formatIndicator(pe, "multiple", locale), note: t("utili ultimi 12 mesi") } : null,
      revenuePs !== null && stock
        ? { label: "Ricavi per azione", value: formatPerShare(revenuePs, stock.currency, locale), note: t("ultimi 12 mesi") }
        : f?.revenuePerShare != null
          ? { label: "Ricavi per azione", value: formatPerShare(f.revenuePerShare, f.financialCurrency ?? currency, locale), note: t("ultimi 12 mesi") }
          : null,
      yieldToday !== null && yieldToday > 0
        ? { label: "Dividendo", value: formatPct(yieldToday, 1, locale), note: dividends && dividends.trailing > 0 ? t("{0} in 12 mesi", { 0: formatPerShare(dividends.trailing, currency, locale) }) : undefined }
        : null
    );
  } else if (type === "etf" || type === "fondo") {
    const yieldValue = f?.fundYield ?? dividends?.yieldToday ?? null;
    facts.push(
      f?.expenseRatio != null ? { label: "Costo annuo (TER)", value: formatPct(f.expenseRatio, 2, locale), note: t("{0} {1} ogni {2}", { 0: formatCompactAmount(f.expenseRatio * 10_000), 1: currency, 2: new Intl.NumberFormat(locale).format(10_000) }) } : null,
      f?.totalAssets != null ? { label: "Patrimonio gestito", value: `${formatCompactAmount(f.totalAssets)} ${currency}` } : null,
      f?.fundCategory ? { label: "Categoria", value: f.fundCategory } : null,
      yieldValue !== null && yieldValue > 0 ? { label: "Rendimento da dividendo", value: formatPct(yieldValue, 1, locale) } : null
    );
  } else if (stats) {
    facts.push(
      stats.returns["1A"] !== undefined ? { label: "1 anno", value: formatSignedPct(stats.returns["1A"], locale) } : null,
      stats.returns.YTD !== undefined ? { label: "Da inizio anno", value: formatSignedPct(stats.returns.YTD, locale) } : null
    );
  }
  if (stats?.volatility != null) facts.push({ label: "Volatilità", value: formatPct(stats.volatility, 0, locale), note: t("ultimo anno") });
  if (stats?.fromHigh != null) facts.push({ label: "Dal massimo", value: stats.fromHigh < -0.005 ? formatSignedPct(stats.fromHigh, locale) : t("sui massimi"), note: t("52 settimane") });
  return facts.filter((f): f is KeyFact => f !== null).slice(0, 6);
}
