import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories, type Category } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { categorizationRunItems, categorizationRuns } from "@/lib/db/schema/categorization-runs";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
import { transactions, type AutomaticCategorySource, type Transaction } from "@/lib/db/schema/transactions";
import { logger, recordCategorizationRecategorized, recordCategorizationRecategorizeUndone, type Logger } from "@/lib/observability";
import { planRecategorize, type RecategorizePlan, type RecategorizeScope } from "./recategorize-plan";
import { buildRuleResolver, flushRuleHits } from "./resolve";
import type { StoredAssistantSuggestion } from "./suggest";

/** Per quanto si può annullare una ricategorizzazione: dopo, il bottone sparisce. */
export const RECATEGORIZE_UNDO_DAYS = 7;
/** Dopo quanto le righe per l'annulla si cancellano (alla ricategorizzazione successiva). */
const RECATEGORIZE_RETENTION_DAYS = 30;
/** Righe per query, per tenere corta la lista di parametri anche con migliaia di movimenti. */
const CHUNK_SIZE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

function chunks<T>(items: readonly T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size) out.push(items.slice(start, start + size));
  return out;
}

/** Quota esclusa come espressione SQL: la percentuale dell'importo, con lo stesso segno. */
function excludedAmountSql(percentage: number) {
  return sql`round(abs(${transactions.amount}) * ${percentage}, 2) * sign(${transactions.amount})`;
}

interface LoadedState {
  plan: RecategorizePlan;
  rowsById: Map<string, Transaction>;
  categories: Category[];
  autoApply: boolean;
}

async function loadAndPlan(userId: string, scope: RecategorizeScope): Promise<LoadedState> {
  const [user] = await db
    .select({ autoApply: authUser.categorizationAutoApply, consentAt: authUser.aiCategorizationConsentAt })
    .from(authUser)
    .where(eq(authUser.id, userId));
  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const rules = await db
    .select({ id: categorizationRules.id, pattern: categorizationRules.pattern, categoryId: categorizationRules.categoryId, splitPercentage: categorizationRules.splitPercentage })
    .from(categorizationRules)
    .where(eq(categorizationRules.userId, userId));
  const stored = await db
    .select()
    .from(categorizationSuggestions)
    .where(and(eq(categorizationSuggestions.userId, userId), eq(categorizationSuggestions.status, "in_attesa")));
  const resolver = await buildRuleResolver(userId);

  const plan = planRecategorize({
    rows: rows.map((row) => ({
      id: row.id,
      description: row.description,
      rawDescription: row.rawDescription,
      amount: Number(row.amount),
      excludedAmount: Number(row.excludedAmount),
      date: row.date,
      categoryId: row.categoryId,
      categorySource: row.categorySource,
    })),
    categories: userCategories.map((category) => ({ id: category.id, type: category.type, isFallback: category.isFallback })),
    rules: rules.map((rule) => ({ ...rule, splitPercentage: rule.splitPercentage === null ? null : Number(rule.splitPercentage) })),
    resolveRule: (input) => resolver.resolve(input),
    storedAssistant: new Map<string, StoredAssistantSuggestion>(
      stored.map((row) => [`${row.merchantKey}::${row.direction}`, { categoryId: row.categoryId, confidence: Number(row.confidence) }])
    ),
    autoApply: user?.autoApply ?? false,
    assistantConsent: Boolean(user?.consentAt),
    scope,
  });
  return { plan, rowsById: new Map(rows.map((row) => [row.id, row])), categories: userCategories, autoApply: user?.autoApply ?? false };
}

