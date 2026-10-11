import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import type { AnalyticsQuestion } from "./analytics-questions";

/** Dati comuni alle quattro sezioni di Analitiche. */
export interface QuestionSectionData {
  question: AnalyticsQuestion;
  base: AnalyticsBase;
  /** Ipotesi in uso: quelle salvate con sopra i valori dei cursori. */
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  /** Ipotesi e piano salvati, se i cursori li hanno cambiati: le sezioni li mostrano a confronto. */
  baseline?: { assumptions: AnalyticsAssumptions; plan: AnalyticsPlan };
}
