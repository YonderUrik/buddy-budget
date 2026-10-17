/**
 * Etichette, spiegazioni e formati degli indicatori fondamentali della pagina titolo. Le frasi descrivono cosa misura
 * l'indicatore, mai se il titolo è caro o conveniente: sono informazioni, non consigli.
 */

import type { MarginKey, Operand, PerShareKey, ProfitabilityKey, SolidityKey, ValuationKey } from "@/lib/investments/title-fundamentals";
import { languageOfLocale } from "@/lib/localization/config";
import { localizedFormats } from "@/lib/localization/format";
import { translate } from "@/lib/localization/messages";
import { formatPct } from "../percent";

/** Come si scrive il valore di un indicatore. */
export type IndicatorFormat = "multiple" | "pct" | "years" | "times";

export type IndicatorKey = ValuationKey | MarginKey | ProfitabilityKey | SolidityKey;

export interface IndicatorMeta {
  label: string;
  /** Una frase sotto il valore. */
  hint: string;
  /** Formula in parole, nel popover. */
  formula: string;
  format: IndicatorFormat;
}

export const INDICATOR_META: Record<IndicatorKey, IndicatorMeta> = {
  pe: { label: "P/E (prezzo / utili)", hint: "Anni di utili, ai ritmi di oggi, per ripagare il prezzo.", formula: "Prezzo ÷ utile per azione degli ultimi 12 mesi.", format: "multiple" },
  ps: { label: "P/S (prezzo / ricavi)", hint: "Quanto si paga per ogni euro di ricavi.", formula: "Prezzo ÷ ricavi per azione degli ultimi 12 mesi.", format: "multiple" },
  pb: { label: "P/B (prezzo / patrimonio)", hint: "Prezzo rispetto al patrimonio contabile.", formula: "Prezzo ÷ patrimonio netto per azione dell'ultimo bilancio.", format: "multiple" },
  pfcf: { label: "P/FCF (prezzo / cassa libera)", hint: "Prezzo rispetto alla cassa che resta dopo gli investimenti.", formula: "Prezzo ÷ cassa libera per azione degli ultimi 12 mesi.", format: "multiple" },
  evEbitda: { label: "EV / EBITDA", hint: "Valore dell'azienda, debiti compresi, rispetto al margine operativo.", formula: "(Capitalizzazione + debiti − liquidità) ÷ EBITDA degli ultimi 12 mesi.", format: "multiple" },
  earningsYield: { label: "Rendimento degli utili", hint: "L'inverso del P/E: utile per ogni 100 di prezzo.", formula: "Utile per azione ÷ prezzo.", format: "pct" },
  gross: { label: "Margine lordo", hint: "Ricavi meno il costo di ciò che si vende.", formula: "Utile lordo ÷ ricavi.", format: "pct" },
  operating: { label: "Margine operativo", hint: "Quanto resta dopo i costi di gestione.", formula: "Utile operativo ÷ ricavi.", format: "pct" },
  net: { label: "Margine netto", hint: "Utile su ogni 100 di ricavi.", formula: "Utile netto ÷ ricavi.", format: "pct" },
  roe: { label: "ROE", hint: "Utile sul capitale degli azionisti.", formula: "Utile netto degli ultimi 12 mesi ÷ patrimonio netto.", format: "pct" },
  roa: { label: "ROA", hint: "Utile su tutto ciò che l'azienda possiede.", formula: "Utile netto degli ultimi 12 mesi ÷ totale attivo.", format: "pct" },
  roic: { label: "ROIC (prima delle tasse)", hint: "Rendimento del capitale investito, debiti compresi.", formula: "Utile operativo ÷ (patrimonio netto + debiti − liquidità).", format: "pct" },
  interestCoverage: { label: "Copertura degli interessi", hint: "Quante volte l'utile operativo paga gli interessi.", formula: "Utile operativo ÷ interessi passivi.", format: "times" },
  debtToEquity: { label: "Debiti / patrimonio", hint: "Sopra 1 l'azienda usa più debiti che capitale proprio.", formula: "Debiti finanziari ÷ patrimonio netto.", format: "multiple" },
  netDebtToEbitda: { label: "Debito netto / EBITDA", hint: "Anni di margine operativo per ripagare il debito netto.", formula: "(Debiti − liquidità) ÷ EBITDA degli ultimi 12 mesi.", format: "years" },
  currentRatio: { label: "Liquidità corrente", hint: "Attività a breve rispetto ai debiti a breve.", formula: "Attività correnti ÷ passività correnti.", format: "multiple" },
  payout: { label: "Payout", hint: "Parte dell'utile distribuita come dividendo.", formula: "Dividendi pagati ÷ utile netto degli ultimi 12 mesi.", format: "pct" },
};

export const PER_SHARE_LABELS: Record<PerShareKey, string> = {
  revenue: "Ricavi",
  eps: "Utile",
  fcf: "Cassa libera",
  book: "Valore contabile",
  dividend: "Dividendo",
};

/** Indicator value in its format ("14,2", "16,2%", "2,6 anni", "5,8×" in it-IT), with numbers and units in the user's locale. */
export function formatIndicator(value: number, format: IndicatorFormat, locale = "it-IT"): string {
  const { formatRatio } = localizedFormats(locale);
  switch (format) {
    case "pct":
      return formatPct(value, 1, locale);
    case "years":
      return translate(languageOfLocale(locale), "{0} anni", { 0: formatRatio(value) });
    case "times":
      return `${formatRatio(value)}×`;
    default:
      return formatRatio(value, Math.abs(value) < 10 ? 2 : 1);
  }
}

/** Per-share amount: two decimals (four below 0.1), in the user's locale. */
export function formatPerShare(value: number, currency: string, locale = "it-IT"): string {
  const digits = Math.abs(value) < 0.1 ? 4 : 2;
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} ${currency}`;
}

/** One term of the formula, in the right unit and in the user's locale. */
export function formatOperand(operand: Operand, currency: string, priceCurrency: string, locale = "it-IT"): string {
  const { formatCompactAmount } = localizedFormats(locale);
  switch (operand.unit) {
    case "price":
      return formatPerShare(operand.value, priceCurrency, locale);
    case "perShare":
      return formatPerShare(operand.value, currency, locale);
    case "shares":
      return translate(languageOfLocale(locale), "{0} azioni", { 0: formatCompactAmount(operand.value) });
    default:
      return `${formatCompactAmount(operand.value)} ${currency}`;
  }
}