/** L'ultima ricategorizzazione che si può ancora annullare (non annullata, degli ultimi `RECATEGORIZE_UNDO_DAYS` giorni). */
export async function lastUndoableRun(userId: string, now = new Date()) {
  const [run] = await db
    .select({ id: categorizationRuns.id, scope: categorizationRuns.scope, changed: categorizationRuns.changed, createdAt: categorizationRuns.createdAt })
    .from(categorizationRuns)
    .where(
      and(
        eq(categorizationRuns.userId, userId),
        isNull(categorizationRuns.undoneAt),
        gt(categorizationRuns.createdAt, new Date(now.getTime() - RECATEGORIZE_UNDO_DAYS * DAY_MS))
      )
    )
    .orderBy(desc(categorizationRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export interface RecategorizePreview {
  plan: RecategorizePlan;
  /** Solo per `tutto` senza i movimenti più vecchi: quanti di quelli cambierebbero se li si includesse. */
  legacyAvailable: number;
  autoApply: boolean;
  rowsById: Map<string, Transaction>;
}

/** Cosa cambierebbe ricategorizzando, senza scrivere nulla. */
export async function previewRecategorize(userId: string, scope: RecategorizeScope): Promise<RecategorizePreview> {
  const state = await loadAndPlan(userId, scope);
  let legacyAvailable = 0;
  if (scope.kind === "tutto" && !scope.includeLegacy) {
    legacyAvailable = (await loadAndPlan(userId, { kind: "tutto", includeLegacy: true })).plan.legacyChanges;
  }
  return { plan: state.plan, legacyAvailable, autoApply: state.autoApply, rowsById: state.rowsById };
}

export interface RecategorizeApplyResult {
  runId: string | null;
  changed: number;
  groups: number;
  bySource: Record<AutomaticCategorySource, number>;
}

/**
 * Ricategorizza i gruppi scelti (`groupKeys`, o tutti se null) ricalcolando il piano sui dati di adesso: un gruppo che
 * nel frattempo è cambiato viene saltato. In una sola transazione scrive le categorie nuove (con origine, sicurezza e
 * momento, così compaiono in «Fatte da sole») e com'erano prima, per l'annulla. Tocca solo movimenti ancora nella
 * categoria di partenza e mai le scelte dell'utente.
 */
export async function applyRecategorize(
  userId: string,
  scope: RecategorizeScope,
  groupKeys: readonly string[] | null,
  now = new Date()
): Promise<RecategorizeApplyResult> {
  const { plan, rowsById } = await loadAndPlan(userId, scope);
  const wanted = groupKeys ? new Set(groupKeys) : null;
  const selected = wanted ? plan.groups.filter((group) => wanted.has(group.key)) : plan.groups;
  const bySource: Record<AutomaticCategorySource, number> = { regola: 0, storico: 0, assistente: 0 };
  if (selected.length === 0) return { runId: null, changed: 0, groups: 0, bySource };

  const ruleHits: string[] = [];
  let groupsWritten = 0;
  const runId = await db.transaction(async (tx) => {
    const [run] = await tx.insert(categorizationRuns).values({ userId, scope: scope.kind, changed: 0, createdAt: now }).returning({ id: categorizationRuns.id });
    const items: (typeof categorizationRunItems.$inferInsert)[] = [];
    for (const group of selected) {
      let written = 0;
      for (const ids of chunks(group.transactionIds)) {
        const rows = await tx
          .update(transactions)
          .set({
            categoryId: group.toCategoryId,
            excludedAmount: excludedAmountSql(group.percentage),
            categorySource: group.source,
            categoryConfidence: group.confidence === null ? null : group.confidence.toFixed(4),
            categorizedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(transactions.userId, userId),
              inArray(transactions.id, ids),
              eq(transactions.categoryId, group.fromCategoryId),
              sql`${transactions.categorySource} is distinct from 'utente'`
            )
          )
          .returning({ id: transactions.id });
        for (const { id } of rows) {
          const before = rowsById.get(id)!;
          items.push({
            runId: run.id,
            transactionId: id,
            previousCategoryId: before.categoryId,
            previousExcludedAmount: before.excludedAmount,
            previousSource: before.categorySource,
            previousConfidence: before.categoryConfidence,
            previousCategorizedAt: before.categorizedAt,
            newCategoryId: group.toCategoryId,
            appliedAt: now,
          });
          if (group.ruleId) ruleHits.push(group.ruleId);
        }
        written += rows.length;
      }
      bySource[group.source] += written;
      if (written > 0) groupsWritten += 1;
    }
    for (const part of chunks(items)) await tx.insert(categorizationRunItems).values(part);
    if (items.length === 0) {
      await tx.delete(categorizationRuns).where(eq(categorizationRuns.id, run.id));
      return null;
    }
    await tx.update(categorizationRuns).set({ changed: items.length }).where(eq(categorizationRuns.id, run.id));
    // Le vecchie ricategorizzazioni non si possono più annullare: le loro righe non servono più.
    await tx
      .delete(categorizationRuns)
      .where(and(eq(categorizationRuns.userId, userId), lt(categorizationRuns.createdAt, new Date(now.getTime() - RECATEGORIZE_RETENTION_DAYS * DAY_MS))));
    return run.id;
  });

  await flushRuleHits(ruleHits);
  for (const source of ["regola", "storico", "assistente"] as const) recordCategorizationRecategorized(source, bySource[source]);
  return { runId, changed: bySource.regola + bySource.storico + bySource.assistente, groups: groupsWritten, bySource };
}

/**
 * Annulla una ricategorizzazione: rimette categoria, quota esclusa e origine di prima, ma solo sui movimenti che hanno
 * ancora la categoria e il momento scritti da lei (una scelta fatta dopo resta) e se la categoria di prima esiste ancora.
 * Null se la ricategorizzazione non c'è, non è dell'utente, è già annullata o è troppo vecchia.
 */
export async function undoRecategorize(userId: string, runId: string, now = new Date()): Promise<{ restored: number } | null> {
  const run = await lastUndoableRun(userId, now);
  if (!run || run.id !== runId) return null;

  const restored = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ source: AutomaticCategorySource | null }>(sql`
      update ${transactions} as t set
        category_id = s.previous_category_id,
        excluded_amount = s.previous_excluded_amount,
        category_source = s.previous_source,
        category_confidence = s.previous_confidence,
        categorized_at = s.previous_categorized_at,
        updated_at = ${now.toISOString()}::timestamptz
      from (
        select i.*, cur.category_source as current_source
        from ${categorizationRunItems} i
        join ${transactions} cur on cur.id = i.transaction_id
        where i.run_id = ${runId}
      ) s
      where t.id = s.transaction_id
        and t.user_id = ${userId}
        and t.category_id = s.new_category_id
        and t.categorized_at = s.applied_at
        and exists (select 1 from ${categories} c where c.id = s.previous_category_id and c.user_id = ${userId})
      returning s.current_source as source
    `);
    await tx.update(categorizationRuns).set({ undoneAt: now }).where(eq(categorizationRuns.id, runId));
    return [...rows];
  });

  const bySource = new Map<AutomaticCategorySource, number>();
  for (const { source } of restored) if (source) bySource.set(source, (bySource.get(source) ?? 0) + 1);
  for (const [source, count] of bySource) recordCategorizationRecategorizeUndone(source, count);
  return { restored: restored.length };
}

/**
 * Quanti movimenti già categorizzati (non da te) cambierebbero categoria con questa regola: dopo averla salvata si
 * propone «Applica anche ai N passati». Non lancia: con un guasto risponde 0 e la regola resta salvata.
 */
export async function countPastMatchesSafely(userId: string, ruleId: string, log: Logger = logger): Promise<number> {
  try {
    return (await loadAndPlan(userId, { kind: "regola", ruleId })).plan.changes;
  } catch (error) {
    log.warn("categorization.recategorize.count_failed", { error });
    return 0;
  }
}
