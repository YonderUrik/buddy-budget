/** Frasi che spiegano in italiano semplice i numeri del rischio e della diversificazione. */

import type { CorrelationMatrix } from "@/lib/calc/risk";

export type RiskLevel = 1 | 2 | 3 | 4;

export type SharpeLevel = "negativo" | "basso" | "discreto" | "buono";

/** Lettura della matrice: coppia più correlata e correlazione media. */
export interface CorrelationInsight {
  aId: string;
  bId: string;
  value: number;
  average: number;
  high: boolean;
}
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedRiskInsights(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const SHARPE_FAIR = 0.5;
const SHARPE_GOOD = 1;
/** Oltre questa correlazione due strumenti "si muovono quasi insieme". */
const HIGH_CORRELATION = 0.8;
/** Differenza di volatilità con l'indice sotto cui si considerano simili (in punti). */
const SIMILAR_VOLATILITY = 0.02;

/** Percentuale con un decimale, come nelle card del rischio (4,6%). */
function pct(value: number): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** Soglie dell'oscillazione annua (volatilità) per il livello di rischio: obbligazioni ~5%, azionario mondiale ~15%. */
const RISK_LEVEL_LOW = 0.08;
const RISK_LEVEL_MEDIUM = 0.15;
const RISK_LEVEL_HIGH = 0.25;

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = { 1: "Basso", 2: "Medio", 3: "Alto", 4: tr("Molto alto") };

/** Livello di rischio da 1 a 4 in base all'oscillazione annua. */
function riskLevel(volatility: number): RiskLevel {
  if (volatility < RISK_LEVEL_LOW) return 1;
  if (volatility < RISK_LEVEL_MEDIUM) return 2;
  if (volatility < RISK_LEVEL_HIGH) return 3;
  return 4;
}

/** Oscillazione a cui finisce la scala del livello di rischio (oltre, il segnaposto resta a fondo scala). */
const RISK_SCALE_MAX = 0.35;

/** Posizione da 0 a 1 sulla scala a 4 fasce uguali: dentro la fascia del livello, in proporzione all'oscillazione. */
function riskScalePosition(volatility: number): number {
  const bounds = [0, RISK_LEVEL_LOW, RISK_LEVEL_MEDIUM, RISK_LEVEL_HIGH, RISK_SCALE_MAX];
  const index = riskLevel(volatility) - 1;
  const fraction = (volatility - bounds[index]) / (bounds[index + 1] - bounds[index]);
  return (index + Math.min(Math.max(fraction, 0), 1)) / 4;
}

const RISK_LEVEL_TEXT: Record<RiskLevel, string> = {
  1: tr("Il valore si muove poco: di solito sale e scende di pochi punti."),
  2: tr("Il valore si muove in modo moderato, come ci si aspetta da un mix di azioni e obbligazioni."),
  3: tr("Il valore si muove parecchio, come un portafoglio quasi tutto azionario."),
  4: tr("Il valore si muove moltissimo: può cambiare di molto anche in pochi mesi."),
};

/** Frase di sintesi sotto il livello di rischio. */
function riskLevelInsight(level: RiskLevel): string {
  return RISK_LEVEL_TEXT[level];
}

/** Oscillazione tipica in un anno (una deviazione standard: circa due anni su tre). */
function volatilityInsight(volatility: number, benchmarkVolatility: number | null, benchmarkName: string | null): string {
  const base = tr("In un anno normale il valore può muoversi di circa ±{0} (due anni su tre).", { 0: pct(volatility) });
  if (benchmarkVolatility === null || !benchmarkName) return base;
  const diff = volatility - benchmarkVolatility;
  if (Math.abs(diff) < SIMILAR_VOLATILITY) return tr("{0} Più o meno come {1}.", { 0: base, 1: benchmarkName });
  return tr("{0} {1} movimentato di {2} (±{3}).", { 0: base, 1: diff > 0 ? tr("Più") : tr("Meno"), 2: benchmarkName, 3: pct(benchmarkVolatility) });
}

function sharpeLevel(sharpe: number): SharpeLevel {
  if (sharpe < 0) return "negativo";
  if (sharpe < SHARPE_FAIR) return "basso";
  if (sharpe < SHARPE_GOOD) return "discreto";
  return "buono";
}

const SHARPE_TEXT: Record<SharpeLevel, string> = {
  negativo: tr("Hai reso meno di un conto deposito: il rischio preso non è stato ripagato."),
  basso: tr("Il rischio preso è stato ripagato poco."),
  discreto: tr("Il rischio preso è stato ripagato in modo discreto."),
  buono: tr("Il rischio preso è stato ripagato bene."),
};

function sharpeInsight(sharpe: number): string {
  return SHARPE_TEXT[sharpeLevel(sharpe)];
}

/** Quanto il portafoglio segue l'indice. */
function betaInsight(beta: number, benchmarkName: string): string {
  const move = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(beta));
  return tr("Quando {0} si muove dell'1%, il portafoglio tende a muoversi dello {1}%{2}.", { 0: benchmarkName, 1: move, 2: beta < 0 ? tr(" in direzione opposta") : "" });
}

function correlationInsight(matrix: CorrelationMatrix): CorrelationInsight | null {
  let best: { aId: string; bId: string; value: number } | null = null;
  const all: number[] = [];
  for (let i = 0; i < matrix.instrumentIds.length; i += 1) {
    for (let j = i + 1; j < matrix.instrumentIds.length; j += 1) {
      const value = matrix.values[i][j];
      if (value === null) continue;
      all.push(value);
      if (!best || value > best.value) best = { aId: matrix.instrumentIds[i], bId: matrix.instrumentIds[j], value };
    }
  }
  if (!best) return null;
  const average = all.reduce((s, v) => s + v, 0) / all.length;
  return { ...best, average, high: best.value >= HIGH_CORRELATION };
}
  return { SHARPE_FAIR, SHARPE_GOOD, HIGH_CORRELATION, RISK_LEVEL_LOW, RISK_LEVEL_MEDIUM, RISK_LEVEL_HIGH, RISK_LEVEL_LABELS, riskLevel, RISK_SCALE_MAX, riskScalePosition, riskLevelInsight, volatilityInsight, sharpeLevel, sharpeInsight, betaInsight, correlationInsight };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { SHARPE_FAIR, SHARPE_GOOD, HIGH_CORRELATION, RISK_LEVEL_LOW, RISK_LEVEL_MEDIUM, RISK_LEVEL_HIGH, RISK_LEVEL_LABELS, riskLevel, RISK_SCALE_MAX, riskScalePosition, riskLevelInsight, volatilityInsight, sharpeLevel, sharpeInsight, betaInsight, correlationInsight } = localizedRiskInsights("it");
