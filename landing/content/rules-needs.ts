/**
 * What on the landing needs Italian rules, in one place: catalog features and app screens that only make sense with
 * the Italian pension fund or a country's tax rules, and the one-line notes shown instead. The blocks themselves carry
 * `data-needs` (`lib/visitor-country.ts`); the catalog is generated from the app, so it is tagged here, not there.
 */
import type { Locale } from "@/lib/i18n";
import { hiddenIn, RULES_VARIANTS, type ByRules, type RuleNeed, type RulesNoteText } from "@/lib/visitor-country";
import type { ScreenId } from "./screens";

/** Catalog features (by id) that need Italian rules: the catalog is generated from the app, so it is filtered at render time. */
export const FEATURE_NEEDS: Readonly<Record<string, RuleNeed>> = {
  "tasse-italiane": "taxes",
  "simulatore-prima-di-vendere": "taxes",
  "pianificazione-germania": "taxes",
  pensione: "pension",
  analitiche: "pension",
};

/** App screens of the gallery that show Italian taxes, the pension fund or the retirement simulators. */
export const SCREEN_NEEDS: Partial<Record<ScreenId, RuleNeed>> = {
  tasse: "taxes",
  pensione: "pension",
  "pensione-scenari": "pension",
  analitiche: "pension",
};

/** The notes, per language: the home (pension, and taxes too where no rules exist) and the tax blocks alone. */
export const RULES_NOTES: Record<Locale, { home: RulesNoteText; taxes: RulesNoteText }> = {
  it: {
    home: { de: "Il fondo pensione con le regole del tuo paese arriverà presto.", none: "Tasse e fondo pensione con le regole del tuo paese arriveranno presto." },
    taxes: { none: "Le tasse con le regole del tuo paese arriveranno presto." },
  },
  en: {
    home: { de: "Pension fund with your country's rules is coming soon.", none: "Taxes and pension fund with your country's rules are coming soon." },
    taxes: { none: "Taxes with your country's rules are coming soon." },
  },
};

/** How many of `items` each variant shows, as a `ByRules` number. */
export function countByRules<T>(items: readonly T[], needsOf: (item: T) => RuleNeed | undefined): ByRules {
  const [full, de, none] = RULES_VARIANTS.map((v) => String(items.filter((item) => !hiddenIn(needsOf(item), v)).length));
  return { full, de, none };
}
