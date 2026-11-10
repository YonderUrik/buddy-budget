import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions, type AutomaticCategorySource } from "@/lib/db/schema/transactions";
import { logger, recordCategorizationAutoApplied, type Logger } from "@/lib/observability";
import { MANUAL_RUN_BUDGET_MS, MAX_GROUPS_MANUAL_RUN, suggestCategoriesSafely } from "./ai/suggest-for-user";
import { autoApplicableGroups, loadCategorizationState } from "./load-groups";
import { buildRuleResolver, flushRuleHits } from "./resolve";

export interface AutoApplyResult {
  /** Movimenti categorizzati da sole, per origine. */
  applied: Record<AutomaticCategorySource, number>;
  /** Esercenti (gruppi) categorizzati dalle proposte sicure. */
  groups: number;
}

function emptyResult(): AutoApplyResult {
  return { applied: { regola: 0, storico: 0, assistente: 0, banca: 0 }, groups: 0 };
}

/** Totale dei movimenti categorizzati da un'esecuzione. */
export function totalApplied(result: AutoApplyResult): number {
  return result.applied.regola + result.applied.storico + result.applied.assistente + result.applied.banca;
}

/** Quota esclusa come espressione SQL: la percentuale dell'importo, con lo stesso segno. */
function excludedAmountSql(percentage: number) {
  return sql`round(abs(${transactions.amount}) * ${percentage}, 2) * sign(${transactions.amount})`;
}

/**
 * Applica le regole dell'utente ai movimenti ancora «Da categorizzare» (per esempio arrivati da un import CSV, o
 * rimasti fermi prima che la regola esistesse). Le regole sono scelte esplicite dell'utente: valgono sempre, anche
 * con l'applicazione automatica delle proposte spenta.
 */
async function applyRules(userId: string, fallbackIds: string[], now: Date): Promise<number> {
  if (fallbackIds.length === 0) return 0;
  const resolver = await buildRuleResolver(userId);
  const pending = await db
    .select({ id: transactions.id, description: transactions.description, rawDescription: transactions.rawDescription, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.categoryId, fallbackIds)));

  const updates = pending.flatMap((row) => {
    const amount = Number(row.amount);
    const resolved =
      resolver.resolve({ description: row.description, amount }) ??
      (row.rawDescription ? resolver.resolve({ description: row.rawDescription, amount }) : null);
    return resolved && !fallbackIds.includes(resolved.categoryId) ? [{ id: row.id, ...resolved }] : [];
  });
  if (updates.length === 0) return 0;

  let applied = 0;
  await db.transaction(async (tx) => {
    for (const update of updates) {
      const written = await tx
        .update(transactions)
        .set({
          categoryId: update.categoryId,
          excludedAmount: update.excludedAmount.toFixed(2),
          categorySource: "regola",
          categoryConfidence: null,
          categorizedAt: now,
          updatedAt: now,
        })
        // Solo se è ancora da categorizzare: una scelta fatta nel frattempo dall'utente non si sovrascrive.
        .where(and(eq(transactions.id, update.id), inArray(transactions.categoryId, fallbackIds)))
        .returning({ id: transactions.id });
      if (written.length > 0) {
        resolver.recordHit(update.ruleId);
        applied += 1;
      }
    }
  });
  await flushRuleHits(resolver.appliedRuleIds());
  return applied;
}

async function fallbackCategoryIds(userId: string): Promise<string[]> {
  const rows = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
  return rows.map((row) => row.id);
}

/**
 * Solo le regole, sui movimenti ancora «Da categorizzare»: da chiamare appena l'utente crea o cambia una regola, così
 * vale subito e non al prossimo import. Ritorna quanti movimenti ha categorizzato.
 */
export async function applyRulesToUncategorized(userId: string, options: { log?: Logger; now?: Date } = {}): Promise<number> {
  const fallbackIds = await fallbackCategoryIds(userId);
  const applied = await applyRules(userId, fallbackIds, options.now ?? new Date());
  if (applied > 0) {
    recordCategorizationAutoApplied("regola", applied);
    (options.log ?? logger).info("categorization.auto.applied", { categorySource: "regola", count: applied });
  }
  return applied;
}

/**
 * Categorizza da sola ciò che non ha bisogno di controllo: prima le regole dell'utente, poi (se l'utente lo ha scelto)
 * le proposte sicure dal 70% in su, da regole simili, scelte passate e, solo con il consenso attivo, assistente. Tocca
 * soltanto movimenti ancora «Da categorizzare» e registra su ognuno origine, sicurezza e quando, così l'utente li
 * ritrova in Categorizza → «Messe dall'app» e in Movimenti, e può cambiarli. Idempotente: rilanciarla non fa danni.
 */
