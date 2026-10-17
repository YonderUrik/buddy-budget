/**
 * Risposte in parole semplici alle quattro domande di Analitiche. Funzioni pure: stessi numeri, stesse frasi.
 * Il gergo tecnico (Sharpe, VaR, Guyton-Klinger…) resta nelle sezioni «Per esperti».
 */

import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import type { CostSummary } from "@/lib/calc/costs";
import { fireNumber, fireNumberAfterTax, wealthAfterYears, yearsToTarget } from "@/lib/calc/fire";
import type { GrowthSplit } from "@/lib/calc/growth-split";
import type { MonteCarloResult, WithdrawalRule } from "@/lib/calc/monte-carlo";
import type { Language } from "@/lib/localization/config";
import { translate, type MessageValues } from "@/lib/localization/messages";
import { localizedAnalyticsFormats } from "./analytics-format";

/** Formatters and translator bound to one language: every sentence below takes `language` (Italian by default). */
function textTools(language: Language) {
  return { ...localizedAnalyticsFormats(language), t: (source: string, values?: MessageValues) => translate(language, source, values) };
}

/** Taglio di spesa e aumento di risparmio (€/anno) provati nella domanda «Quando arrivo?». */
export const SPENDING_CUT = 0.1;
export const SAVING_BOOST_ANNUAL = 1200;
/** Anni mostrati oltre il traguardo nel grafico, e tetto massimo dell'asse. */
export const TIMELINE_EXTRA_YEARS = 3;
export const TIMELINE_MAX_YEARS = 60;
export const TIMELINE_DEFAULT_YEARS = 30;

/** Nomi brevi delle regole di prelievo, per le frasi. */
export const RULE_SHORT_NAMES: Record<WithdrawalRule, string> = {
  fissa: "spesa fissa",
  percentuale: "percentuale del patrimonio",
  "guyton-klinger": "Guyton-Klinger",
  vanguard: "Vanguard dinamica",
};

export type Tone = "pos" | "neg" | "default";

/** Verdict in words on the success probability, in `language`: it helps read the number, it promises nothing. */
export function successVerdict(success: number, language: Language = "it"): { text: string; tone: Tone } {
  const t = (source: string) => translate(language, source);
  if (success >= 0.9) return { text: t("Solida: regge nella grande maggioranza degli scenari"), tone: "pos" };
  if (success >= 0.75) return { text: t("Discreta: nei casi sfortunati servirebbe tagliare le spese"), tone: "default" };
  return { text: t("Fragile: in troppi scenari il patrimonio finisce prima"), tone: "neg" };
}

/** Domanda 1: a che punto sei e da dove viene la crescita recente. */
export function journeySentences(plan: AnalyticsPlan, split: GrowthSplit | null, currency: string, withdrawalRate?: number, language: Language = "it"): string[] {
  const { money, pct, t } = textTools(language);
  const out: string[] = [];
  if (plan.target !== null) {
    out.push(t("Hai {0} su {1} necessari: {2} del percorso.", { 0: money(plan.wealth, currency), 1: money(plan.target, currency), 2: pct(Math.min(plan.progress ?? 0, 9.99), 0) }));
  } else {
    out.push(t("Hai {0}. Per sapere quanto ti serve indica la spesa annua nelle ipotesi.", { 0: money(plan.wealth, currency) }));
  }
  if (plan.target !== null && plan.spending !== null && withdrawalRate !== undefined) {
    out.push(t("Il numero FIRE è la tua spesa annua ({0}) divisa per il tasso di prelievo ({1}).", { 0: money(plan.spending, currency), 1: pct(withdrawalRate) }));
  }
  if (split && split.rows.length >= 2) {
    const share = split.savingsShare;
    out.push(
      share !== null
        ? t("Negli ultimi 12 mesi il patrimonio è cresciuto di {0}: {1} grazie al tuo risparmio, il resto dal mercato.", { 0: money(split.totalDelta, currency), 1: pct(share, 0) })
        : t("Negli ultimi 12 mesi il patrimonio è variato di {0}.", { 0: money(split.totalDelta, currency) })
    );
  }
  return out;
}

/** Anni al traguardo cambiando la spesa (frazione) e/o il risparmio annuo (€). Null se non si arriva entro l'orizzonte. */
export function yearsWithChanges(plan: AnalyticsPlan, a: AnalyticsAssumptions, change: { spending?: number; saving?: number }): number | null {
  if (plan.spending === null) return null;
  const gross = fireNumber(plan.spending * (1 + (change.spending ?? 0)), a.withdrawalRate);
  const target = gross === null ? null : fireNumberAfterTax(gross, plan.taxShare);
  if (target === null) return null;
  return yearsToTarget({ current: plan.wealth, annualSaving: (plan.savings ?? 0) + (change.saving ?? 0), realReturn: a.expectedReturn }, target);
}

export interface TimelineScenario {
  label: string;
  years: number | null;
  /** Anni risparmiati rispetto a oggi (positivo = prima); null se non confrontabile. */
  yearsSaved: number | null;
}

