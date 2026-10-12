/**
 * Da dove viene una categoria, sempre nello stesso modo: icona dell'origine (regola, le tue scelte, AI), una frase e
 * quanto è sicura. `SuggestionOrigin` per le proposte da decidere, `AutoOriginBadge` per quelle applicate da sole.
 */

import type { LucideIcon } from "lucide-react";
import { BookmarkCheckIcon, HistoryIcon, SparklesIcon } from "lucide-react";
import { AUTO_APPLY_THRESHOLD, type CategorizeSuggestion } from "@/lib/categorization/suggest";
import { autoOriginDescription, autoOriginLabel, confidencePercent, suggestionOriginText, type CategoryOrigin } from "@/lib/categorization/origin";
import { cn } from "@/lib/utils";

/** Icona di ogni origine: la stessa in carte, elenco, «Fatte da sole» e Movimenti. */
export const ORIGIN_ICONS: Record<CategoryOrigin, LucideIcon> = {
  regola: BookmarkCheckIcon,
  storico: HistoryIcon,
  assistente: SparklesIcon,
};

export interface SuggestionOriginProps {
  suggestion: CategorizeSuggestion;
  /** Allineamento del testo: al centro sulle carte, a sinistra nelle righe. */
  align?: "start" | "center";
  className?: string;
}

/** Perché si propone questa categoria e quanto è sicura (con la soglia del 90% sotto la quale serve una conferma). */
export function SuggestionOrigin({ suggestion, align = "start", className }: SuggestionOriginProps) {
  const Icon = ORIGIN_ICONS[suggestion.source];
  const percent = confidencePercent(suggestion.confidence);
  const threshold = confidencePercent(AUTO_APPLY_THRESHOLD);
  return (
    <div className={cn("flex flex-col gap-1.5 text-xs text-muted-foreground", align === "center" ? "items-center text-center" : "items-start", className)}>
      <p className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{suggestionOriginText(suggestion)}</span>
      </p>
      <div className="flex items-center gap-2" title={`Sicura al ${percent}%. Dal ${threshold}% si applica da sola.`}>
        <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
          <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${percent}%` }} />
          <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${threshold}%` }} />
        </span>
        <span className="tabular-nums">Sicura al {percent}%</span>
      </div>
    </div>
  );
}

export interface AutoOriginBadgeProps {
  source: CategoryOrigin;
  confidence: number | null;
  /** Solo icona e percentuale (righe fitte come Movimenti); il resto è nel tooltip e per i lettori di schermo. */
  compact?: boolean;
  className?: string;
}

/** Etichetta di una categoria applicata da sola: «Regola», «AI · 96%», «Le tue scelte · 100%» (compatta: icona e «96%»). */
export function AutoOriginBadge({ source, confidence, compact = false, className }: AutoOriginBadgeProps) {
  const Icon = ORIGIN_ICONS[source];
  const label = compact ? (confidence === null || source === "regola" ? null : `${confidencePercent(confidence)}%`) : autoOriginLabel(source, confidence);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-text-2", className)} title={autoOriginDescription(source, confidence)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{autoOriginDescription(source, confidence)}</span>
      {label ? <span aria-hidden="true">{label}</span> : null}
    </span>
  );
}
