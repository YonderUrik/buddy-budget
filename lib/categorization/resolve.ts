import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { merchantKey } from "./merchant-key";
import { selectMatchingRule, type RuleCandidate } from "./match-rule";

export interface ResolvedCategorization {
  categoryId: string;
  excludedAmount: number;
  ruleId: string;
}

/** Regole dell'utente con i dati di categoria necessari al guard di direzione. */
async function loadRuleCandidates(userId: string): Promise<RuleCandidate[]> {
  const rows = await db
    .select({
      id: categorizationRules.id,
      matchType: categorizationRules.matchType,
      pattern: categorizationRules.pattern,
      categoryId: categorizationRules.categoryId,
      categoryType: categories.type,
      categoryIsFallback: categories.isFallback,
      splitPercentage: categorizationRules.splitPercentage,
      createdAt: categorizationRules.createdAt,
    })
    .from(categorizationRules)
    .innerJoin(categories, eq(categorizationRules.categoryId, categories.id))
    .where(eq(categorizationRules.userId, userId));

  return rows.map((row) => ({
    ...row,
    splitPercentage: row.splitPercentage === null ? null : Number(row.splitPercentage),
  }));
}

export interface RuleResolver {
  /** Risolve una transazione in memoria, senza toccare il DB. */
  resolve(input: { description: string; amount: number }): ResolvedCategorization | null;
  /** Ids delle regole che hanno agito, nell'ordine in cui hanno vinto (con ripetizioni). */
  appliedRuleIds(): string[];
}

/**
 * Risolutore che carica le regole dell'utente **una sola volta** e poi lavora in memoria: pensato per
 * il loop di import, dove una query per transazione degraderebbe il sync in modo lineare col numero di
 * movimenti. Gli incrementi di `hitCount` non vengono scritti qui: si accumulano e si applicano in un
 * solo update finale con `flushRuleHits`.
 */
export async function buildRuleResolver(userId: string): Promise<RuleResolver> {
  const rules = await loadRuleCandidates(userId);
  const applied: string[] = [];

  return {
    resolve(input) {
      if (rules.length === 0) return null;
      const rule = selectMatchingRule(merchantKey(input.description), input.amount > 0, rules);
      if (!rule) return null;

      applied.push(rule.id);
      const magnitude =
        rule.splitPercentage === null
          ? 0
          : Math.round(Math.abs(input.amount) * rule.splitPercentage * 100) / 100;

      return {
        categoryId: rule.categoryId,
        excludedAmount: magnitude === 0 ? 0 : input.amount >= 0 ? magnitude : -magnitude,
        ruleId: rule.id,
      };
    },
    appliedRuleIds: () => applied,
  };
}

/** Scrive in un solo update per regola gli utilizzi accumulati durante un import. */
export async function flushRuleHits(ruleIds: string[]): Promise<void> {
  if (ruleIds.length === 0) return;
  const countById = new Map<string, number>();
  for (const id of ruleIds) countById.set(id, (countById.get(id) ?? 0) + 1);

  const now = new Date();
  for (const [id, count] of countById) {
    await db
      .update(categorizationRules)
      .set({ hitCount: sql`${categorizationRules.hitCount} + ${count}`, lastAppliedAt: now })
      .where(eq(categorizationRules.id, id));
  }
}

/**
 * Variante a chiamata singola, per i contesti fuori dal loop di import (una transazione sola, test).
 * Dentro un ciclo usa sempre `buildRuleResolver`: questa funzione interroga il DB a ogni invocazione.
 */
export async function resolveCategorization(
  userId: string,
  input: { description: string; amount: number }
): Promise<ResolvedCategorization | null> {
  const resolver = await buildRuleResolver(userId);
  const resolved = resolver.resolve(input);
  await flushRuleHits(resolver.appliedRuleIds());
  return resolved;
}
