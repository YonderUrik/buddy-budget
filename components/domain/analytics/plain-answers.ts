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
import { formatYears, money, pct } from "./analytics-format";

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

/** Giudizio a parole sulla probabilità di successo: serve a leggere il numero, non a promettere. */
export function successVerdict(success: number): { text: string; tone: Tone } {
  if (success >= 0.9) return { text: "Solida: regge nella grande maggioranza degli scenari", tone: "pos" };
  if (success >= 0.75) return { text: "Discreta: nei casi sfortunati servirebbe tagliare le spese", tone: "default" };
  return { text: "Fragile: in troppi scenari il patrimonio finisce prima", tone: "neg" };
}

/** Domanda 1: a che punto sei e da dove viene la crescita recente. */
export function journeySentences(plan: AnalyticsPlan, split: GrowthSplit | null, currency: string, withdrawalRate?: number): string[] {
  const out: string[] = [];
  if (plan.target !== null) {
    out.push(`Hai ${money(plan.wealth, currency)} su ${money(plan.target, currency)} necessari: ${pct(Math.min(plan.progress ?? 0, 9.99), 0)} del percorso.`);
  } else {
    out.push(`Hai ${money(plan.wealth, currency)}. Per sapere quanto ti serve indica la spesa annua nelle ipotesi.`);
  }
  if (plan.target !== null && plan.spending !== null && withdrawalRate !== undefined) {
    out.push(`Il numero FIRE è la tua spesa annua (${money(plan.spending, currency)}) divisa per il tasso di prelievo (${pct(withdrawalRate)}).`);
  }
  if (split && split.rows.length >= 2) {
    const share = split.savingsShare;
    out.push(
      share !== null
        ? `Negli ultimi 12 mesi il patrimonio è cresciuto di ${money(split.totalDelta, currency)}: ${pct(share, 0)} grazie al tuo risparmio, il resto dal mercato.`
        : `Negli ultimi 12 mesi il patrimonio è variato di ${money(split.totalDelta, currency)}.`
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
export function timelineScenarios(plan: AnalyticsPlan, a: AnalyticsAssumptions, currency: string): TimelineScenario[] {
  const base = plan.yearsToFire;
  const mk = (label: string, years: number | null): TimelineScenario => ({ label, years, yearsSaved: base !== null && years !== null ? base - years : null });
  return [
    mk(`Spendendo il ${pct(SPENDING_CUT, 0)} in meno`, yearsWithChanges(plan, a, { spending: -SPENDING_CUT })),
    mk(`Risparmiando ${money(SAVING_BOOST_ANNUAL / 12, currency)} in più al mese`, yearsWithChanges(plan, a, { saving: SAVING_BOOST_ANNUAL })),
  ];
}

/** Titolo della domanda 2: quando arrivi, in una riga. */
export function timelineHeadline(plan: AnalyticsPlan, today: Date): string {
  if (plan.target === null) return "Per stimare quando arrivi serve la tua spesa annua.";
  if (plan.yearsToFire === 0) return "Hai già raggiunto il numero FIRE.";
  if (plan.yearsToFire === null) return "Con questi numeri il traguardo è oltre 80 anni lontano: serve più risparmio o meno spesa.";
  return `Intorno al ${today.getFullYear() + Math.ceil(plan.yearsToFire)}, tra ${formatYears(plan.yearsToFire)}.`;
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
  headline: string;
  verdict: ReturnType<typeof successVerdict>;
  success: number;
  rules: { rule: WithdrawalRule; label: string; success: number }[];
  /** Regola con più probabilità di successo, se diversa da quella scelta. */
  better: { label: string; success: number } | null;
}

/** Domanda 3: il patrimonio dura? Parte dai risultati del confronto tra regole (smettendo oggi). */
export function lastingAnswer(results: MonteCarloResult[], selected: WithdrawalRule, retirementYears: number): LastingAnswer | null {
  const current = results.find((r) => r.rule === selected) ?? results[0];
  if (!current) return null;
  const rules = results.map((r) => ({ rule: r.rule, label: RULE_SHORT_NAMES[r.rule], success: r.successRate }));
  const best = [...rules].sort((a, b) => b.success - a.success)[0];
  const better = best.rule !== current.rule && best.success > current.successRate + 0.005 ? { label: best.label, success: best.success } : null;
  return {
    headline: `Se smettessi oggi, il patrimonio dura ${retirementYears} anni nel ${pct(current.successRate, 0)} degli scenari simulati (regola: ${RULE_SHORT_NAMES[current.rule]}).`,
    verdict: successVerdict(current.successRate),
    success: current.successRate,
    rules,
    better,
  };
}

/** Domanda 4: quanto costa il portafoglio e quanta imposta pagheresti vendendo. */
export function costsSentences(summary: CostSummary, lostAfterYears: number | null, years: number, liquidation: AnalyticsPlan["liquidation"], currency: string): string[] {
  if (summary.totalValue <= 0) return ["Non hai ancora investimenti: quando ne avrai, qui vedrai quanto costano."];
  const out = [
    `Costi dei fondi e bollo: ${money(summary.annualCost, currency)} l'anno${summary.annualPct !== null ? ` (${pct(summary.annualPct, 2)} del portafoglio)` : ""}.`,
  ];
  if (lostAfterYears !== null && lostAfterYears > 0) out.push(`In ${years} anni sono ${money(lostAfterYears, currency)} in meno, a parità di rendimento.`);
  if (summary.missingTerValue > 0) out.push(`Per posizioni da ${money(summary.missingTerValue, currency)} manca il costo del fondo: il totale è più basso del reale.`);
  if (liquidation.latentTax > 0) out.push(`Vendendo tutto oggi pagheresti circa ${money(liquidation.latentTax, currency)} di imposte sulle plusvalenze.`);
  return out;
}
