import { ASSUMPTION_LIMITS, type AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import { numberSeparators } from "@/lib/localization/format";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Reads a number written with the separators of `locale` ("3,5", "1.250,5" in Italian); null if empty or invalid. */
export function parseNumber(text: string, locale = "it-IT"): number | null {
  const { thousand, decimal } = numberSeparators(locale);
  const normalized = text
    .trim()
    .replace(/\s/g, "")
    .replace(new RegExp(`${escapeRegExp(thousand)}(?=\\d{3}(\\D|$))`, "g"), "")
    .replace(decimal, ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Number as field text with the decimal separator of `locale` (0.035 → "3,5" in Italian if `percent`). */
export function toFieldText(value: number | null, percent: boolean, locale = "it-IT"): string {
  if (value === null) return "";
  const shown = percent ? Math.round(value * 10000) / 100 : Math.round(value);
  return String(shown).replace(".", numberSeparators(locale).decimal);
}

export interface PercentField {
  key: "withdrawalRate" | "expectedReturn" | "volatility" | "inflation";
  label: string;
  hint: string;
}

/** Ipotesi in percentuale, con la spiegazione di che cosa sono e da dove partire. */
export const PERCENT_FIELDS: readonly PercentField[] = [
  {
    key: "withdrawalRate",
    label: "Tasso di prelievo",
    hint: "Quanto del capitale prelevi il primo anno di pensione. 4% è la regola storica americana; per un orizzonte lungo e per l'Europa si ragiona su valori più prudenti (3-3,5%).",
  },
  {
    key: "expectedReturn",
    label: "Rendimento reale atteso",
    hint: "Rendimento annuo del portafoglio al netto dell'inflazione. Un portafoglio azionario globale ha reso storicamente circa 4-5% reale, ma non è una promessa: nel dubbio scendi.",
  },
  {
    key: "volatility",
    label: "Volatilità annua",
    hint: "Quanto oscillano i rendimenti da un anno all'altro. Circa 15% per un portafoglio quasi tutto azionario, 8-10% per uno bilanciato. Nella scheda Rischio vedi quella osservata sul tuo.",
  },
  {
    key: "inflation",
    label: "Inflazione attesa",
    hint: "Serve solo a una regola di prelievo (Guyton-Klinger). Tutto il resto è già in euro di oggi.",
  },
];

/** Estremi accettati di un campo, per il messaggio di errore. */
export function limitsOf(key: PercentField["key"]): { min: number; max: number } {
  return ASSUMPTION_LIMITS[key];
}

export type PercentDraft = Record<PercentField["key"], string>;

export function toPercentDraft(a: AnalyticsAssumptions, locale = "it-IT"): PercentDraft {
  return {
    withdrawalRate: toFieldText(a.withdrawalRate, true, locale),
    expectedReturn: toFieldText(a.expectedReturn, true, locale),
    volatility: toFieldText(a.volatility, true, locale),
    inflation: toFieldText(a.inflation, true, locale),
  };
}

/** Field parser and formatters bound to one locale, so a form reads back exactly what it wrote. */
export function localizedNumberFields(locale: string) {
  return {
    parseNumber: (text: string) => parseNumber(text, locale),
    toFieldText: (value: number | null, percent: boolean) => toFieldText(value, percent, locale),
    toPercentDraft: (a: AnalyticsAssumptions) => toPercentDraft(a, locale),
  };
}
