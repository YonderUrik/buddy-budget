import { ASSUMPTION_LIMITS, type AnalyticsAssumptions } from "@/lib/analitiche/assumptions";

/** Legge un numero scritto all'italiana ("3,5", "1.250,5"); null se vuoto o non valido. */
export function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Numero come testo italiano per un campo ("0,035" → "3,5" se `percent`). */
export function toFieldText(value: number | null, percent: boolean): string {
  if (value === null) return "";
  const shown = percent ? Math.round(value * 10000) / 100 : Math.round(value);
  return String(shown).replace(".", ",");
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

export function toPercentDraft(a: AnalyticsAssumptions): PercentDraft {
  return {
    withdrawalRate: toFieldText(a.withdrawalRate, true),
    expectedReturn: toFieldText(a.expectedReturn, true),
    volatility: toFieldText(a.volatility, true),
    inflation: toFieldText(a.inflation, true),
  };
}
