"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Domanda 4, «Quanto mi costa il portafoglio?»: costi annui, erosione nel tempo e imposta se vendessi tutto. */

import { costDrag, summarizeCosts } from "@/lib/calc/costs";
import { Metric } from "./analytics-card";
import { GlossedText } from "./glossed-text";
import { localizedAnalyticsFormats } from "./analytics-format";
import { CostsTab } from "./costs-tab";
import { costsSentences } from "./plain-answers";
import { QuestionSection } from "./question-section";
import type { QuestionSectionData } from "./section-props";

/** Orizzonte (anni) su cui si misura quanto erodono i costi. */
const COST_DRAG_YEARS = 30;

export interface CostsSectionProps extends QuestionSectionData {
  saving: boolean;
  error: string | null;
  onSaveTer: (terByInstrument: Record<string, number>) => Promise<void>;
}

export function CostsSection({ question, base, assumptions, plan, saving, error, onSaveTer }: CostsSectionProps) {
  const { money, pct } = localizedAnalyticsFormats(useLocalization().language);

  const { t: tr, productCountry, language, features } = useLocalization();
  const { currency } = base;
  const summary = summarizeCosts(base.positions.map((p) => ({ ...p, ter: assumptions.terByInstrument[p.id] ?? null })), productCountry);
  const drag = summary.annualPct !== null ? costDrag(summary.totalValue, assumptions.expectedReturn, summary.annualPct, COST_DRAG_YEARS) : [];
  const sentences = costsSentences(summary, drag.at(-1)?.lost ?? null, COST_DRAG_YEARS, plan.liquidation, currency, language);
  return (
    <QuestionSection
      question={question}

      expertHint="costo di ogni fondo (TER), erosione, imposte"
      renderExpert={() => <CostsTab base={base} assumptions={assumptions} plan={plan} saving={saving} error={error} onSaveTer={onSaveTer} />}
    >
      <div className="flex flex-col gap-1 text-base leading-relaxed text-muted-foreground">
        {sentences.map((s) => (
          <p key={s}>
            <GlossedText text={s} />
          </p>
        ))}
      </div>
      {summary.totalValue > 0 ? (
        <div className={features.taxes ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
          <Metric term="ter" label={tr("Costo annuo")} value={money(summary.annualCost, currency)} sub={summary.annualPct !== null ? tr("{0} del portafoglio", {0: pct(summary.annualPct, 2)}) : undefined} />
          <Metric term="erosione" label={tr("Persi in {0} anni", {0: COST_DRAG_YEARS})} value={drag.length ? money(drag.at(-1)!.lost, currency) : "—"} tone="neg" sub="a parità di rendimento" />
          {features.taxes ? <Metric term="imposte-latenti" label={tr("Imposte se vendessi tutto")} value={money(plan.liquidation.latentTax, currency)} sub={plan.liquidation.taxRatio !== null ? tr("{0} del valore", {0: pct(plan.liquidation.taxRatio)}) : undefined} /> : null}
        </div>
      ) : null}
    </QuestionSection>
  );
}
