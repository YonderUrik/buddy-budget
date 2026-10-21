/** The sentence at the top of Liquidità · Analisi, shared by the web page and `GET /api/liquidity/analysis`. Pure. */
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { localizedFormats } from "@/lib/localization/format";
import { translate } from "@/lib/localization/messages";

export interface AnalysisSentenceInput {
  language: Language;
  currency: string;
  /** Effective spend in the period on screen. */
  spent: number;
  /** Effective spend in the period before (same length). */
  spentBefore: number;
  /** The period is the current month: «Finora hai speso» instead of «Hai speso». */
  isCurrentMonth: boolean;
  /** The category that weighs most in the period, if any. */
  heaviest: { name: string; amount: number } | null;
}

/** «Finora hai speso 1.234 €, 120 € in più del periodo prima. La voce che pesa di più è «Spesa», il 32%.» in `language`. */
export function buildAnalysisSentence(input: AnalysisSentenceInput): string {
  const { language, spent, spentBefore, heaviest } = input;
  const locale = LANGUAGE_LOCALES[language];
  const tr = (source: string, values?: Record<string, string | number>) => translate(language, source, values);
  const money = (n: number) => localizedFormats(locale).formatCurrency(n, input.currency, { maximumFractionDigits: 0 });
  if (spent === 0) return tr("In questo periodo non ci sono ancora spese.");
  const delta = spent - spentBefore;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return `${input.isCurrentMonth ? tr("Finora hai speso") : tr("Hai speso")} ${money(spent)}${spentBefore > 0 ? tr(", {0} {1} del periodo prima", { 0: money(Math.abs(delta)), 1: delta > 0 ? tr("in più") : tr("in meno") }) : ""}.${heaviest ? tr(" La voce che pesa di più è «{0}», il {1}.", { 0: heaviest.name, 1: percent.format(heaviest.amount / spent) }) : ""}`;
}
