/** Badge dell'origine di una proposta di categorizzazione, con percentuale di confidenza e motivo. */

import { Badge } from "@/components/ui/badge";
import type { CategorizeSuggestion } from "@/lib/categorization/suggest";

const SOURCE_LABELS: Record<CategorizeSuggestion["source"], string> = {
  regola: "Regola simile",
  storico: "Storico",
  assistente: "Assistente",
};

export interface SuggestionSourceBadgeProps {
  suggestion: CategorizeSuggestion;
}

export function SuggestionSourceBadge({ suggestion }: SuggestionSourceBadgeProps) {
  const confidencePercentage = Math.round(suggestion.confidence * 100);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <Badge variant="secondary" className="shrink-0">
        {SOURCE_LABELS[suggestion.source]} · {confidencePercentage}%
      </Badge>
      <span className="min-w-0">{suggestion.reason}</span>
    </p>
  );
}
