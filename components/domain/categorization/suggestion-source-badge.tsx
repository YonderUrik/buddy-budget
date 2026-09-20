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
    <div className="flex flex-col gap-0.5">
      <Badge variant="secondary" className="w-fit">
        {SOURCE_LABELS[suggestion.source]} · {confidencePercentage}%
      </Badge>
      <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
    </div>
  );
}
