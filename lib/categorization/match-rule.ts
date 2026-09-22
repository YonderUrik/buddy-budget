import type { CategoryType } from "@/lib/categories/groups";

export interface RuleCandidate {
  id: string;
  matchType: "merchant" | "contains";
  pattern: string;
  categoryId: string;
  categoryType: CategoryType;
  categoryIsFallback: boolean;
  splitPercentage: number | null;
  createdAt: Date;
}

/**
 * Una categoria è utilizzabile per una transazione solo se la sua direzione coincide: le categorie
 * `entrata` valgono per gli importi positivi, le altre per i negativi. La categoria fallback non ha
 * direzione propria e accoglie entrambi i segni — stesso invariante imposto da PATCH /api/transactions/[id].
 */
export function isDirectionCompatible(
  categoryType: CategoryType,
  isIncome: boolean,
  isFallback: boolean
): boolean {
  if (isFallback) return true;
  return (categoryType === "entrata") === isIncome;
}

/**
 * Regola vincente per una chiave merchant, valutando prima le regole `merchant` sulla corrispondenza
 * esatta e poi le `contains` come sottostringa (a più match vince il pattern più lungo, cioè il più
 * specifico; a pari lunghezza la regola più recente). Le regole incompatibili con la direzione della
 * transazione vengono saltate senza interrompere la valutazione. `null` se nessuna regola si applica.
 */
export function selectMatchingRule(
  key: string,
  isIncome: boolean,
  rules: RuleCandidate[]
): RuleCandidate | null {
  const usable = rules.filter((rule) =>
    isDirectionCompatible(rule.categoryType, isIncome, rule.categoryIsFallback)
  );

  const exact = usable.find((rule) => rule.matchType === "merchant" && rule.pattern === key);
  if (exact) return exact;

  const containsMatches = usable.filter(
    (rule) => rule.matchType === "contains" && rule.pattern.length > 0 && key.includes(rule.pattern)
  );
  if (containsMatches.length === 0) return null;

  return containsMatches.reduce((best, candidate) => {
    if (candidate.pattern.length !== best.pattern.length) {
      return candidate.pattern.length > best.pattern.length ? candidate : best;
    }
    return candidate.createdAt > best.createdAt ? candidate : best;
  });
}
