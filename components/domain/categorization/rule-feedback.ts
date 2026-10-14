"use client";
import { useLocalization } from "@/lib/localization/provider";
import { translate, type MessageValues } from "@/lib/localization/messages";
import type { Language } from "@/lib/localization/config";

import * as React from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { SavedRule } from "@/lib/queries/categorization";
import { useRecategorizeActions } from "./use-recategorize";

/** L'avviso che propone di cambiare i movimenti passati resta finché l'utente non sceglie: non sparisce da solo. */
const PAST_MATCHES_TOAST_DURATION_MS = Number.POSITIVE_INFINITY;

function appliedText(applied: number, language: Language = "it"): string {
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
  return applied === 1 ? tr("Regola applicata subito a un movimento da categorizzare") : tr("Regola applicata subito a {0} movimenti da categorizzare", {0: applied});
}

function pastMatchesText(count: number, language: Language = "it"): string {
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
  return count === 1
    ? tr("Vale anche per un movimento passato, che oggi ha un'altra categoria. Lo cambio?")
    : tr("Vale anche per {0} movimenti passati, che oggi hanno un'altra categoria. Li cambio?", {0: count});
}

/**
 * Avviso dopo il salvataggio di una regola: quanti movimenti «Da categorizzare» ha già sistemato e, se la regola ne
 * prenderebbe anche di già categorizzati (non da te), una domanda che resta finché non si sceglie: «Cambiali»
 * (con «Annulla» dopo) o «Lasciali così».
 * `appliedMessage` sostituisce la frase sui movimenti sistemati (in Movimenti nomina la categoria).
 */
export function useRuleSavedFeedback() {
  const { t: tr, language } = useLocalization();
  const { run } = useRecategorizeActions();
  return React.useCallback(
    (rule: SavedRule, appliedMessage?: string) => {
      const applied = rule.applied > 0 ? appliedMessage ?? appliedText(rule.applied, language) : null;
      if (rule.pastMatches > 0) {
        track("recategorize_previewed", { scope: "regola", changes: rule.pastMatches });
        toast(applied ?? tr("Regola salvata"), {
          description: pastMatchesText(rule.pastMatches, language),
          action: { label: rule.pastMatches === 1 ? tr("Cambialo") : tr("Cambiali"), onClick: () => run({ scope: "regola", ruleId: rule.id }) },
          cancel: { label: rule.pastMatches === 1 ? tr("Lascialo così") : tr("Lasciali così"), onClick: () => {} },
          duration: PAST_MATCHES_TOAST_DURATION_MS,
        });
        return;
      }
      if (applied) toast.success(applied);
    },
    [language, run, tr]
  );
}
