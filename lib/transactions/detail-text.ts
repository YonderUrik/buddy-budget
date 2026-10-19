/**
 * Sentences of the transaction detail, bound to one language: where the transaction came from and who chose its
 * category. Kept out of the components so they can be tested and stay the same wherever the detail opens.
 */

import { localizedCategorizationText } from "@/lib/categorization/origin";
import type { CategorySource } from "@/lib/categorization/category-source";
import { translate, type MessageValues } from "@/lib/localization/messages";
import type { Language } from "@/lib/localization/config";
import type { DetailRule, TransactionOrigin } from "./detail";

/** Text helpers of the detail in `language`. */
export function localizedDetailText(language: Language) {
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
  const { autoOriginDescription } = localizedCategorizationText(language);

  /** Where the transaction came from, in one short sentence. */
  function originText(origin: TransactionOrigin): string {
    switch (origin.kind) {
      case "banca":
        return origin.institution ? tr("Dalla banca collegata, {0}", { 0: origin.institution }) : tr("Dalla banca collegata");
      case "file":
        return origin.format ? tr("Da un file importato, formato «{0}»", { 0: origin.format }) : tr("Da un file importato");
      case "broker":
        return tr("Dall'estratto conto di {0}", { 0: origin.broker });
      case "esempio":
        return tr("Dai dati d'esempio");
      case "manuale":
        return tr("Aggiunto da te");
    }
  }

  /**
   * Who chose the category: one of the user's rules (named when it still matches), the bank's category in an imported file
   * (`bankCategory` quotes it), the app from past choices or the AI, or the user. Null when nothing is known (transactions from before the origin was tracked) or there is no category
   * yet, since its name «Da categorizzare» already says so.
   */
  function categoryOriginText(source: CategorySource | null, confidence: number | null, rule: DetailRule | null, uncategorized: boolean, bankCategory: string | null = null): string | null {
    if (uncategorized) return null;
    if (source === "utente") return tr("Scelta da te");
    if (source === "regola") {
      if (!rule) return autoOriginDescription("regola", null);
      return rule.matchType === "contains"
        ? tr("Messa dalla tua regola: il testo contiene «{0}»", { 0: rule.pattern })
        : tr("Messa dalla tua regola per «{0}»", { 0: rule.pattern });
    }
    if (source === "banca") return autoOriginDescription("banca", null, bankCategory);
    if (source === "storico" || source === "assistente") return autoOriginDescription(source, confidence);
    return null;
  }

  /** «12 movimenti nell'ultimo anno» for the same-merchant summary. */
  function merchantCountText(count: number): string {
    return tr("{0} movimenti nell'ultimo anno", { 0: count });
  }

  return { originText, categoryOriginText, merchantCountText };
}

/** Long date in `locale` with the weekday («lunedì 13 ottobre 2026»), from a YYYY-MM-DD day. */
export function longDateWithWeekday(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(year, month - 1, day));
}
