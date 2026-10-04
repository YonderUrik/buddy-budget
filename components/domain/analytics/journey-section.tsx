"use client";

/** Domanda 1, «Quanta strada ho fatto?»: patrimonio contro numero FIRE e da dove viene la crescita recente. */

import { splitGrowth } from "@/lib/calc/growth-split";
import { Metric } from "./analytics-card";
import { money, pct } from "./analytics-format";
import { GrowthTab } from "./growth-tab";
import { journeySentences } from "./plain-answers";
import { QuestionSection } from "./question-section";
import type { QuestionSectionData } from "./section-props";

export function JourneySection({ question, index, base, plan }: QuestionSectionData) {
  const { currency } = base;
  const split = splitGrowth(base.growthPoints);
  const sentences = journeySentences(plan, split.rows.length >= 2 ? split : null, currency);
  const progress = Math.min(plan.progress ?? 0, 1);
  return (
    <QuestionSection question={question} index={index} expertHint="da dove arriva la crescita, mese per mese" renderExpert={() => <GrowthTab base={base} />}>
      <div className="flex flex-col gap-1 text-base leading-relaxed text-muted-foreground">
        {sentences.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
      {plan.target !== null ? (
        <div className="flex flex-col gap-2">
          <div role="progressbar" aria-label="Avanzamento verso il numero FIRE" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>0</span>
            <span>{money(plan.target, currency)}</span>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Il tuo patrimonio" value={money(plan.wealth, currency)} />
        <Metric label="Numero FIRE" value={plan.target !== null ? money(plan.target, currency) : "—"} sub={plan.taxShare > 0 && plan.fireNumberGross ? `${money(plan.fireNumberGross, currency)} prima delle imposte` : undefined} />
        <Metric
          label="Ti mancano"
          value={plan.target !== null ? money(Math.max(plan.target - plan.wealth, 0), currency) : "—"}
          tone={plan.target !== null && plan.wealth >= plan.target ? "pos" : "default"}
          sub={plan.progress !== null ? `hai fatto il ${pct(plan.progress, 0)}` : undefined}
        />
      </div>
    </QuestionSection>
  );
}
