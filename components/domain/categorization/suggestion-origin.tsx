"use client";
import { useLocalization } from "@/lib/localization/provider";
/**
 * Da dove viene una categoria, sempre nello stesso modo: icona dell'origine (regola, le tue scelte, AI, banca) e una frase.
 * La sicurezza in percentuale sta solo nel tooltip: a chi non è esperto non dice nulla. `SuggestionOrigin` per le
 * proposte da decidere, `AutoOriginBadge` per quelle messe dall'app.
 */

import type { LucideIcon } from "lucide-react";
import { BookmarkCheckIcon, HistoryIcon, LandmarkIcon, SparklesIcon } from "lucide-react";
import { AUTO_APPLY_THRESHOLD, type CategorizeSuggestion } from "@/lib/categorization/suggest";
import { localizedCategorizationText, type CategoryOrigin } from "@/lib/categorization/origin";
import { cn } from "@/lib/utils";

/** Icona di ogni origine: la stessa in carte, elenco, «Messe dall'app» e Movimenti. */
export const ORIGIN_ICONS: Record<CategoryOrigin, LucideIcon> = {
  regola: BookmarkCheckIcon,
  storico: HistoryIcon,
  assistente: SparklesIcon,
  banca: LandmarkIcon,
};

export interface SuggestionOriginProps {
  suggestion: CategorizeSuggestion;
  /** Allineamento del testo: al centro sulle carte, a sinistra nelle righe. */
  align?: "start" | "center";
  className?: string;
}

/** Perché si propone questa categoria, in una frase (la sicurezza è nel tooltip). */
export function SuggestionOrigin({ suggestion, align = "start", className }: SuggestionOriginProps) {
  const { confidencePercent, suggestionOriginText } = localizedCategorizationText(useLocalization().language);

  const { t: tr } = useLocalization();
  const Icon = ORIGIN_ICONS[suggestion.source];
  const percent = confidencePercent(suggestion.confidence);
  const threshold = confidencePercent(AUTO_APPLY_THRESHOLD);
  return (
    <p
      className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", align === "center" ? "justify-center text-center" : "justify-start", className)}
      title={tr("Sicura al {0}%: dal {1}% l'app la mette da sola.", {0: percent, 1: threshold})}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{suggestionOriginText(suggestion)}</span>
    </p>
  );
}

export interface AutoOriginBadgeProps {
  source: CategoryOrigin;
  confidence: number | null;
  /** For `banca`: the label the bank wrote in the file, quoted in the tooltip. */
  bankCategory?: string | null;
  /** Solo l'icona (righe fitte come Movimenti); il resto è nel tooltip e per i lettori di schermo. */
  compact?: boolean;
  className?: string;
}

/** Etichetta di una categoria messa dall'app: «Regola», «Le tue scelte», «AI», «Banca» (compatta: solo l'icona). */
export function AutoOriginBadge({ source, confidence, bankCategory, compact = false, className }: AutoOriginBadgeProps) {
  const { autoOriginDescription, autoOriginLabel } = localizedCategorizationText(useLocalization().language);

  const { t: tr } = useLocalization();
  const Icon = ORIGIN_ICONS[source];
  const label = compact ? null : autoOriginLabel(source);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-text-2", className)} title={autoOriginDescription(source, confidence, bankCategory)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{autoOriginDescription(source, confidence, bankCategory)}</span>
      {label ? <span aria-hidden="true">{tr(label)}</span> : null}
    </span>
  );
}
