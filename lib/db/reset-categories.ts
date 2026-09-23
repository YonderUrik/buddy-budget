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
import { FALLBACK_CATEGORY_NAME, getFallbackCategoryId } from "@/lib/categorization/fallback";
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

/**
 * Individua, tra le categorie esistenti di un utente, quale riga rappresenta (o dovrebbe rappresentare)
 * la fallback: una riga già `isFallback: true`, oppure — dato reale storico su utenti creati prima del
 * backfill icone/colori — una riga non-fallback il cui nome è esattamente "Da categorizzare"
 * (`needsPromotion: true`, va promossa invece di crearne una seconda e violare l'unique su nome).
 * Nessuna corrispondenza → `null` (nessuna riga candidata, va creata una fallback nuova).
 */
export function resolveFallbackCandidate(
  existing: ExistingCategory[]
): { id: string; needsPromotion: boolean } | null {
  const alreadyFallback = existing.find((c) => c.isFallback);
  if (alreadyFallback) return { id: alreadyFallback.id, needsPromotion: false };
  const byName = existing.find((c) => !c.isFallback && c.name === FALLBACK_CATEGORY_NAME);
  if (byName) return { id: byName.id, needsPromotion: true };
  return null;
}

export interface CategoryResetSummary {
  updated: number;
  created: number;
  deleted: number;
  reassignedTransactions: number;
  /** True se una riga "Da categorizzare" non ancora marcata fallback è stata (o andrebbe) promossa invece di crearne una nuova. */
  promotedFallback: boolean;
  /** Nomi delle categorie personalizzate/orfane che il piano elimina (per il riepilogo dry-run/reale). */
  deletedNames: string[];
  /** Rinomine previste dagli aggiornamenti (nome precedente → nome nuovo). Solo gli update che cambiano nome. */
  renames: { from: string; to: string }[];
}

/** Deriva nomi eliminati e rinomine dal piano + dalle righe esistenti, per il riepilogo stampato da `main()`. */
export function describeCategoryResetPlan(
  plan: CategoryResetPlan,
  existing: ExistingCategory[]
): { deletedNames: string[]; renames: { from: string; to: string }[] } {
  const byId = new Map(existing.map((c) => [c.id, c]));
  const deletedNames = plan.deletions.map((id) => byId.get(id)?.name ?? id);
  const renames = plan.updates
    .filter((update) => byId.get(update.id)?.name !== update.name)
    .map((update) => ({ from: byId.get(update.id)?.name ?? update.id, to: update.name }));
  return { deletedNames, renames };
}

/**
 * Applica il piano di reset per un utente in un'unica transazione. Ordine: promuove a fallback una riga
 * "Da categorizzare" pre-esistente non ancora marcata tale (se serve), riassegna le transazioni delle
 * categorie da eliminare alla fallback, elimina budget e regole, elimina le categorie (liberando i nomi),
 * poi aggiorna e crea. Con `dryRun` calcola solo il riepilogo, nessuna scrittura.
 */
export async function resetUserCategories(userId: string, { dryRun }: { dryRun: boolean }): Promise<CategoryResetSummary> {
  const existing = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallbackCandidate = resolveFallbackCandidate(existing);
  // La riga candidata a promozione va esclusa dal planner come se fosse già fallback, altrimenti
  // verrebbe trattata come categoria personalizzata e finirebbe tra le eliminazioni.
  const plannerInput = fallbackCandidate?.needsPromotion
    ? existing.map((c) => (c.id === fallbackCandidate.id ? { ...c, isFallback: true } : c))
    : existing;
  const plan = planCategoryReset(plannerInput, DEFAULT_CATEGORIES, LEGACY_CATEGORY_NAMES);
  const promotedFallback = fallbackCandidate?.needsPromotion ?? false;
  const { deletedNames, renames } = describeCategoryResetPlan(plan, existing);

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
    promotedFallback,
    deletedNames,
    renames,
  };
  if (dryRun) return summary;

  const fallbackId = fallbackCandidate ? fallbackCandidate.id : await getFallbackCategoryId(userId);

  await db.transaction(async (tx) => {
    if (fallbackCandidate?.needsPromotion) {
      await tx
        .update(categories)
        .set({ isFallback: true, color: "red", icon: "help-circle", type: "voluta" })
        .where(eq(categories.id, fallbackCandidate.id));
    }
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
      `utente ${userId}: ${s.updated} aggiornate, ${s.created} create, ${s.deleted} eliminate, ${s.reassignedTransactions} transazioni → "Da categorizzare"` +
        (s.promotedFallback ? `, "Da categorizzare" esistente promossa a fallback (colore/icona resettati a red/help-circle)` : "")
    );
    if (s.renames.length > 0) {
      console.log(`  rinominate: ${s.renames.map((r) => `${r.from} → ${r.to}`).join(", ")}`);
    }
    if (s.deletedNames.length > 0) {
      console.log(`  eliminate: ${s.deletedNames.join(", ")}`);
    }
  }
  process.exit(0);
}

if (process.argv[1]?.includes("reset-categories")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