export async function autoApplyCategories(userId: string, options: { log?: Logger; now?: Date } = {}): Promise<AutoApplyResult> {
  const log = options.log ?? logger;
  const now = options.now ?? new Date();
  const result = emptyResult();

  const fallbackIds = await fallbackCategoryIds(userId);
  if (fallbackIds.length === 0) return result;

  result.applied.regola = await applyRules(userId, fallbackIds, now);

  const state = await loadCategorizationState(userId);
  const ready = autoApplicableGroups(state);
  if (ready.length > 0) {
    const categoryById = new Map(state.categories.map((category) => [category.id, category]));
    await db.transaction(async (tx) => {
      for (const group of ready) {
        const suggestion = group.suggestion!;
        const category = categoryById.get(suggestion.suggestedCategoryId);
        if (!category || category.isFallback) continue;
        const percentage = category.type === "trasferimento" ? 1 : suggestion.suggestedSplitPercentage ?? 0;
        const written = await tx
          .update(transactions)
          .set({
            categoryId: category.id,
            excludedAmount: excludedAmountSql(percentage),
            categorySource: suggestion.source,
            categoryConfidence: suggestion.confidence.toFixed(4),
            categorizedAt: now,
            updatedAt: now,
          })
          .where(
            and(eq(transactions.userId, userId), inArray(transactions.id, group.transactionIds), inArray(transactions.categoryId, fallbackIds))
          )
          .returning({ id: transactions.id });
        if (written.length === 0) continue;
        result.applied[suggestion.source] += written.length;
        result.groups += 1;
      }
    });
  }

  for (const source of ["regola", "storico", "assistente"] as const) {
    const count = result.applied[source];
    if (count === 0) continue;
    recordCategorizationAutoApplied(source, count);
    log.info("categorization.auto.applied", { categorySource: source, count });
  }
  return result;
}

/** Movimenti per query nel conteggio dopo il giro: tiene corta la lista di parametri anche al primo import. */
const RECOUNT_CHUNK_SIZE = 1000;

/**
 * Quanti dei movimenti indicati sono ancora «Da categorizzare»: dopo il giro automatico, per dire all'utente quanti si
 * sono messi da soli e quanti restano da decidere. In caso di errore ritorna `ids.length` (nessuno sistemato): il
 * riepilogo resta prudente e la sync non si ferma.
 */
export async function countStillUncategorized(userId: string, ids: string[], log: Logger = logger): Promise<number> {
  if (ids.length === 0) return 0;
  try {
    const fallbackIds = await fallbackCategoryIds(userId);
    if (fallbackIds.length === 0) return 0;
    let still = 0;
    for (let start = 0; start < ids.length; start += RECOUNT_CHUNK_SIZE) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          and(eq(transactions.userId, userId), inArray(transactions.id, ids.slice(start, start + RECOUNT_CHUNK_SIZE)), inArray(transactions.categoryId, fallbackIds))
        );
      still += row?.count ?? 0;
    }
    return still;
  } catch (error) {
    log.warn("categorization.auto.recount_failed", { error });
    return ids.length;
  }
}

/** Come sopra ma non lancia mai: per sync, import e richieste dove un guasto non deve toccare il lavoro principale. */
export async function autoApplyCategoriesSafely(userId: string, log: Logger = logger): Promise<AutoApplyResult> {
  try {
    return await autoApplyCategories(userId, { log });
  } catch (error) {
    log.error("categorization.auto.failed", { error });
    return emptyResult();
  }
}

/**
 * After an import every new merchant goes to the assistant, within the manual run's limits (cost and time guard):
 * what is left over waits for the next import or «Categorizza con l'AI».
 */
const AFTER_IMPORT_SUGGEST_OPTIONS = { maxGroups: MAX_GROUPS_MANUAL_RUN, budgetMs: MANUAL_RUN_BUDGET_MS };

/**
 * After any sync or import (bank, file, broker statement, Trade Republic): the assistant proposes for every new
 * merchant (with consent), then rules and confident proposals (from 70%) apply by themselves. Never throws.
 */
export async function categorizeNewMovementsSafely(
  userId: string,
  log: Logger = logger,
  suggestOptions: { maxGroups?: number; budgetMs?: number } = AFTER_IMPORT_SUGGEST_OPTIONS
): Promise<AutoApplyResult> {
  await suggestCategoriesSafely(userId, log, suggestOptions);
  return autoApplyCategoriesSafely(userId, log);
}