/** I due scenari «e se…» più utili: spendere un po' meno, risparmiare un po' di più. */
export function timelineScenarios(plan: AnalyticsPlan, a: AnalyticsAssumptions, currency: string, language: Language = "it"): TimelineScenario[] {
  const { money, pct, t } = textTools(language);
  const base = plan.yearsToFire;
  const mk = (label: string, years: number | null): TimelineScenario => ({ label, years, yearsSaved: base !== null && years !== null ? base - years : null });
  return [
    mk(t("Spendendo il {0} in meno", { 0: pct(SPENDING_CUT, 0) }), yearsWithChanges(plan, a, { spending: -SPENDING_CUT })),
    mk(t("Risparmiando {0} in più al mese", { 0: money(SAVING_BOOST_ANNUAL / 12, currency) }), yearsWithChanges(plan, a, { saving: SAVING_BOOST_ANNUAL })),
  ];
}

/** Titolo della domanda 2: quando arrivi, in una riga. */
export function timelineHeadline(plan: AnalyticsPlan, today: Date, language: Language = "it"): string {
  const { formatYears, t } = textTools(language);
  if (plan.target === null) return t("Per stimare quando arrivi serve la tua spesa annua.");
  if (plan.yearsToFire === 0) return t("Hai già raggiunto il numero FIRE.");
  if (plan.yearsToFire === null) return t("Con questi numeri il traguardo è oltre 80 anni lontano: serve più risparmio o meno spesa.");
  return t("Intorno al {0}, tra {1}.", { 0: today.getFullYear() + Math.ceil(plan.yearsToFire), 1: formatYears(plan.yearsToFire) });
}

export interface TimelinePoint {
  year: number;
  wealth: number;
}

/** Patrimonio previsto anno per anno fino a poco oltre il traguardo (versamenti costanti, euro di oggi). */
export function timelineSeries(plan: AnalyticsPlan, a: AnalyticsAssumptions): TimelinePoint[] {
  const horizon = plan.yearsToFire === null ? TIMELINE_DEFAULT_YEARS : Math.min(Math.ceil(plan.yearsToFire) + TIMELINE_EXTRA_YEARS, TIMELINE_MAX_YEARS);
  const growth = { current: plan.wealth, annualSaving: plan.savings ?? 0, realReturn: a.expectedReturn };
  return Array.from({ length: horizon + 1 }, (_, year) => ({ year, wealth: Math.max(0, wealthAfterYears(growth, year)) }));
}

export interface LastingAnswer {
  /** Already in the user's language. */
  headline: string;
  verdict: ReturnType<typeof successVerdict>;
  success: number;
  /** `label` stays the Italian source name (callers translate it, as with `better.label`). */
  rules: { rule: WithdrawalRule; label: string; success: number }[];
  /** Regola con più probabilità di successo, se diversa da quella scelta. */
  better: { label: string; success: number } | null;
}

/** Domanda 3: il patrimonio dura? Parte dai risultati del confronto tra regole (smettendo oggi). */
export function lastingAnswer(results: MonteCarloResult[], selected: WithdrawalRule, retirementYears: number, language: Language = "it"): LastingAnswer | null {
  const { pct, t } = textTools(language);
  const current = results.find((r) => r.rule === selected) ?? results[0];
  if (!current) return null;
  const rules = results.map((r) => ({ rule: r.rule, label: RULE_SHORT_NAMES[r.rule], success: r.successRate }));
  const best = [...rules].sort((a, b) => b.success - a.success)[0];
  const better = best.rule !== current.rule && best.success > current.successRate + 0.005 ? { label: best.label, success: best.success } : null;
  return {
    headline: t("Se smettessi oggi, il patrimonio dura {0} anni nel {1} degli scenari simulati (regola: {2}).", { 0: retirementYears, 1: pct(current.successRate, 0), 2: t(RULE_SHORT_NAMES[current.rule]) }),
    verdict: successVerdict(current.successRate, language),
    success: current.successRate,
    rules,
    better,
  };
}

/** Domanda 4: quanto costa il portafoglio e quanta imposta pagheresti vendendo. */
export function costsSentences(summary: CostSummary, lostAfterYears: number | null, years: number, liquidation: AnalyticsPlan["liquidation"], currency: string, language: Language = "it"): string[] {
  const { money, pct, t } = textTools(language);
  if (summary.totalValue <= 0) return [t("Non hai ancora investimenti: quando ne avrai, qui vedrai quanto costano.")];
  const out = [
    summary.annualPct !== null
      ? t("Costi dei fondi e bollo: {0} l'anno ({1} del portafoglio).", { 0: money(summary.annualCost, currency), 1: pct(summary.annualPct, 2) })
      : t("Costi dei fondi e bollo: {0} l'anno.", { 0: money(summary.annualCost, currency) }),
  ];
  if (lostAfterYears !== null && lostAfterYears > 0) out.push(t("In {0} anni sono {1} in meno, a parità di rendimento.", { 0: years, 1: money(lostAfterYears, currency) }));
  if (summary.missingTerValue > 0) out.push(t("Per posizioni da {0} manca il costo del fondo: il totale è più basso del reale.", { 0: money(summary.missingTerValue, currency) }));
  if (liquidation.latentTax > 0) out.push(t("Vendendo tutto oggi pagheresti circa {0} di imposte sulle plusvalenze.", { 0: money(liquidation.latentTax, currency) }));
  return out;
}
