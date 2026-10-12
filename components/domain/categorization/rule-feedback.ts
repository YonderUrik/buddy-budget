"use client";

import * as React from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { SavedRule } from "@/lib/queries/categorization";
import { useRecategorizeActions } from "./use-recategorize";

/** Quanto resta in vista l'avviso che propone di cambiare anche i movimenti passati. */
const PAST_MATCHES_TOAST_DURATION_MS = 12_000;

function appliedText(applied: number): string {
  return applied === 1 ? "Regola applicata subito a un movimento da categorizzare" : `Regola applicata subito a ${applied} movimenti da categorizzare`;
}

function pastMatchesText(count: number): string {
  return count === 1 ? "Con questa regola, un movimento passato cambierebbe categoria." : `Con questa regola, ${count} movimenti passati cambierebbero categoria.`;
}

/**
 * Avviso dopo il salvataggio di una regola: quanti movimenti «Da categorizzare» ha già sistemato e, se la regola ne
 * prenderebbe anche di già categorizzati (non da te), il pulsante per cambiarli subito, con «Annulla» dopo.
 * `appliedMessage` sostituisce la frase sui movimenti sistemati (in Movimenti nomina la categoria).
 */
export function useRuleSavedFeedback() {
  const { run } = useRecategorizeActions();
  return React.useCallback(
    (rule: SavedRule, appliedMessage?: string) => {
      const applied = rule.applied > 0 ? appliedMessage ?? appliedText(rule.applied) : null;
      if (rule.pastMatches > 0) {
        track("recategorize_previewed", { scope: "regola", changes: rule.pastMatches });
        toast(applied ?? "Regola salvata", {
          description: pastMatchesText(rule.pastMatches),
          action: { label: rule.pastMatches === 1 ? "Cambialo" : "Cambiali", onClick: () => run({ scope: "regola", ruleId: rule.id }) },
          duration: PAST_MATCHES_TOAST_DURATION_MS,
        });
        return;
      }
      if (applied) toast.success(applied);
    },
    [run]
  );
}
