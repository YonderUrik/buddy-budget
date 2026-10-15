import { MessageCircleQuestionIcon, TargetIcon } from "lucide-react";
import type { SectionTab } from "@/components/domain/shared";

/** Viste di Analitiche: le risposte sul traguardo e gli obiettivi di risparmio. */
export const ANALYTICS_TABS: readonly SectionTab[] = [
  { href: "/analitiche", label: "Risposte", icon: MessageCircleQuestionIcon, description: "Quanto ti serve, quando ci arrivi, quanto dura" },
  { href: "/analitiche/obiettivi", label: "Obiettivi", icon: TargetIcon, description: "Per cosa metti da parte e quando ci arrivi" },
];

/** Inizio degli indirizzi della vista Obiettivi (lista e dettaglio). */
export const GOALS_BASE_PATH = "/analitiche/obiettivi";
