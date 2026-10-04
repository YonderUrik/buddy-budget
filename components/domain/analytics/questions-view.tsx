"use client";

/** Corpo di Analitiche: indice delle domande e le quattro sezioni, dalla più semplice alla più tecnica. */

import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { ANALYTICS_QUESTIONS } from "./analytics-questions";
import { CostsSection } from "./costs-section";
import { JourneySection } from "./journey-section";
import { LastingSection } from "./lasting-section";
import { QuestionNav } from "./question-nav";
import { TimelineSection } from "./timeline-section";

export interface QuestionsViewProps {
  base: AnalyticsBase;
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  saving: boolean;
  saveError: string | null;
  onSaveTer: (terByInstrument: Record<string, number>) => Promise<void>;
}

export function QuestionsView({ base, assumptions, plan, saving, saveError, onSaveTer }: QuestionsViewProps) {
  const [journey, timeline, lasting, costs] = ANALYTICS_QUESTIONS;
  const shared = { base, assumptions, plan };
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <QuestionNav questions={ANALYTICS_QUESTIONS} />
      <div className="flex min-w-0 flex-col gap-8">
        <JourneySection question={journey} index={1} {...shared} />
        <TimelineSection question={timeline} index={2} {...shared} />
        <LastingSection question={lasting} index={3} {...shared} />
        <CostsSection question={costs} index={4} {...shared} saving={saving} error={saveError} onSaveTer={onSaveTer} />
      </div>
    </div>
  );
}
