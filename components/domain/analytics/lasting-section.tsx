"use client";

/** Domanda 3, «Il patrimonio reggerà?»: probabilità di durare smettendo oggi, confronto tra regole e rischio. */

import type { MonteCarloResult } from "@/lib/calc/monte-carlo";
import { cn } from "@/lib/utils";
import { MissingData } from "./analytics-card";
import { GlossedText } from "./glossed-text";
import type { GlossaryId } from "./glossary";
import { Term } from "./term";
import { pct } from "./analytics-format";
import { lastingAnswer } from "./plain-answers";
import { QuestionSection } from "./question-section";
import { RiskTab } from "./risk-tab";
import type { QuestionSectionData } from "./section-props";
import { SimulationTab } from "./simulation-tab";
import { WithdrawalTab } from "./withdrawal-tab";

const RULE_TERMS: Record<string, GlossaryId> = { fissa: "regola-fissa", percentuale: "regola-percentuale", "guyton-klinger": "regola-gk", vanguard: "regola-vanguard" };

const TONE_CLASS = { pos: "bg-pos-soft text-pos", neg: "bg-neg-soft text-neg", default: "bg-muted text-foreground" } as const;

export interface LastingSectionProps extends QuestionSectionData {
  /** Confronto tra regole di prelievo già calcolato (lo calcola chi sceglie le ipotesi, così non si rifà due volte); null se manca la spesa. */
  results: MonteCarloResult[] | null;
}

export function LastingSection({ question, base, assumptions, plan, results }: LastingSectionProps) {
  const { currency } = base;
  const answer = results ? lastingAnswer(results, assumptions.rule, assumptions.retirementYears) : null;
  const expert = () => (
    <div className="flex flex-col gap-6">
      <SimulationTab assumptions={assumptions} plan={plan} currency={currency} />
      <WithdrawalTab assumptions={assumptions} plan={plan} currency={currency} />
      <RiskTab base={base} assumedVolatility={assumptions.volatility} />
    </div>
  );
  return (
    <QuestionSection question={question} expertHint="probabilità di successo, regole di prelievo, rischio del portafoglio" renderExpert={expert}>
      {!answer ? (
        <MissingData>Per simulare serve la tua spesa annua. Scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti.</MissingData>
      ) : (
        <>
          <div className="flex flex-col gap-2 text-base leading-relaxed text-muted-foreground">
            <p className="font-heading text-xl font-medium text-foreground">
              <GlossedText text={answer.headline} />
            </p>
            <p>{answer.verdict.text}.</p>
            {answer.better ? (
              <p>
                Cambiando il modo di prelevare la situazione cambia: con la regola «{answer.better.label}» il patrimonio regge nel {pct(answer.better.success, 0)} dei casi.
              </p>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Probabilità di successo per regola di prelievo">
            {answer.rules.map((r) => (
              <li key={r.rule} className={cn("rounded-full px-3 py-1 text-xs font-semibold", r.success >= 0.9 ? TONE_CLASS.pos : r.success >= 0.75 ? TONE_CLASS.default : TONE_CLASS.neg)}>
                <Term id={RULE_TERMS[r.rule]}>{r.label}</Term> · {pct(r.success, 0)}
              </li>
            ))}
          </ul>
          <SimulationTab assumptions={assumptions} plan={plan} currency={currency} compact />
        </>
      )}
    </QuestionSection>
  );
}
