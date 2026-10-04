import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import type { AnalyticsQuestion } from "./analytics-questions";

/** Dati comuni alle quattro sezioni di Analitiche. */
export interface QuestionSectionData {
  question: AnalyticsQuestion;
  /** Numero d'ordine (1-based). */
  index: number;
  base: AnalyticsBase;
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
}
