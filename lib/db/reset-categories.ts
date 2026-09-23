/**
 * Reset one-shot delle categorie di ogni utente alla lista DEFAULT_CATEGORIES a gruppi di spesa
 * (spec 2026-09-22-categorie-gruppi-spesa). Le categorie di default (anche con nome legacy) vengono
 * aggiornate preservandone l'id; le altre (personalizzate incluse) eliminate con transazioni spostate
 * sulla fallback e budget/regole rimossi. Idempotente. Richiede l'enum già migrato
 * (`pnpm db:migrate-category-groups`). Esecuzione: `pnpm db:reset-categories [--dry-run]`.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { categories, DEFAULT_CATEGORIES, LEGACY_CATEGORY_NAMES } from "./schema/categories";
import { transactions } from "./schema/transactions";
import { budgets } from "./schema/budgets";
import { categorizationRules } from "./schema/categorization-rules";
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import type { CategoryType } from "@/lib/categories/groups";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export interface ExistingCategory {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  isFallback: boolean;
}

export interface ResetDefault {
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
  isFallback?: boolean;
}

export interface CategoryUpdate {
  id: string;
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
}

export interface CategoryResetPlan {
  updates: CategoryUpdate[];
  creates: ResetDefault[];
  /** Id di categorie non-fallback da eliminare. */
  deletions: string[];
}

/** Decide, senza toccare il DB, come portare le categorie di un utente alla lista di default. */
export function planCategoryReset(
  existing: ExistingCategory[],
  defaults: ResetDefault[],
  legacyNames: Record<string, string>
): CategoryResetPlan {
  const candidates = existing.filter((category) => !category.isFallback);
  const claimed = new Set<string>();
  const plan: CategoryResetPlan = { updates: [], creates: [], deletions: [] };

  for (const target of defaults.filter((d) => !d.isFallback)) {
    const match =
      candidates.find((c) => !claimed.has(c.id) && c.name === target.name) ??
      candidates.find((c) => !claimed.has(c.id) && legacyNames[c.name] === target.name);
    if (!match) {
      plan.creates.push(target);
      continue;
    }
    claimed.add(match.id);
    const unchanged =
      match.name === target.name && match.type === target.type && match.icon === target.icon && match.color === target.color;
    if (!unchanged) {
      plan.updates.push({ id: match.id, name: target.name, type: target.type, icon: target.icon, color: target.color });
    }
  }

  plan.deletions = candidates.filter((c) => !claimed.has(c.id)).map((c) => c.id);
  return plan;
}

export interface CategoryResetSummary {
  updated: number;
  created: number;
  deleted: number;
  reassignedTransactions: number;
}

/**
 * Applica il piano di reset per un utente in un'unica transazione. Ordine: riassegna le transazioni delle
 * categorie da eliminare alla fallback, elimina budget e regole, elimina le categorie (liberando i nomi),
 * poi aggiorna e crea. Con `dryRun` calcola solo il riepilogo.
 */
export async function resetUserCategories(userId: string, { dryRun }: { dryRun: boolean }): Promise<CategoryResetSummary> {
  const fallbackId = dryRun ? null : await getFallbackCategoryId(userId);
  const existing = await db.select().from(categories).where(eq(categories.userId, userId));
  const plan = planCategoryReset(existing, DEFAULT_CATEGORIES, LEGACY_CATEGORY_NAMES);

  const affected =
    plan.deletions.length === 0
      ? []
      : await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(and(eq(transactions.userId, userId), inArray(transactions.categoryId, plan.deletions)));

  const summary: CategoryResetSummary = {
    updated: plan.updates.length,
    created: plan.creates.length,
    deleted: plan.deletions.length,
    reassignedTransactions: affected.length,
  };
  if (dryRun || fallbackId === null) return summary;

  await db.transaction(async (tx) => {
    if (plan.deletions.length > 0) {
      await tx
        .update(transactions)
        .set({ categoryId: fallbackId })
        .where(and(eq(transactions.userId, userId), inArray(transactions.categoryId, plan.deletions)));
      await tx.delete(budgets).where(inArray(budgets.categoryId, plan.deletions));
      await tx.delete(categorizationRules).where(inArray(categorizationRules.categoryId, plan.deletions));
      await tx.delete(categories).where(inArray(categories.id, plan.deletions));
    }
    for (const update of plan.updates) {
      const { id, ...fields } = update;
      await tx.update(categories).set(fields).where(eq(categories.id, id));
    }
    if (plan.creates.length > 0) {
      await tx.insert(categories).values(
        plan.creates.map((category) => ({
          userId,
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
        }))
      );
    }
  });

  return summary;
}

/** Esecuzione da riga di comando su tutti gli utenti che hanno almeno una categoria. */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const users = await db.selectDistinct({ userId: categories.userId }).from(categories);
  console.log(dryRun ? "DRY RUN — nessuna scrittura" : "Reset categorie in corso");
  for (const { userId } of users) {
    const s = await resetUserCategories(userId, { dryRun });
    console.log(
      `utente ${userId}: ${s.updated} aggiornate, ${s.created} create, ${s.deleted} eliminate, ${s.reassignedTransactions} transazioni → "Da categorizzare"`
    );
  }
  process.exit(0);
}

if (process.argv[1]?.includes("reset-categories")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
